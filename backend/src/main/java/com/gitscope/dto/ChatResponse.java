package com.gitscope.dto;

import java.util.List;
import com.gitscope.vectorstore.VectorStoreService.SearchResult;

/**
 * Response DTO carrying the AI answer, source files, and retrieved code segments.
 */
public record ChatResponse(
        String answer,
        List<String> sources,
        List<SearchResult> segments
) {}
