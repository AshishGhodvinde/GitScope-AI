package com.gitscope.exception;

public class RepositoryNotFoundException extends RuntimeException {
    public RepositoryNotFoundException(Long id) {
        super("Repository not found with id: " + id);
    }

    public RepositoryNotFoundException(String url) {
        super("Repository not found with URL: " + url);
    }
}
