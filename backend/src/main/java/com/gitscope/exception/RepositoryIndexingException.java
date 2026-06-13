package com.gitscope.exception;

/**
 * Thrown when the repository cloning or indexing process fails.
 */
public class RepositoryIndexingException extends RuntimeException {
    public RepositoryIndexingException(String message) {
        super(message);
    }

    public RepositoryIndexingException(String message, Throwable cause) {
        super(message, cause);
    }
}
