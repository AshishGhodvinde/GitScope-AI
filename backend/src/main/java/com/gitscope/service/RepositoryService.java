package com.gitscope.service;

import com.gitscope.dto.*;
import com.gitscope.embedding.LocalEmbeddingService;
import com.gitscope.entity.FileEntity;
import com.gitscope.entity.RepositoryEntity;
import com.gitscope.entity.RepositoryEntity.IndexStatus;
import com.gitscope.exception.RepositoryIndexingException;
import com.gitscope.exception.RepositoryNotFoundException;
import com.gitscope.github.ChunkingService;
import com.gitscope.github.CodeChunk;
import com.gitscope.github.GitHubService;
import com.gitscope.rag.GeminiChatService;
import com.gitscope.repository.FileRepository;
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

@Service
@Slf4j
public class RepositoryService {

    private static final int BATCH_SIZE = 20; 

    private final GitHubService gitHubService;
    private final ChunkingService chunkingService;
    private final LocalEmbeddingService embeddingService;
    private final VectorStoreService vectorStoreService;
    private final GeminiChatService geminiChatService;
    private final RepositoryJpaRepository repositoryJpaRepository;
    private final FileRepository fileRepository;

    public RepositoryService(
            GitHubService gitHubService,
            ChunkingService chunkingService,
            LocalEmbeddingService embeddingService,
            VectorStoreService vectorStoreService,
            GeminiChatService geminiChatService,
            RepositoryJpaRepository repositoryJpaRepository,
            FileRepository fileRepository
    ) {
        this.gitHubService = gitHubService;
        this.chunkingService = chunkingService;
        this.embeddingService = embeddingService;
        this.vectorStoreService = vectorStoreService;
        this.geminiChatService = geminiChatService;
        this.repositoryJpaRepository = repositoryJpaRepository;
        this.fileRepository = fileRepository;
    }

    @Transactional
    public IndexRepositoryResponse indexRepository(IndexRepositoryRequest request) {
        String url = request.repositoryUrl().trim();
        String repoName = gitHubService.extractRepoName(url);
        String owner = gitHubService.extractOwner(url);

        log.info("Starting indexing for repository: {}/{}", owner, repoName);

        RepositoryEntity entity;
        if (repositoryJpaRepository.existsByUrl(url)) {
            entity = repositoryJpaRepository.findByUrl(url)
                    .orElseThrow(() -> new RepositoryNotFoundException(url));
            
            if (entity.getChromaCollectionId() != null) {
                vectorStoreService.deleteCollection(entity.getChromaCollectionId());
            }
            fileRepository.deleteByRepositoryId(entity.getId());
            entity.setStatus(IndexStatus.INDEXING);
            entity.setIndexedAt(LocalDateTime.now());
            entity.setSummary(null); 
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
            
            cloneDir = gitHubService.cloneRepository(url);

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

            List<CodeChunk> allChunks = new ArrayList<>();
            for (int i = 0; i < sourceFiles.size(); i++) {
                List<CodeChunk> fileChunks = chunkingService.chunkFile(sourceFiles.get(i), allFilePaths.get(i));
                allChunks.addAll(fileChunks);
            }
            List<CodeChunk> nonBlankChunks = allChunks.stream()
                    .filter(c -> c.getContent() != null && !c.getContent().trim().isEmpty())
                    .collect(Collectors.toList());
            log.info("Generated {} chunks ({} non-blank) from {} files", allChunks.size(), nonBlankChunks.size(), sourceFiles.size());

            String collectionName = "repo_" + entity.getId();
            String collectionId = vectorStoreService.getOrCreateCollection(collectionName);

            fileRepository.deleteByRepositoryId(entity.getId()); 
            List<FileEntity> fileEntities = new ArrayList<>();
            for (String path : allFilePaths) {
                fileEntities.add(FileEntity.builder()
                        .repositoryId(entity.getId())
                        .path(path)
                        .build());
            }
            fileRepository.saveAll(fileEntities);

            embedAndStore(nonBlankChunks, collectionId, entity.getId());

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
            
            entity.setStatus(IndexStatus.FAILED);
            repositoryJpaRepository.save(entity);
            log.error("Indexing failed for {}: {}", url, e.getMessage(), e);
            throw new RepositoryIndexingException("Indexing failed: " + e.getMessage(), e);
        } finally {
            
            if (cloneDir != null) {
                gitHubService.cleanupDirectory(cloneDir);
            }
        }
    }

    public RepositoryResponse getRepository(Long id) {
        RepositoryEntity entity = repositoryJpaRepository.findById(id)
                .orElseThrow(() -> new RepositoryNotFoundException(id));

        return toResponse(entity);
    }

    public SummaryResponse getSummary(Long id) {
        RepositoryEntity entity = repositoryJpaRepository.findById(id)
                .orElseThrow(() -> new RepositoryNotFoundException(id));

        if (entity.getStatus() != IndexStatus.INDEXED) {
            throw new RepositoryIndexingException("Repository is not fully indexed yet. Status: " + entity.getStatus());
        }

        if (entity.getSummary() != null && !entity.getSummary().isBlank()) {
            log.info("Returning cached summary for repository: {}", entity.getName());
            return new SummaryResponse(entity.getId(), entity.getName(), entity.getSummary());
        }

        log.info("Generating new summary via Gemini for repository: {}", entity.getName());

        float[] queryEmbedding = embeddingService.getEmbedding(
                "project overview architecture purpose tech stack modules");
        List<Double> queryVector = embeddingService.toDoubleList(queryEmbedding);

        List<VectorStoreService.SearchResult> results = vectorStoreService.query(
                entity.getChromaCollectionId(), queryVector, 10, entity.getId());

        String codeContext = results.stream()
                .map(r -> "File: " + r.filePath() + "\n" + r.content())
                .collect(Collectors.joining("\n\n---\n\n"));

        String summary = geminiChatService.generateSummary(entity.getName(), codeContext);

        entity.setSummary(summary);
        repositoryJpaRepository.save(entity);

        return new SummaryResponse(entity.getId(), entity.getName(), summary);
    }

    public List<FileEntity> getFiles(Long id) {
        
        repositoryJpaRepository.findById(id)
                .orElseThrow(() -> new RepositoryNotFoundException(id));
        return fileRepository.findByRepositoryId(id);
    }

    public List<RepositoryResponse> getAllRepositories() {
        return repositoryJpaRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    private void embedAndStore(List<CodeChunk> chunks, String collectionId, Long repositoryId) {
        for (int i = 0; i < chunks.size(); i += BATCH_SIZE) {
            List<CodeChunk> batch = chunks.subList(i, Math.min(i + BATCH_SIZE, chunks.size()));
            List<String> contents = batch.stream().map(CodeChunk::getContent).collect(Collectors.toList());

            List<float[]> rawEmbeddings;
            try {
                
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

            vectorStoreService.upsertChunks(collectionId, repositoryId, batch, embeddings);
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
