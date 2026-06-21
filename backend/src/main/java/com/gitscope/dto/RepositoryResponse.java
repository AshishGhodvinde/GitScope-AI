package com.gitscope.dto;

public record RepositoryResponse(
        String repoIdentifier,
        String repoUrl,
        String branch,
        String status,
        Integer fileCount,
        Integer chunkCount
) {}
