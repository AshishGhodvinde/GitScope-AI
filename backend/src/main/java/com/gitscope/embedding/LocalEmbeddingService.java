package com.gitscope.embedding;

import com.gitscope.exception.AIServiceException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

/**
 * Stateless local embedding service using the ONNX transformer model.
 *
 * <p>All embeddings are generated on-demand from the locally loaded model file.
 * The DB-backed EmbeddingCache has been removed — the in-process ONNX model is
 * fast enough that a persistent cache is not necessary.
 */
@Service
@Slf4j
public class LocalEmbeddingService {

    private final EmbeddingModel embeddingModel;

    public LocalEmbeddingService(EmbeddingModel embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    /**
     * Generates a single embedding vector for the given text using the local ONNX model.
     */
    public float[] getEmbedding(String text) {
        if (text == null || text.isBlank()) {
            return new float[0];
        }
        try {
            return embeddingModel.embed(text);
        } catch (Exception e) {
            log.error("Local ONNX embedding generation failed", e);
            throw new AIServiceException("Local embedding failed: " + e.getMessage(), e);
        }
    }

    /**
     * Generates embeddings for a batch of texts. Each text is embedded individually.
     */
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

    /**
     * Converts a {@code float[]} embedding to a {@code List<Double>} for ChromaDB JSON serialization.
     */
    public List<Double> toDoubleList(float[] embedding) {
        List<Double> result = new ArrayList<>(embedding.length);
        for (float v : embedding) {
            result.add((double) v);
        }
        return result;
    }

    /**
     * SHA-256 utility retained for potential future use (e.g., content deduplication).
     */
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
}
