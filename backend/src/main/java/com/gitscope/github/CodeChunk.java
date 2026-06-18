package com.gitscope.github;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CodeChunk {

    private final String id;

    private final String content;

    private final String filePath;

    private final String language;

    private final String className;

    private final String methodName;

    private final String chunkType;
}
