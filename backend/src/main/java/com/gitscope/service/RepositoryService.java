package com.gitscope.service;

import com.gitscope.dto.*;
import com.gitscope.embedding.LocalEmbeddingService;
import com.gitscope.exception.RepositoryIndexingException;
import com.gitscope.github.ChunkingService;
import com.gitscope.github.CodeChunk;
import com.gitscope.github.GitHubService;
import com.gitscope.vectorstore.VectorStoreService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Stateless, async-capable repository ingestion service.
 *
 * <p>All state is tracked in a thread-safe in-memory {@link ConcurrentHashMap}.
 * There is no relational database. Each repository is uniquely identified by a
 * composite key: {@code repoUrl + "#" + branch}.
 *
 * <p>Possible status values:
 * <ul>
 *   <li>{@code INGESTING} – background thread is running</li>
 *   <li>{@code COMPLETED} – ingestion finished successfully</li>
 *   <li>{@code FAILED} – ingestion encountered a fatal error</li>
 *   <li>{@code FAILED_EMPTY} – no whitelisted source files found</li>
 * </ul>
 */
@Service
@Slf4j
public class RepositoryService {

    // ---------------------------------------------------------------------------
    // Extension whitelist: only meaningful plain-text source code extensions
    // ---------------------------------------------------------------------------
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            ".java", ".ts", ".js", ".py", ".cpp", ".c", ".cs",
            ".go", ".rb", ".rs", ".kt", ".md", ".json", ".yml",
            ".yaml", ".html", ".css"
    );

    // Paths/filenames that are always excluded regardless of extension
    private static final Set<String> EXCLUDED_FILENAMES = Set.of(
            "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "license", "licence"
    );
    private static final Set<String> EXCLUDED_PATH_SEGMENTS = Set.of(
            "node_modules", "target", "build", "dist", ".git", "coverage", "__pycache__"
    );

    private static final int BATCH_SIZE = 20;
    private static final String DEFAULT_BRANCH = "main";

    // ---------------------------------------------------------------------------
    // In-memory state store: repoIdentifier → status string
    // ---------------------------------------------------------------------------
    private final ConcurrentHashMap<String, String> statusMap       = new ConcurrentHashMap<>();
    // repoIdentifier → extra info (e.g. error message or file/chunk counts)
    private final ConcurrentHashMap<String, String> statusDetailMap = new ConcurrentHashMap<>();

    // ---------------------------------------------------------------------------
    // Dependencies
    // ---------------------------------------------------------------------------
    private final GitHubService       gitHubService;
    private final ChunkingService     chunkingService;
    private final LocalEmbeddingService embeddingService;
    private final VectorStoreService  vectorStoreService;

    public RepositoryService(
            GitHubService gitHubService,
            ChunkingService chunkingService,
            LocalEmbeddingService embeddingService,
            VectorStoreService vectorStoreService
    ) {
        this.gitHubService      = gitHubService;
        this.chunkingService    = chunkingService;
        this.embeddingService   = embeddingService;
        this.vectorStoreService = vectorStoreService;
    }

    // ---------------------------------------------------------------------------
    // Public API — called by the controller
    // ---------------------------------------------------------------------------

    /**
     * Accepts an indexing request, records the {@code INGESTING} status immediately,
     * and kicks off the background worker via {@link #runIngestion}.
     *
     * @return a response with status {@code INGESTING} and the tracking identifier
     */
    public IndexRepositoryResponse indexRepository(IndexRepositoryRequest request) {
        String url    = request.repositoryUrl().trim();
        String branch = (request.branch() != null && !request.branch().isBlank())
                        ? request.branch().trim()
                        : DEFAULT_BRANCH;
        String repoIdentifier = buildIdentifier(url, branch);

        log.info("Queuing ingestion for repoIdentifier={}", repoIdentifier);
        statusMap.put(repoIdentifier, "INGESTING");
        statusDetailMap.remove(repoIdentifier);

        // Fire-and-forget async
        runIngestion(repoIdentifier, url, branch);

        return new IndexRepositoryResponse(repoIdentifier, "INGESTING",
                "Indexing started in the background. Poll /api/repositories/status?id=" + repoIdentifier);
    }

    /**
     * Returns the current ingestion status for the given {@code repoIdentifier}.
     */
    public StatusResponse getStatus(String repoIdentifier) {
        String status = statusMap.getOrDefault(repoIdentifier, "NOT_FOUND");
        String detail = statusDetailMap.getOrDefault(repoIdentifier, "");
        return new StatusResponse(repoIdentifier, status, detail);
    }

    /**
     * Returns a snapshot of all known repositories and their statuses.
     */
    public List<RepositoryResponse> getAllRepositories() {
        return statusMap.entrySet().stream()
                .map(entry -> {
                    String id     = entry.getKey();
                    String status = entry.getValue();
                    String[] parts = id.split("#", 2);
                    String url     = parts[0];
                    String branch  = parts.length > 1 ? parts[1] : DEFAULT_BRANCH;
                    return new RepositoryResponse(id, url, branch, status, null, null);
                })
                .collect(Collectors.toList());
    }

    // ---------------------------------------------------------------------------
    // @Async — background ingestion worker
    // ---------------------------------------------------------------------------

    /**
     * Runs the full ingestion pipeline in a Spring-managed async thread pool.
     * Updates {@link #statusMap} to either {@code COMPLETED}, {@code FAILED}, or {@code FAILED_EMPTY}.
     */
    @Async
    public void runIngestion(String repoIdentifier, String repoUrl, String branch) {
        File cloneDir = null;
        try {
            log.info("[ASYNC] Starting ingestion for repoIdentifier={}", repoIdentifier);

            // 1. Clone
            cloneDir = gitHubService.cloneRepository(repoUrl);

            // 2. Scan & filter files
            List<File>   rawFiles   = gitHubService.scanSourceFiles(cloneDir);
            List<String> rawPaths   = gitHubService.getRelativePaths(cloneDir, rawFiles);

            List<File>   sourceFiles = new ArrayList<>();
            List<String> filePaths   = new ArrayList<>();
            for (int i = 0; i < rawFiles.size(); i++) {
                if (isAllowed(rawFiles.get(i).getName(), rawPaths.get(i))) {
                    sourceFiles.add(rawFiles.get(i));
                    filePaths.add(rawPaths.get(i));
                }
            }
            log.info("[ASYNC] {} whitelisted source files for repoIdentifier={}", sourceFiles.size(), repoIdentifier);

            // 3. Empty-codebase safety guard
            if (sourceFiles.isEmpty()) {
                log.warn("[ASYNC] No whitelisted files found — setting FAILED_EMPTY for {}", repoIdentifier);
                statusMap.put(repoIdentifier, "FAILED_EMPTY");
                statusDetailMap.put(repoIdentifier,
                        "No matching source code files found. The repository may contain only binary or lock files.");
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

            // 7. Mark complete
            String detail = String.format("files=%d chunks=%d", sourceFiles.size(), nonBlankChunks.size());
            statusMap.put(repoIdentifier, "COMPLETED");
            statusDetailMap.put(repoIdentifier, detail);
            log.info("[ASYNC] Ingestion COMPLETED for repoIdentifier={} ({})", repoIdentifier, detail);

        } catch (Exception e) {
            log.error("[ASYNC] Ingestion FAILED for repoIdentifier={}: {}", repoIdentifier, e.getMessage(), e);
            statusMap.put(repoIdentifier, "FAILED");
            statusDetailMap.put(repoIdentifier, e.getMessage());
        } finally {
            if (cloneDir != null) {
                gitHubService.cleanupDirectory(cloneDir);
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private void embedAndStore(String repoIdentifier, List<CodeChunk> chunks) {
        for (int i = 0; i < chunks.size(); i += BATCH_SIZE) {
            List<CodeChunk> batch    = chunks.subList(i, Math.min(i + BATCH_SIZE, chunks.size()));
            List<String>    contents = batch.stream().map(CodeChunk::getContent).collect(Collectors.toList());

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

    /**
     * Returns {@code true} if the file should be indexed.
     * Applies the extension whitelist and path-segment blacklist.
     */
    private boolean isAllowed(String fileName, String relPath) {
        String name = fileName.toLowerCase();
        String path = relPath.toLowerCase().replace("\\", "/");

        // Excluded filenames
        if (EXCLUDED_FILENAMES.contains(name)) return false;

        // Excluded path segments (node_modules, .git, target, etc.)
        for (String seg : EXCLUDED_PATH_SEGMENTS) {
            if (path.contains("/" + seg + "/") || path.startsWith(seg + "/")) {
                return false;
            }
        }

        // Extension whitelist
        int dotIdx = name.lastIndexOf('.');
        if (dotIdx < 0) return false;
        String ext = name.substring(dotIdx);
        return ALLOWED_EXTENSIONS.contains(ext);
    }

    /** Builds the composite unique identifier for a repository. */
    public static String buildIdentifier(String repoUrl, String branch) {
        return repoUrl.trim() + "#" + (branch != null && !branch.isBlank() ? branch.trim() : DEFAULT_BRANCH);
    }
}
