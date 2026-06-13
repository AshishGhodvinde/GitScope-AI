package com.gitscope.github;

import lombok.Builder;
import lombok.Getter;

/**
 * Represents a single code chunk extracted from a source file.
 * Carries content plus metadata for ChromaDB storage.
 */
@Getter
@Builder
public class CodeChunk {

    /** Unique identifier for this chunk */
    private final String id;

    /** Raw source content of the chunk */
    private final String content;

    /** Relative path from repo root (e.g. src/main/java/UserService.java) */
    private final String filePath;

    /** Detected language (java, javascript, typescript, etc.) */
    private final String language;

    /** Class name if chunk belongs to a class, or null */
    private final String className;

    /** Method name if chunk is a method, or null */
    private final String methodName;

    /** Type of chunk: CLASS, METHOD, COMPONENT, HOOK, ROUTE, FUNCTION, FILE */
    private final String chunkType;
}
