package com.gitscope.dto;

import java.util.List;
import com.gitscope.vectorstore.VectorStoreService.SearchResult;

public record ChatResponse(
        String answer,
        List<String> sources,
        List<SearchResult> segments
) {}
