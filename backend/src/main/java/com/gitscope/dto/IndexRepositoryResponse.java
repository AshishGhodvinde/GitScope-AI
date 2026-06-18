package com.gitscope.dto;

public record IndexRepositoryResponse(
        Long repositoryId,
        String name,
        String owner,
        String status,
        Integer fileCount,
        Integer chunkCount
) {}
