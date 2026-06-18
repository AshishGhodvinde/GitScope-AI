package com.gitscope.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record IndexRepositoryRequest(
        @NotBlank(message = "Repository URL is required")
        @Pattern(
                regexp = "https://github\\.com/[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+",
                message = "Must be a valid public GitHub repository URL"
        )
        String repositoryUrl
) {}
