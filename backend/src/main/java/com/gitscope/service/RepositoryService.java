package com.gitscope.service;

import com.gitscope.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Stateless repository ingestion coordinator.
 * Delegates the heavy-lifting of background worker ingestion to {@link CodebaseIngestionWorker}.
 */
@Service
@Slf4j
public class RepositoryService {

    private static final String DEFAULT_BRANCH = "main";

    private final CodebaseIngestionWorker codebaseIngestionWorker;

    public RepositoryService(CodebaseIngestionWorker codebaseIngestionWorker) {
        this.codebaseIngestionWorker = codebaseIngestionWorker;
    }

    /**
     * Accepts an indexing request, records the {@code INGESTING} status immediately,
     * and kicks off the background worker.
     */
    public IndexRepositoryResponse indexRepository(IndexRepositoryRequest request) {
        String url    = request.repositoryUrl().trim();
        String branch = (request.branch() != null && !request.branch().isBlank())
                        ? request.branch().trim()
                        : DEFAULT_BRANCH;
        String repoIdentifier = buildIdentifier(url, branch);

        log.info("Queuing ingestion for repoIdentifier={}", repoIdentifier);

        // Place initial placeholder details in the cache
        RepoDetails details = new RepoDetails(
                "INGESTING",
                0,
                0,
                Collections.emptyList(),
                Collections.emptyMap(),
                "Indexing started in the background. Please wait..."
        );
        codebaseIngestionWorker.getRepositoryCache().put(repoIdentifier, details);

        // Run background async task via Spring proxy bean to avoid thread blocking
        codebaseIngestionWorker.runIngestion(repoIdentifier, url, branch);

        return new IndexRepositoryResponse(repoIdentifier, "INGESTING",
                "Indexing started in the background. Poll /api/repositories/status?id=" + repoIdentifier);
    }

    /**
     * Returns the current ingestion status for the given {@code repoIdentifier}.
     */
    public RepoDetails getStatus(String repoIdentifier) {
        RepoDetails details = codebaseIngestionWorker.getRepositoryCache().get(repoIdentifier);
        if (details == null) {
            return new RepoDetails(
                    "NOT_FOUND",
                    0,
                    0,
                    Collections.emptyList(),
                    Collections.emptyMap(),
                    "Repository has not been queued or processed."
            );
        }
        return details;
    }

    /**
     * Returns a snapshot of all known repositories and their statuses.
     */
    public List<RepositoryResponse> getAllRepositories() {
        return codebaseIngestionWorker.getRepositoryCache().entrySet().stream()
                .map(entry -> {
                    String id = entry.getKey();
                    RepoDetails details = entry.getValue();
                    String[] parts = id.split("#", 2);
                    String url = parts[0];
                    String branch = parts.length > 1 ? parts[1] : DEFAULT_BRANCH;
                    return new RepositoryResponse(id, url, branch, details.getStatus(), details.getFileCount(), details.getChunkCount());
                })
                .collect(Collectors.toList());
    }

    /** Builds the composite unique identifier for a repository. */
    public static String buildIdentifier(String repoUrl, String branch) {
        return repoUrl.trim() + "#" + (branch != null && !branch.isBlank() ? branch.trim() : DEFAULT_BRANCH);
    }
}
