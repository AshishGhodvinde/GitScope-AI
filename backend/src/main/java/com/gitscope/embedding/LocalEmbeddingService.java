package com.gitscope.embedding;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gitscope.entity.EmbeddingCache;
import com.gitscope.exception.AIServiceException;
import com.gitscope.repository.EmbeddingCacheRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class LocalEmbeddingService {

    private final EmbeddingModel embeddingModel;
    private final EmbeddingCacheRepository embeddingCacheRepository;
    private final ObjectMapper objectMapper;

    public LocalEmbeddingService(EmbeddingModel embeddingModel,
                                 EmbeddingCacheRepository embeddingCacheRepository) {
        this.embeddingModel = embeddingModel;
        this.embeddingCacheRepository = embeddingCacheRepository;
        this.objectMapper = new ObjectMapper();
    }

    public String calculateSHA256(String text) {
        if (text == null) return "";
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(text.trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            log.error("Failed to compute SHA-256 hash", e);
            throw new AIServiceException("Hash generation failed: " + e.getMessage(), e);
        }
    }

    public float[] getEmbedding(String text) {
        if (text == null || text.isBlank()) {
            return new float[0];
        }

        String contentHash = calculateSHA256(text);
        Optional<EmbeddingCache> cached = embeddingCacheRepository.findByContentHash(contentHash);

        if (cached.isPresent()) {
            log.debug("Cache hit for embedding hash: {}", contentHash);
            return deserializeVector(cached.get().getVectorJson());
        }

        log.debug("Cache miss for embedding. Vectorizing locally in JVM...");
        float[] vector;
        try {
            vector = embeddingModel.embed(text);
        } catch (Exception e) {
            log.error("Local ONNX embedding generation failed", e);
            throw new AIServiceException("Local embedding failed: " + e.getMessage(), e);
        }

        EmbeddingCache cacheEntry = EmbeddingCache.builder()
                .contentHash(contentHash)
                .content(text)
                .vectorJson(serializeVector(vector))
                .build();
        try {
            embeddingCacheRepository.save(cacheEntry);
        } catch (Exception e) {
            log.warn("Failed to write embedding cache to database: {}", e.getMessage());
        }

        return vector;
    }

    public List<float[]> getEmbeddingsBatch(List<String> texts) {
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }
        List<float[]> results = new ArrayList<>(texts.size());
        for (String text : texts) {
            results.add(getEmbedding(text));
        }
        return results;
    }

    public List<Double> toDoubleList(float[] embedding) {
        List<Double> result = new ArrayList<>(embedding.length);
        for (float v : embedding) {
            result.add((double) v);
        }
        return result;
    }

    private String serializeVector(float[] vector) {
        try {
            return objectMapper.writeValueAsString(vector);
        } catch (Exception e) {
            throw new AIServiceException("Failed to serialize vector to JSON", e);
        }
    }

    private float[] deserializeVector(String json) {
        try {
            List<Double> list = objectMapper.readValue(json, new TypeReference<List<Double>>() {});
            float[] vector = new float[list.size()];
            for (int i = 0; i < list.size(); i++) {
                vector[i] = list.get(i).floatValue();
            }
            return vector;
        } catch (Exception e) {
            throw new AIServiceException("Failed to deserialize vector from JSON", e);
        }
    }
}
