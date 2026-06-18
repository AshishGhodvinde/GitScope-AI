package com.gitscope.vectorstore;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gitscope.config.ChromaConfig;
import com.gitscope.exception.AIServiceException;
import com.gitscope.github.CodeChunk;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
@Slf4j
public class VectorStoreService {

    private static final String DEFAULT_TENANT   = "default_tenant";
    private static final String DEFAULT_DATABASE = "default_database";

    private final RestTemplate restTemplate;
    private final ChromaConfig chromaConfig;
    private final ObjectMapper objectMapper;

    public VectorStoreService(RestTemplate restTemplate, ChromaConfig chromaConfig) {
        this.restTemplate = restTemplate;
        this.chromaConfig = chromaConfig;
        this.objectMapper = new ObjectMapper();
    }

    private String collectionsUrl() {
        return chromaConfig.getBaseUrl()
                + "/api/v2/tenants/" + DEFAULT_TENANT
                + "/databases/" + DEFAULT_DATABASE
                + "/collections";
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }

    public String getOrCreateCollection(String collectionName) {
        
        forceDeleteCollectionByName(collectionName);

        String url = collectionsUrl();
        Map<String, Object> body = Map.of(
                "name", collectionName,
                "get_or_create", true
        );
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, jsonHeaders());

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);

            if (response.getBody() == null) {
                throw new AIServiceException("Empty response from ChromaDB when creating collection");
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            String collectionId = root.path("id").asText();
            log.info("ChromaDB collection created: {} (id={})", collectionName, collectionId);
            return collectionId;

        } catch (AIServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new AIServiceException("Failed to create ChromaDB collection: " + e.getMessage(), e);
        }
    }

    public void upsertChunks(String collectionId, Long repositoryId, List<CodeChunk> chunks, List<List<Double>> embeddings) {
        String url = collectionsUrl() + "/" + collectionId + "/upsert";

        List<String> ids = new ArrayList<>();
        List<String> documents = new ArrayList<>();
        List<Map<String, Object>> metadatas = new ArrayList<>();

        for (int i = 0; i < chunks.size(); i++) {
            CodeChunk chunk = chunks.get(i);
            ids.add(chunk.getId());
            documents.add(chunk.getContent());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("filePath", chunk.getFilePath());
            metadata.put("language", chunk.getLanguage());
            metadata.put("chunkType", chunk.getChunkType());
            metadata.put("repository_id", String.valueOf(repositoryId));
            if (chunk.getClassName()  != null) metadata.put("className",  chunk.getClassName());
            if (chunk.getMethodName() != null) metadata.put("methodName", chunk.getMethodName());
            metadatas.add(metadata);
        }

        Map<String, Object> body = Map.of(
                "ids",        ids,
                "documents",  documents,
                "embeddings", embeddings,
                "metadatas",  metadatas
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, jsonHeaders());

        try {
            restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            log.debug("Upserted {} chunks into ChromaDB collection {}", chunks.size(), collectionId);
        } catch (Exception e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("dimension")) {
                throw new AIServiceException(
                    "Embedding dimension mismatch in ChromaDB. " +
                    "A stale collection with a different model's dimensions was found. " +
                    "Run: docker volume rm <chroma_volume> and restart. Details: " + msg, e);
            }
            throw new AIServiceException("Failed to upsert chunks into ChromaDB: " + msg, e);
        }
    }

    public List<SearchResult> query(String collectionId, List<Double> queryEmbedding, int topK, Long repositoryId) {
        String url = collectionsUrl() + "/" + collectionId + "/query";

        Map<String, Object> body = Map.of(
                "query_embeddings", List.of(queryEmbedding),
                "n_results",        topK,
                "where",            Map.of("repository_id", String.valueOf(repositoryId)),
                "include",          List.of("documents", "metadatas", "distances")
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, jsonHeaders());

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);

            if (response.getBody() == null) {
                return List.of();
            }

            return parseQueryResults(response.getBody());

        } catch (Exception e) {
            throw new AIServiceException("ChromaDB query failed: " + e.getMessage(), e);
        }
    }

    public void deleteCollection(String collectionIdOrName) {
        if (collectionIdOrName == null || collectionIdOrName.isBlank()) return;
        String url = collectionsUrl() + "/" + collectionIdOrName;
        try {
            restTemplate.delete(url);
            log.info("Deleted ChromaDB collection: {}", collectionIdOrName);
        } catch (Exception e) {
            log.debug("Could not delete ChromaDB collection {} (may not exist): {}",
                    collectionIdOrName, e.getMessage());
        }
    }

    private void forceDeleteCollectionByName(String collectionName) {
        
        String url = collectionsUrl() + "/" + collectionName;
        try {
            restTemplate.delete(url);
            log.info("Pre-deleted stale ChromaDB collection '{}' before recreation.", collectionName);
        } catch (Exception e) {
            
            log.debug("No stale collection '{}' to delete ({})", collectionName, e.getMessage());
        }
    }

    private List<SearchResult> parseQueryResults(String json) {
        List<SearchResult> results = new ArrayList<>();
        try {
            JsonNode root      = objectMapper.readTree(json);
            JsonNode docs      = root.path("documents").get(0);
            JsonNode metas     = root.path("metadatas").get(0);
            JsonNode distances = root.path("distances").get(0);

            if (docs == null || !docs.isArray()) return results;

            for (int i = 0; i < docs.size(); i++) {
                String   content    = docs.get(i).asText();
                JsonNode meta       = metas     != null ? metas.get(i)     : null;
                double   distance   = distances != null && distances.get(i) != null
                                      ? distances.get(i).asDouble() : 1.0;

                String filePath   = meta != null ? meta.path("filePath").asText("")   : "";
                String language   = meta != null ? meta.path("language").asText("")   : "";
                String className  = meta != null ? meta.path("className").asText(null)  : null;
                String methodName = meta != null ? meta.path("methodName").asText(null) : null;

                results.add(new SearchResult(content, filePath, language, className, methodName, distance));
            }
        } catch (Exception e) {
            log.error("Failed to parse ChromaDB query results", e);
        }
        return results;
    }

    public record SearchResult(
            String content,
            String filePath,
            String language,
            String className,
            String methodName,
            double distance
    ) {}
}
