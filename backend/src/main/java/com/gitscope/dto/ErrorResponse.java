package com.gitscope.dto;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Standardized error response DTO returned by the global exception handler.
 */
public record ErrorResponse(
        int status,
        String error,
        String message,
        String path,
        LocalDateTime timestamp,
        Map<String, String> fieldErrors
) {
    // Constructor for simple errors without field-level validation details
    public ErrorResponse(int status, String error, String message, String path) {
        this(status, error, message, path, LocalDateTime.now(), null);
    }
}
