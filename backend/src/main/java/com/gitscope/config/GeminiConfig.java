package com.gitscope.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Gemini API configuration — reads all values from application.yml / environment variables.
 *
 * NOTE: Gemini is used exclusively for:
 *   1. Generating repository summaries
 *   2. Answering user questions (RAG generation step)
 *
 * Embeddings are handled locally via Spring AI ONNX (all-MiniLM-L6-v2),
 * consuming ZERO Gemini API quota during indexing.
 */
@Configuration
@Getter
public class GeminiConfig {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.base-url}")
    private String baseUrl;

    @Value("${gemini.api.model}")
    private String model;
}
