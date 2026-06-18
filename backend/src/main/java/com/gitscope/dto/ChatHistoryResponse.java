package com.gitscope.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ChatHistoryResponse(
        Long id,
        Long repositoryId,
        String question,
        String answer,
        List<String> sources,
        LocalDateTime createdAt
) {}
