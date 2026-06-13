package com.gitscope.service;

import com.gitscope.dto.*;
import com.gitscope.embedding.LocalEmbeddingService;
import com.gitscope.entity.RepositoryEntity;
import com.gitscope.entity.RepositoryEntity.IndexStatus;
import com.gitscope.exception.RepositoryIndexingException;
import com.gitscope.exception.RepositoryNotFoundException;
import com.gitscope.github.ChunkingService;
import com.gitscope.github.CodeChunk;
import com.gitscope.github.GitHubService;
import com.gitscope.rag.GeminiChatService;
import com.gitscope.repository.RepositoryJpaRepository;
import com.gitscope.vectorstore.VectorStoreService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Core service orchestrating the full repository indexing pipeline:
 * clone → scan → chunk → embed → store vectors → save metadata.
 */
@Service
@Slf4j
public class RepositoryService {

    private static final int BATCH_SIZE = 20; // Embed and upsert in batches

    private final GitHubService gitHubService;
    private final ChunkingService chunkingService;
    private final LocalEmbeddingService embeddingService;
    private final VectorStoreService vectorStoreService;
    private final GeminiChatService geminiChatService;
    private final RepositoryJpaRepository repositoryJpaRepository;

    public RepositoryService(
            GitHubService gitHubService,
            ChunkingService chunkingService,
            LocalEmbeddingService embeddingService,
            VectorStoreService vectorStoreService,
            GeminiChatService geminiChatService,
            RepositoryJpaRepository repositoryJpaRepository
    ) {
        this.gitHubService = gitHubService;
        this.chunkingService = chunkingService;
        this.embeddingService = embeddingService;
        this.vectorStoreService = vectorStoreService;
        this.geminiChatService = geminiChatService;
        this.repositoryJpaRepository = repositoryJpaRepository;
    }

    /**
     * Full indexing pipeline for a GitHub repository URL.
     * Re-indexes if already indexed (deletes old vectors first).
     */
    @Transactional
    public IndexRepositoryResponse indexRepository(IndexRepositoryRequest request) {
        String url = request.repositoryUrl().trim();
        String repoName = gitHubService.extractRepoName(url);
        String owner = gitHubService.extractOwner(url);

        log.info("Starting indexing for repository: {}/{}", owner, repoName);

        // If already indexed, delete old vectors and update record
        RepositoryEntity entity;
        if (repositoryJpaRepository.existsByUrl(url)) {
            entity = repositoryJpaRepository.findByUrl(url)
                    .orElseThrow(() -> new RepositoryNotFoundException(url));
            // Delete old ChromaDB collection
            if (entity.getChromaCollectionId() != null) {
                vectorStoreService.deleteCollection(entity.getChromaCollectionId());
            }
            entity.setStatus(IndexStatus.INDEXING);
            entity.setIndexedAt(LocalDateTime.now());
            entity.setSummary(null); // Clear cached summary on re-index
        } else {
            entity = RepositoryEntity.builder()
                    .name(repoName)
                    .owner(owner)
                    .url(url)
                    .status(IndexStatus.INDEXING)
                    .indexedAt(LocalDateTime.now())
                    .build();
        }
        entity = repositoryJpaRepository.save(entity);

        File cloneDir = null;
        try {
            // Step 1: Clone
            cloneDir = gitHubService.cloneRepository(url);

            // Step 2: Scan files
            List<File> scannedFiles = gitHubService.scanSourceFiles(cloneDir);
            List<String> scannedPaths = gitHubService.getRelativePaths(cloneDir, scannedFiles);

            List<File> sourceFiles = new ArrayList<>();
            List<String> allFilePaths = new ArrayList<>();
            for (int i = 0; i < scannedFiles.size(); i++) {
                File file = scannedFiles.get(i);
                String relPath = scannedPaths.get(i);
                if (isJunkFile(file.getName(), relPath)) {
                    continue;
                }
                sourceFiles.add(file);
                allFilePaths.add(relPath);
            }
            log.info("Found {} source files in {} (after filtering junk files)", sourceFiles.size(), repoName);

            // Step 3: Chunk all files
            List<CodeChunk> allChunks = new ArrayList<>();
            for (int i = 0; i < sourceFiles.size(); i++) {
                List<CodeChunk> fileChunks = chunkingService.chunkFile(sourceFiles.get(i), allFilePaths.get(i));
                allChunks.addAll(fileChunks);
            }
            List<CodeChunk> nonBlankChunks = allChunks.stream()
                    .filter(c -> c.getContent() != null && !c.getContent().trim().isEmpty())
                    .collect(Collectors.toList());
            log.info("Generated {} chunks ({} non-blank) from {} files", allChunks.size(), nonBlankChunks.size(), sourceFiles.size());

            // Step 4: Create ChromaDB collection
            String collectionName = "repo_" + entity.getId();
            String collectionId = vectorStoreService.getOrCreateCollection(collectionName);

            // Step 5: Embed and upsert in batches
            embedAndStore(nonBlankChunks, collectionId);

            // Step 6: Update entity with final stats
            entity.setFileCount(sourceFiles.size());
            entity.setChunkCount(nonBlankChunks.size());
            entity.setStatus(IndexStatus.INDEXED);
            entity.setChromaCollectionId(collectionId);
            entity = repositoryJpaRepository.save(entity);

            log.info("Successfully indexed {}/{}: {} files, {} chunks",
                    owner, repoName, sourceFiles.size(), allChunks.size());

            return new IndexRepositoryResponse(
                    entity.getId(), entity.getName(), entity.getOwner(),
                    entity.getStatus().name(), entity.getFileCount(), entity.getChunkCount());

        } catch (Exception e) {
            // Mark as failed
            entity.setStatus(IndexStatus.FAILED);
            repositoryJpaRepository.save(entity);
            log.error("Indexing failed for {}: {}", url, e.getMessage(), e);
            throw new RepositoryIndexingException("Indexing failed: " + e.getMessage(), e);
        } finally {
            // Always clean up cloned repository
            if (cloneDir != null) {
                gitHubService.cleanupDirectory(cloneDir);
            }
        }
    }

