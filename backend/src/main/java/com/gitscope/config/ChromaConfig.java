package com.gitscope.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

@Configuration
@Getter
public class ChromaConfig {

    @Value("${chroma.api.url}")
    private String apiUrl;

    @Value("${chroma.collection-name}")
    private String collectionName;

    public String getBaseUrl() {
        return apiUrl;
    }
}
