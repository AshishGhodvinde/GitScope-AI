package com.gitscope.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.util.List;


public record ChatRequest(
        @NotBlank(message = "Repository URL is required")
        @Pattern(
                regexp = "https://github\\.com/[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+.*",
                message = "Must be a valid public GitHub repository URL"
        )
        String repoUrl,

        String branch,

        @NotBlank(message = "Question is required")
        String question,

        List<ChatMessageDto> history
) {}
