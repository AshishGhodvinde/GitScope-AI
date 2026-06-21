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
            "node_modules", "target", "build", "dist", ".git", "coverage", "__pycache__"
    );

    private static final int BATCH_SIZE = 20;

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

            List<File> sourceFiles = new ArrayList<>();
            List<String> filePaths = new ArrayList<>();
            for (int i = 0; i < rawFiles.size(); i++) {
                if (isAllowed(rawFiles.get(i).getName(), rawPaths.get(i))) {
                    sourceFiles.add(rawFiles.get(i));
                    filePaths.add(rawPaths.get(i));
                }
            }
            log.info("[ASYNC] {} whitelisted source files for repoIdentifier={}", sourceFiles.size(), repoIdentifier);

            // 3. Empty-codebase safety guard
            if (sourceFiles.isEmpty()) {
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

            // 4. Chunk files
            List<CodeChunk> allChunks = new ArrayList<>();
            for (int i = 0; i < sourceFiles.size(); i++) {
                List<CodeChunk> fileChunks = chunkingService.chunkFile(sourceFiles.get(i), filePaths.get(i));
                allChunks.addAll(fileChunks);
            }
            List<CodeChunk> nonBlankChunks = allChunks.stream()
                    .filter(c -> c.getContent() != null && !c.getContent().trim().isEmpty())
                    .collect(Collectors.toList());
            log.info("[ASYNC] {} non-blank chunks for repoIdentifier={}", nonBlankChunks.size(), repoIdentifier);

            // 5. Ghost-chunk purge — wipe any stale vectors for this exact repo+branch
            vectorStoreService.deleteByRepoIdentifier(repoIdentifier);

            // 6. Embed + upsert in batches
            embedAndStore(repoIdentifier, nonBlankChunks);

            // 7. Generate Codebase Blueprint/Summary
            log.info("[ASYNC] Generating codebase summary/blueprint using Gemini...");
            String repoName = repoUrl.substring(repoUrl.lastIndexOf('/') + 1);
            String codeContext = buildCodeContextForSummary(sourceFiles, filePaths);
            String summary;
            try {
                summary = geminiChatService.generateSummary(repoName, codeContext);
            } catch (Exception e) {
                log.error("[ASYNC] Failed to generate summary using Gemini: {}", e.getMessage());
                summary = "Failed to generate codebase blueprint. Please check if your Gemini API key is valid.";
            }

            // 8. Compute ratings
            Map<String, Integer> ratings = calculateArchitecturalRatings(sourceFiles, filePaths);

            // 9. Mark complete in repositoryCache
            RepoDetails details = repositoryCache.get(repoIdentifier);
            if (details == null) details = new RepoDetails();
            details.setStatus("COMPLETED");
            details.setFileCount(sourceFiles.size());
            details.setChunkCount(nonBlankChunks.size());
            details.setFiles(filePaths);
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

    private void embedAndStore(String repoIdentifier, List<CodeChunk> chunks) {
        for (int i = 0; i < chunks.size(); i += BATCH_SIZE) {
            List<CodeChunk> batch = chunks.subList(i, Math.min(i + BATCH_SIZE, chunks.size()));
            List<String> contents = batch.stream().map(CodeChunk::getContent).collect(Collectors.toList());

            List<float[]> rawEmbeddings = embeddingService.getEmbeddingsBatch(contents);
            if (rawEmbeddings == null || rawEmbeddings.size() != batch.size()) {
                throw new RuntimeException("Embeddings size mismatch: expected " + batch.size()
                        + ", got " + (rawEmbeddings == null ? 0 : rawEmbeddings.size()));
            }

            List<List<Double>> embeddings = new ArrayList<>();
            for (float[] emb : rawEmbeddings) {
                embeddings.add(embeddingService.toDoubleList(emb));
            }

            vectorStoreService.upsertChunks(repoIdentifier, batch, embeddings);
            log.info("[ASYNC] Embedded batch {}/{} for repoIdentifier={}",
                    Math.min(i + BATCH_SIZE, chunks.size()), chunks.size(), repoIdentifier);
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