    /**
     * Returns basic metadata for a repository by ID.
     */
    public RepositoryResponse getRepository(Long id) {
        RepositoryEntity entity = repositoryJpaRepository.findById(id)
                .orElseThrow(() -> new RepositoryNotFoundException(id));

        return toResponse(entity);
    }

    /**
     * Generates an AI summary for the repository using representative chunks.
     */
    public SummaryResponse getSummary(Long id) {
        RepositoryEntity entity = repositoryJpaRepository.findById(id)
                .orElseThrow(() -> new RepositoryNotFoundException(id));

        if (entity.getStatus() != IndexStatus.INDEXED) {
            throw new RepositoryIndexingException("Repository is not fully indexed yet. Status: " + entity.getStatus());
        }

        // Return cached summary if available
        if (entity.getSummary() != null && !entity.getSummary().isBlank()) {
            log.info("Returning cached summary for repository: {}", entity.getName());
            return new SummaryResponse(entity.getId(), entity.getName(), entity.getSummary());
        }

        log.info("Generating new summary via Gemini for repository: {}", entity.getName());

        // Retrieve representative chunks for summary context
        float[] queryEmbedding = embeddingService.getEmbedding(
                "project overview architecture purpose tech stack modules");
        List<Double> queryVector = embeddingService.toDoubleList(queryEmbedding);

        List<VectorStoreService.SearchResult> results = vectorStoreService.query(
                entity.getChromaCollectionId(), queryVector, 10);

        String codeContext = results.stream()
                .map(r -> "File: " + r.filePath() + "\n" + r.content())
                .collect(Collectors.joining("\n\n---\n\n"));

        String summary = geminiChatService.generateSummary(entity.getName(), codeContext);

        // Cache the summary in the database
        entity.setSummary(summary);
        repositoryJpaRepository.save(entity);

        return new SummaryResponse(entity.getId(), entity.getName(), summary);
    }

    /**
     * Returns the list of all indexed file paths for the repository.
     */
    public FileListResponse getFiles(Long id) {
        RepositoryEntity entity = repositoryJpaRepository.findById(id)
                .orElseThrow(() -> new RepositoryNotFoundException(id));

        if (entity.getChromaCollectionId() == null) {
            return new FileListResponse(id, entity.getName(), List.of(), 0);
        }

        // Query with a broad embedding to collect file paths
        float[] embedding = embeddingService.getEmbedding("source code files");
        List<Double> vector = embeddingService.toDoubleList(embedding);

        List<VectorStoreService.SearchResult> results = vectorStoreService.query(
                entity.getChromaCollectionId(), vector, 50);

        List<String> files = results.stream()
                .map(VectorStoreService.SearchResult::filePath)
                .distinct()
                .sorted()
                .toList();

        return new FileListResponse(id, entity.getName(), files, entity.getFileCount());
    }

    /**
     * Returns all indexed repositories.
     */
    public List<RepositoryResponse> getAllRepositories() {
        return repositoryJpaRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    private void embedAndStore(List<CodeChunk> chunks, String collectionId) {
        for (int i = 0; i < chunks.size(); i += BATCH_SIZE) {
            List<CodeChunk> batch = chunks.subList(i, Math.min(i + BATCH_SIZE, chunks.size()));
            List<String> contents = batch.stream().map(CodeChunk::getContent).collect(Collectors.toList());

            List<float[]> rawEmbeddings;
            try {
                // Fetch/compute vectors via local JVM ONNX model (uses persistent DB cache automatically)
                rawEmbeddings = embeddingService.getEmbeddingsBatch(contents);
            } catch (Exception e) {
                log.error("Failed to generate local embeddings for batch", e);
                throw e;
            }

            if (rawEmbeddings == null || rawEmbeddings.size() != batch.size()) {
                throw new RuntimeException("Generated embeddings size mismatch. Expected " + batch.size() + ", got " + (rawEmbeddings == null ? 0 : rawEmbeddings.size()));
            }

            List<List<Double>> embeddings = new ArrayList<>();
            for (float[] emb : rawEmbeddings) {
                embeddings.add(embeddingService.toDoubleList(emb));
            }

            vectorStoreService.upsertChunks(collectionId, batch, embeddings);
            log.info("Embedded and stored batch {}/{}", Math.min(i + BATCH_SIZE, chunks.size()), chunks.size());
        }
    }

    private boolean isJunkFile(String fileName, String relPath) {
        String name = fileName.toLowerCase();
        String path = relPath.toLowerCase().replace("\\", "/");
        return name.equals("readme.md")
                || name.equals("license")
                || name.equals("package-lock.json")
                || name.equals("yarn.lock")
                || name.equals("pnpm-lock.yaml")
                || name.endsWith(".class")
                || name.endsWith(".jar")
                || path.contains("/dist/")
                || path.contains("/build/")
                || path.contains("/target/")
                || path.contains("node_modules")
                || path.contains(".git");
    }

    private RepositoryResponse toResponse(RepositoryEntity entity) {
        String indexedAt = entity.getIndexedAt() != null
                ? entity.getIndexedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                : null;
        return new RepositoryResponse(
                entity.getId(), entity.getName(), entity.getOwner(), entity.getUrl(),
                entity.getStatus().name(), entity.getFileCount(), entity.getChunkCount(), indexedAt);
    }
}
