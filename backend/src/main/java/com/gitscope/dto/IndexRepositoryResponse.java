package com.gitscope.dto;

/**
 * Response DTO returned after a repository is successfully indexed.
 */
public record IndexRepositoryResponse(
        Long repositoryId,
        String name,
        String owner,
        String status,
        Integer fileCount,
        Integer chunkCount
) {}
