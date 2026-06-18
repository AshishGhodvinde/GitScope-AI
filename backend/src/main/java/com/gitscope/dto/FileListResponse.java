package com.gitscope.dto;

import java.util.List;

public record FileListResponse(
        Long repositoryId,
        String repositoryName,
        List<String> files,
        Integer totalFiles
) {}
