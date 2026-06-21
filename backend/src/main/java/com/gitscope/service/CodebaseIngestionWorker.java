package com.gitscope.service;

import com.gitscope.dto.RepoDetails;
import com.gitscope.embedding.LocalEmbeddingService;
import com.gitscope.github.ChunkingService;
import com.gitscope.github.CodeChunk;
import com.gitscope.github.GitHubService;
import com.gitscope.rag.GeminiChatService;
import com.gitscope.vectorstore.VectorStoreService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@Slf4j
public class CodebaseIngestionWorker {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".java", ".ts", ".js", ".py", ".cpp", ".c", ".cs",
            ".go", ".rb", ".rs", ".kt", ".md", ".json", ".yml",
            ".yaml", ".html", ".css"
    );

    private static final Set<String> EXCLUDED_FILENAMES = Set.of(
            "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "license", "licence"
    );
    private static final Set<String> EXCLUDED_PATH_SEGMENTS = Set.of(
            "node_modules", ".git", "target", "build", "dist", "out",
            "vendor", "assets", "public", "test", "spec", "docs"
    );

    private static final int UPLOAD_BATCH_SIZE = 200;
    private static final int MAX_CHUNKS_CAP = 1000;

    private final ConcurrentHashMap<String, RepoDetails> repositoryCache = new ConcurrentHashMap<>();

    private final GitHubService gitHubService;
    private final ChunkingService chunkingService;
    private final LocalEmbeddingService embeddingService;
    private final VectorStoreService vectorStoreService;
    private final GeminiChatService geminiChatService;

    public CodebaseIngestionWorker(
            GitHubService gitHubService,
            ChunkingService chunkingService,
            LocalEmbeddingService embeddingService,
            VectorStoreService vectorStoreService,
            GeminiChatService geminiChatService
    ) {
        this.gitHubService = gitHubService;
        this.chunkingService = chunkingService;
        this.embeddingService = embeddingService;
        this.vectorStoreService = vectorStoreService;
        this.geminiChatService = geminiChatService;
    }

    public ConcurrentHashMap<String, RepoDetails> getRepositoryCache() {
        return repositoryCache;
    }

    private record PrioritizedFile(File file, String path, int priority) {}

    private record ChunkWithEmbedding(CodeChunk chunk, List<Double> embedding) {}

    @Async
    public void runIngestion(String repoIdentifier, String repoUrl, String branch) {
        File cloneDir = null;
        try {
            log.info("[ASYNC] Starting ingestion for repoIdentifier={} on thread {}", repoIdentifier, Thread.currentThread().getName());

            // 1. Clone
            cloneDir = gitHubService.cloneRepository(repoUrl);

            // 2. Scan & filter files
            List<File> rawFiles = gitHubService.scanSourceFiles(cloneDir);
            List<String> rawPaths = gitHubService.getRelativePaths(cloneDir, rawFiles);

            // Gather all whitelisted paths for the full file explorer view
            List<File> whitelistedFiles = new ArrayList<>();
            List<String> whitelistedPaths = new ArrayList<>();
            for (int i = 0; i < rawFiles.size(); i++) {
                if (isAllowed(rawFiles.get(i).getName(), rawPaths.get(i))) {
                    whitelistedFiles.add(rawFiles.get(i));
                    whitelistedPaths.add(rawPaths.get(i));
                }
            }
            log.info("[ASYNC] {} whitelisted source files discovered for repoIdentifier={}", whitelistedFiles.size(), repoIdentifier);

            // 3. Empty-codebase safety guard
            if (whitelistedFiles.isEmpty()) {
                log.warn("[ASYNC] No whitelisted files found — setting FAILED for {}", repoIdentifier);
                RepoDetails details = repositoryCache.get(repoIdentifier);
                if (details == null) details = new RepoDetails();
                details.setStatus("FAILED");
                details.setFileCount(0);
                details.setChunkCount(0);
                details.setFiles(Collections.emptyList());
                details.setArchitecturePulse(Collections.emptyMap());
                details.setSummary("No matching source code files found in the repository.");
                repositoryCache.put(repoIdentifier, details);
                return;
            }

            // 4. Prioritize sorting the whitelisted source files
            List<PrioritizedFile> prioritizedFiles = new ArrayList<>();
            for (int i = 0; i < whitelistedFiles.size(); i++) {
                String path = whitelistedPaths.get(i);
                int priority = getFilePriority(path);
                prioritizedFiles.add(new PrioritizedFile(whitelistedFiles.get(i), path, priority));
            }
            // Sort by priority descending (highest first), then by path lexicographically to keep it deterministic
            prioritizedFiles.sort((a, b) -> {
                if (a.priority() != b.priority()) {
                    return Integer.compare(b.priority(), a.priority());
                }
                return a.path().compareTo(b.path());
            });

            // 5. Chunk files with a strict budget cap
            List<CodeChunk> nonBlankChunks = new ArrayList<>();
            Set<String> indexedFilePaths = new LinkedHashSet<>();
            int totalChunksCount = 0;

            for (PrioritizedFile pf : prioritizedFiles) {
                if (totalChunksCount >= MAX_CHUNKS_CAP) {
                    log.info("[ASYNC] Reached chunk budget cap of {} chunks. Skipping remaining files.", MAX_CHUNKS_CAP);
                    break;
                }

                List<CodeChunk> fileChunks = chunkingService.chunkFile(pf.file(), pf.path());
                boolean hasIndexedChunk = false;
                for (CodeChunk chunk : fileChunks) {
                    if (chunk.getContent() != null && !chunk.getContent().trim().isEmpty()) {
                        nonBlankChunks.add(chunk);
                        totalChunksCount++;
                        hasIndexedChunk = true;
                        if (totalChunksCount >= MAX_CHUNKS_CAP) {
                            log.info("[ASYNC] Chunk budget cap of {} reached while processing file: {}. Stopping scanner.", MAX_CHUNKS_CAP, pf.path());
                            indexedFilePaths.add(pf.path());
                            break;
                        }
                    }
                }
                if (hasIndexedChunk) {
                    indexedFilePaths.add(pf.path());
                }
            }
            log.info("[ASYNC] Indexed {} non-blank chunks from {} files for repoIdentifier={}",
                    nonBlankChunks.size(), indexedFilePaths.size(), repoIdentifier);

            // 6. Ghost-chunk purge — wipe any stale vectors for this exact repo+branch
            vectorStoreService.deleteByRepoIdentifier(repoIdentifier);

            // 7. Parallel Local Embeddings & Batch Upload
            embedAndStore(repoIdentifier, nonBlankChunks);

            // 8. Generate Codebase Blueprint/Summary
            log.info("[ASYNC] Generating codebase summary/blueprint using Gemini...");
            String repoName = repoUrl.substring(repoUrl.lastIndexOf('/') + 1);
            // Build summary context from the files actually indexed (to be accurate to what's in the vector store)
            List<File> indexedFiles = prioritizedFiles.stream()
                    .filter(pf -> indexedFilePaths.contains(pf.path()))
                    .map(PrioritizedFile::file)
                    .collect(Collectors.toList());
            List<String> indexedPathsList = new ArrayList<>(indexedFilePaths);
            String codeContext = buildCodeContextForSummary(indexedFiles, indexedPathsList);
            String summary;
            try {
                summary = geminiChatService.generateSummary(repoName, codeContext);
            } catch (Exception e) {
                log.error("[ASYNC] Failed to generate summary using Gemini: {}", e.getMessage());
                summary = "Failed to generate codebase blueprint. Please check if your Gemini API key is valid.";
            }

            // 9. Compute ratings
            Map<String, Integer> ratings = calculateArchitecturalRatings(indexedFiles, indexedPathsList);

            // 10. Mark complete in repositoryCache (passing full whitelistedPaths for tree browsing)
            RepoDetails details = repositoryCache.get(repoIdentifier);
            if (details == null) details = new RepoDetails();
            details.setStatus("COMPLETED");
            details.setFileCount(indexedFilePaths.size());
            details.setChunkCount(nonBlankChunks.size());
            details.setFiles(whitelistedPaths); // Explorer tree shows all discovered whitelisted files
            details.setArchitecturePulse(ratings);
            details.setSummary(summary);
            repositoryCache.put(repoIdentifier, details);
            log.info("[ASYNC] Ingestion COMPLETED for repoIdentifier={}", repoIdentifier);

        } catch (Exception e) {
            log.error("[ASYNC] Ingestion FAILED for repoIdentifier={}: {}", repoIdentifier, e.getMessage(), e);
            RepoDetails details = repositoryCache.get(repoIdentifier);
            if (details == null) details = new RepoDetails();
            details.setStatus("FAILED");
            details.setSummary("Ingestion failed: " + e.getMessage());
            repositoryCache.put(repoIdentifier, details);
        } finally {
            if (cloneDir != null) {
                gitHubService.cleanupDirectory(cloneDir);
            }
        }
    }

    /**
     * Parallelizes the ONNX local embedding generations across CPU cores concurrently,
     * and uploads final vectors in batches of 200 to ChromaDB.
     */
    private void embedAndStore(String repoIdentifier, List<CodeChunk> chunks) {
        log.info("[ASYNC] Generating local embeddings sequentially for {} chunks...", chunks.size());

        List<ChunkWithEmbedding> processed = chunks.stream().map(chunk -> {
            float[] emb = embeddingService.getEmbedding(chunk.getContent());
            List<Double> doubleList = embeddingService.toDoubleList(emb);
            return new ChunkWithEmbedding(chunk, doubleList);
        }).toList();

        log.info("[ASYNC] Sequential embedding generation complete. Uploading to ChromaDB in batches of {}...", UPLOAD_BATCH_SIZE);

        for (int i = 0; i < processed.size(); i += UPLOAD_BATCH_SIZE) {
            List<ChunkWithEmbedding> batch = processed.subList(i, Math.min(i + UPLOAD_BATCH_SIZE, processed.size()));
            List<CodeChunk> subChunks = batch.stream().map(ChunkWithEmbedding::chunk).collect(Collectors.toList());
            List<List<Double>> subEmbeddings = batch.stream().map(ChunkWithEmbedding::embedding).collect(Collectors.toList());

            vectorStoreService.upsertChunks(repoIdentifier, subChunks, subEmbeddings);
            log.info("[ASYNC] Uploaded batch {}/{} to ChromaDB for repoIdentifier={}",
                    Math.min(i + UPLOAD_BATCH_SIZE, processed.size()), processed.size(), repoIdentifier);
        }
    }

    private boolean isAllowed(String fileName, String relPath) {
        String name = fileName.toLowerCase();
        String path = relPath.toLowerCase().replace("\\", "/");

        if (EXCLUDED_FILENAMES.contains(name)) return false;

        for (String seg : EXCLUDED_PATH_SEGMENTS) {
            if (path.contains("/" + seg + "/") || path.startsWith(seg + "/")) {
                return false;
            }
        }

        int dotIdx = name.lastIndexOf('.');
        if (dotIdx < 0) return false;
        String ext = name.substring(dotIdx);
        return ALLOWED_EXTENSIONS.contains(ext);
    }

    private int getFilePriority(String path) {
        String p = path.toLowerCase();

        // 1. Documentation & Metadata
        if (p.endsWith("readme.md") || p.endsWith("pom.xml") || p.endsWith("package.json") ||
            p.endsWith("go.mod") || p.endsWith("cargo.toml") ||
            p.contains("config") || p.endsWith(".properties") || p.endsWith(".yml") || p.endsWith(".yaml")) {
            return 4;
        }

        // 2. Entry Points
        if (p.contains("controller") || p.contains("route") || p.contains("resource") || p.contains("endpoint")) {
            return 3;
        }

        // 3. Core Operations
        if (p.contains("service") || p.contains("util") || p.contains("helper") || p.contains("handler")) {
            return 2;
        }

        // 4. Data Layouts
        if (p.contains("model") || p.contains("entity") || p.contains("dto") || p.contains("repository") || p.contains("vo")) {
            return 1;
        }

        return 0;
    }

    private String buildCodeContextForSummary(List<File> files, List<String> paths) {
        StringBuilder sb = new StringBuilder();
        int totalChars = 0;
        int maxChars = 80000;

        List<Integer> indices = new ArrayList<>();
        for (int i = 0; i < files.size(); i++) {
            indices.add(i);
        }
        indices.sort((a, b) -> {
            String pA = paths.get(a).toLowerCase();
            String pB = paths.get(b).toLowerCase();
            return Integer.compare(getFileImportanceScore(pB), getFileImportanceScore(pA));
        });

        for (int idx : indices) {
            if (totalChars >= maxChars) break;
            File file = files.get(idx);
            String path = paths.get(idx);
            try {
                String content = Files.readString(file.toPath());
                if (content.length() > 15000) {
                    content = content.substring(0, 15000) + "\n... [TRUNCATED] ...";
                }
                String fileHeader = "=== File: " + path + " ===\n";
                if (totalChars + fileHeader.length() + content.length() > maxChars) {
                    int remaining = maxChars - totalChars - fileHeader.length();
                    if (remaining > 500) {
                        content = content.substring(0, remaining) + "\n... [TRUNCATED] ...";
                    } else {
                        break;
                    }
                }
                sb.append(fileHeader).append(content).append("\n\n");
                totalChars += fileHeader.length() + content.length();
            } catch (Exception e) {
                log.warn("Failed to read file for summary context: {}", path, e);
            }
        }
        return sb.toString();
    }

    private int getFileImportanceScore(String path) {
        if (path.endsWith("readme.md")) return 100;
        if (path.endsWith("pom.xml") || path.endsWith("package.json") || path.endsWith("go.mod") || path.endsWith("cargo.toml")) return 90;
        if (path.contains("controller") || path.contains("resource") || path.contains("api")) return 80;
        if (path.contains("service") || path.contains("impl")) return 70;
        if (path.contains("config") || path.contains("properties") || path.contains("yml") || path.contains("yaml")) return 60;
        return 10;
    }

    private Map<String, Integer> calculateArchitecturalRatings(List<File> files, List<String> paths) {
        int fileCount = files.size();
        int maintainability = 85;
        int security = 80;
        int performance = 85;

        if (fileCount > 100) {
            maintainability -= 5;
        } else if (fileCount < 20) {
            maintainability += 5;
        }

        boolean hasTests = paths.stream().anyMatch(p -> p.toLowerCase().contains("test"));
        if (hasTests) {
            maintainability += 7;
        }

        boolean hasSecurity = paths.stream().anyMatch(p -> p.toLowerCase().contains("security") || p.toLowerCase().contains("auth"));
        if (hasSecurity) {
            security += 10;
        } else {
            security += 5;
        }

        boolean hasCache = paths.stream().anyMatch(p -> p.toLowerCase().contains("cache") || p.toLowerCase().contains("redis"));
        if (hasCache) {
            performance += 8;
        }

        maintainability = Math.max(65, Math.min(98, maintainability));
        security = Math.max(60, Math.min(98, security));
        performance = Math.max(70, Math.min(98, performance));

        return Map.of(
                "Maintainability", maintainability,
                "Security Profile", security,
                "Performance", performance
        );
    }
}
