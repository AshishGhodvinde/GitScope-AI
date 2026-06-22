package com.gitscope.dto;

public record ChatMessageDto(
        String role, // "user" or "model"
        String content
) {}
