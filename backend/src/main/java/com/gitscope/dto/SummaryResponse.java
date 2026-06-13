package com.gitscope.dto;

/**
 * Response DTO carrying the AI-generated summary of a repository.
 */
public record SummaryResponse(
        Long repositoryId,
        String name,
        String summary
) {}
