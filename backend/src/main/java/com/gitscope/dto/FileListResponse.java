package com.gitscope.dto;

import java.util.List;

/**
 * Response DTO for the file explorer — lists all indexed file paths.
 */
public record FileListResponse(
        Long repositoryId,
        String repositoryName,
        List<String> files,
        Integer totalFiles
) {}
