package com.gitscope.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Request DTO for sending a chat question about a repository.
 */
public record ChatRequest(
        @NotNull(message = "Repository ID is required")
        @Positive(message = "Repository ID must be positive")
        Long repositoryId,

        @NotBlank(message = "Question is required")
        String question
) {}
