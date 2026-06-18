package com.gitscope.dto;

public record SummaryResponse(
        Long repositoryId,
        String name,
        String summary
) {}
