package com.gitscope.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ChatRequest(
        @NotNull(message = "Repository ID is required")
        @Positive(message = "Repository ID must be positive")
        Long repositoryId,

        @NotBlank(message = "Question is required")
        String question
) {}
