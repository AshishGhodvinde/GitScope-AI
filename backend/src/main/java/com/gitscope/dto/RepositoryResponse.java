package com.gitscope.dto;

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
