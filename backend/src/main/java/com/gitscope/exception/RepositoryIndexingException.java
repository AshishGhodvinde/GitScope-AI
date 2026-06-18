package com.gitscope.exception;

public class RepositoryIndexingException extends RuntimeException {
    public RepositoryIndexingException(String message) {
        super(message);
    }

    public RepositoryIndexingException(String message, Throwable cause) {
        super(message, cause);
    }
}
