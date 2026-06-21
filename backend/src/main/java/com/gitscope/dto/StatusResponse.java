package com.gitscope.dto;

public record StatusResponse(
        String repoIdentifier,
        String status,
        String message
) {}
