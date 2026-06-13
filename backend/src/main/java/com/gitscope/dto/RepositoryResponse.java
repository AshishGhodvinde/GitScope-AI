package com.gitscope.dto;

/**
 * Response DTO for repository metadata and summary.
 */
public record RepositoryResponse(
        Long id,
        String name,
        String owner,
        String url,
        String status,
        Integer fileCount,
        Integer chunkCount,
        String indexedAt
) {}
