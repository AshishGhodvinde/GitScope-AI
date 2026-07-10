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
import org.springframework.web.client.HttpClientErrorException;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Stateless ChromaDB adapter.
 *
 * All vector operations are scoped by a composite {@code repoIdentifier}
 * (format: {@code repoUrl#branch}) stored as a metadata field on every document.
 * There are no relational DB IDs involved.
 */
@Service
@Slf4j
public class VectorStoreService {

    private static final String DEFAULT_TENANT   = "default_tenant";
    private static final String DEFAULT_DATABASE = "default_database";
    // Single shared collection — all repos live here, differentiated by metadata
    private static final String COLLECTION_NAME  = "gitscope_chunks";

    private final RestTemplate restTemplate;
    private final ChromaConfig chromaConfig;
    private final ObjectMapper objectMapper;

    // Cached collection ID to avoid re-fetching on every request
    private volatile String cachedCollectionId = null;

    public VectorStoreService(RestTemplate restTemplate, ChromaConfig chromaConfig) {
        this.restTemplate = restTemplate;
        this.chromaConfig = chromaConfig;
        this.objectMapper = new ObjectMapper();
    }

    // -----------------------------------------------------------------------
    // URL helpers
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Collection lifecycle
    // -----------------------------------------------------------------------

    /**
     * Returns the ChromaDB collection ID for the shared {@code gitscope_chunks} collection,
     * creating it if it does not exist. Result is cached in-process.
     */
    public String getOrCreateSharedCollection() {
        if (cachedCollectionId != null) return cachedCollectionId;

        String url = collectionsUrl();
        Map<String, Object> body = Map.of(
                "name", COLLECTION_NAME,
                "get_or_create", true
        );
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, jsonHeaders());

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (response.getBody() == null) {
                throw new AIServiceException("Empty response from ChromaDB when creating collection");
            }
            JsonNode root = objectMapper.readTree(response.getBody());
            cachedCollectionId = root.path("id").asText();
            log.info("ChromaDB shared collection ready: {} (id={})", COLLECTION_NAME, cachedCollectionId);
            return cachedCollectionId;
        } catch (AIServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new AIServiceException("Failed to get/create ChromaDB collection: " + e.getMessage(), e);
        }
    }

    /**
     * Defensive check that pings the server to ensure the collection exists.
     * If the collection is deleted on the server, it clears cachedCollectionId and boots it.
     */
    private void ensureCollectionExists() {
        if (cachedCollectionId == null) {
            getOrCreateSharedCollection();
            return;
        }
        try {
            String url = collectionsUrl() + "/" + COLLECTION_NAME;
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                return;
            }
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("Collection {} not found on server. Clearing cache and bootstrapping.", COLLECTION_NAME);
            cachedCollectionId = null;
            getOrCreateSharedCollection();
        } catch (Exception e) {
            log.warn("Failed to check collection existence, relying on cache: {}", e.getMessage());
            if (cachedCollectionId == null) {
                getOrCreateSharedCollection();
            }
        }
    }

    // -----------------------------------------------------------------------
    // Ghost-chunk purge
    // -----------------------------------------------------------------------

    /**
     * Deletes all vectors whose {@code repoIdentifier} metadata matches the given value.
     * Called before each ingestion run to ensure clean upserts with no ghost chunks.
     */
    public void deleteByRepoIdentifier(String repoIdentifier) {
        try {
            ensureCollectionExists();
            performDelete(repoIdentifier);
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("Collection not found during delete for {}. Clearing cache and retrying.", repoIdentifier);
            cachedCollectionId = null;
            try {
                ensureCollectionExists();
                performDelete(repoIdentifier);
            } catch (Exception ex) {
                log.error("Retry purge failed for repoIdentifier={}: {}", repoIdentifier, ex.getMessage(), ex);
            }
        } catch (Exception e) {
            log.error("Failed to purge vectors for repoIdentifier={} (error during delete): {}", repoIdentifier, e.getMessage(), e);
        }
    }

    private void performDelete(String repoIdentifier) {
        String collectionId = getOrCreateSharedCollection();
        String url = collectionsUrl() + "/" + collectionId + "/delete";

        Map<String, Object> whereClause = Map.of("repoIdentifier", Map.of("$eq", repoIdentifier));
        Map<String, Object> body = Map.of("where", whereClause);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, jsonHeaders());

        restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        log.info("Purged all vectors for repoIdentifier={}", repoIdentifier);
    }

    // -----------------------------------------------------------------------
    // Upsert
    // -----------------------------------------------------------------------

    /**
     * Stores chunks into ChromaDB with deterministic UUIDs and repoIdentifier metadata.
     * IDs are derived deterministically from {@code repoIdentifier + "-" + filePath + "-" + chunkIndex}
     * using UUID.nameUUIDFromBytes, ensuring perfect idempotent upserts.
     */
    public void upsertChunks(String repoIdentifier, List<CodeChunk> chunks, List<List<Double>> embeddings) {
        try {
            ensureCollectionExists();
            performUpsert(repoIdentifier, chunks, embeddings);
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("Collection not found during upsert for {}. Clearing cache and retrying.", repoIdentifier);
            cachedCollectionId = null;
            try {
                ensureCollectionExists();
                performUpsert(repoIdentifier, chunks, embeddings);
            } catch (Exception ex) {
                log.error("Retry upsert failed for repoIdentifier={}: {}", repoIdentifier, ex.getMessage(), ex);
                throw new AIServiceException("Failed to upsert chunks into ChromaDB on retry: " + ex.getMessage(), ex);
            }
        } catch (Exception e) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("dimension")) {
                throw new AIServiceException(
                    "Embedding dimension mismatch in ChromaDB. " +
                    "A stale collection with a different model's dimensions was detected. " +
                    "Restart with a fresh ChromaDB volume. Details: " + msg, e);
            }
            log.error("Upsert failed for repoIdentifier={}: {}", repoIdentifier, msg, e);
            throw new AIServiceException("Failed to upsert chunks into ChromaDB: " + msg, e);
        }
    }

    private void performUpsert(String repoIdentifier, List<CodeChunk> chunks, List<List<Double>> embeddings) {
        String collectionId = getOrCreateSharedCollection();
        String url = collectionsUrl() + "/" + collectionId + "/upsert";

        List<String> ids          = new ArrayList<>();
        List<String> documents    = new ArrayList<>();
        List<Map<String, Object>> metadatas = new ArrayList<>();

        for (int i = 0; i < chunks.size(); i++) {
            CodeChunk chunk = chunks.get(i);

            // Deterministic UUID
            String uniqueKey = repoIdentifier + "-" + chunk.getFilePath() + "-" + i;
            String deterministicId = UUID.nameUUIDFromBytes(
                    uniqueKey.getBytes(StandardCharsets.UTF_8)).toString();

            ids.add(deterministicId);
            documents.add(chunk.getContent());

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("repoIdentifier", repoIdentifier);
            metadata.put("filePath",        chunk.getFilePath());
            metadata.put("language",        chunk.getLanguage());
            metadata.put("chunkType",       chunk.getChunkType());
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
        restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        log.debug("Upserted {} chunks into ChromaDB for repoIdentifier={}", chunks.size(), repoIdentifier);
    }

    // -----------------------------------------------------------------------
    // Query
    // -----------------------------------------------------------------------

    /**
     * Runs a vector similarity search scoped strictly to the given {@code repoIdentifier}.
     */
    public List<SearchResult> queryByRepoIdentifier(
            String repoIdentifier, List<Double> queryEmbedding, int topK) {
        try {
            ensureCollectionExists();
            return performQuery(repoIdentifier, queryEmbedding, topK);
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("Collection not found during query for {}. Clearing cache and retrying.", repoIdentifier);
            cachedCollectionId = null;
            try {
                ensureCollectionExists();
                return performQuery(repoIdentifier, queryEmbedding, topK);
            } catch (Exception ex) {
                log.error("Retry query failed for repoIdentifier={}: {}", repoIdentifier, ex.getMessage(), ex);
                throw new AIServiceException("ChromaDB query failed on retry: " + ex.getMessage(), ex);
            }
        } catch (Exception e) {
            log.error("ChromaDB query failed for repoIdentifier={}: {}", repoIdentifier, e.getMessage());
            throw new AIServiceException("ChromaDB query failed: " + e.getMessage(), e);
        }
    }

    private List<SearchResult> performQuery(String repoIdentifier, List<Double> queryEmbedding, int topK) {
        String collectionId = getOrCreateSharedCollection();
        String url = collectionsUrl() + "/" + collectionId + "/query";

        Map<String, Object> whereClause = Map.of("repoIdentifier", Map.of("$eq", repoIdentifier));

        Map<String, Object> body = Map.of(
                "query_embeddings", List.of(queryEmbedding),
                "n_results",        topK,
                "where",            whereClause,
                "include",          List.of("documents", "metadatas", "distances")
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, jsonHeaders());
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        if (response.getBody() == null) {
            return List.of();
        }
        return parseQueryResults(response.getBody());
    }

    // -----------------------------------------------------------------------
    // Legacy compatibility shim (kept for VectorStoreService.deleteCollection)
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private List<SearchResult> parseQueryResults(String json) {
        List<SearchResult> results = new ArrayList<>();
        try {
            JsonNode root      = objectMapper.readTree(json);
            JsonNode docs      = root.path("documents").get(0);
            JsonNode metas     = root.path("metadatas").get(0);
            JsonNode distances = root.path("distances").get(0);

            if (docs == null || !docs.isArray()) return results;

            for (int i = 0; i < docs.size(); i++) {
                String   content  = docs.get(i).asText();
                JsonNode meta     = metas     != null ? metas.get(i)     : null;
                double   distance = distances != null && distances.get(i) != null
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

    // -----------------------------------------------------------------------
    // Result type
    // -----------------------------------------------------------------------

    public record SearchResult(
            String content,
            String filePath,
            String language,
            String className,
            String methodName,
            double distance
    ) {}
}
