package com.gitscope.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO for a single chat history entry.
 */
public record ChatHistoryResponse(
        Long id,
        Long repositoryId,
        String question,
        String answer,
        List<String> sources,
        LocalDateTime createdAt
) {}
