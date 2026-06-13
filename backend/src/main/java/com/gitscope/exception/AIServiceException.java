package com.gitscope.exception;

/**
 * Thrown when communication with the Gemini API or ChromaDB fails.
 */
public class AIServiceException extends RuntimeException {
    public AIServiceException(String message) {
        super(message);
    }

    public AIServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
