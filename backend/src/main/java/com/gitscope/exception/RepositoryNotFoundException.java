package com.gitscope.exception;

/**
 * Thrown when a requested repository is not found in the database.
 */
public class RepositoryNotFoundException extends RuntimeException {
    public RepositoryNotFoundException(Long id) {
        super("Repository not found with id: " + id);
    }

    public RepositoryNotFoundException(String url) {
        super("Repository not found with URL: " + url);
    }
}
