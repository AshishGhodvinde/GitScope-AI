package com.gitscope.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * ChromaDB configuration — host, port and collection name injected from environment.
 */
@Configuration
@Getter
public class ChromaConfig {

    @Value("${chroma.host}")
    private String host;

    @Value("${chroma.port}")
    private int port;

    @Value("${chroma.collection-name}")
    private String collectionName;

    /**
     * Returns the base URL for the ChromaDB HTTP API.
     */
    public String getBaseUrl() {
        return "http://" + host + ":" + port;
    }
}
