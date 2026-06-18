package com.gitscope.service;

import com.gitscope.dto.ChatHistoryResponse;
import com.gitscope.dto.ChatRequest;
import com.gitscope.dto.ChatResponse;
import com.gitscope.embedding.LocalEmbeddingService;
import com.gitscope.entity.ChatHistory;
import com.gitscope.entity.EmbeddingCache;
import com.gitscope.entity.RepositoryEntity;
import com.gitscope.entity.RepositoryEntity.IndexStatus;
import com.gitscope.exception.RepositoryIndexingException;
import com.gitscope.exception.RepositoryNotFoundException;
import com.gitscope.rag.GeminiChatModel;
import com.gitscope.rag.GeminiChatService;
import com.gitscope.repository.ChatHistoryJpaRepository;
import com.gitscope.repository.EmbeddingCacheRepository;
import com.gitscope.repository.RepositoryJpaRepository;
import com.gitscope.vectorstore.VectorStoreService;
import com.gitscope.vectorstore.VectorStoreService.SearchResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ChatService {

    @Value("${rag.top-k:12}")
    private int topK;

    private final LocalEmbeddingService embeddingService;
    private final VectorStoreService vectorStoreService;
    private final GeminiChatService geminiChatService;
    private final GeminiChatModel geminiChatModel;
    private final RepositoryJpaRepository repositoryJpaRepository;
    private final ChatHistoryJpaRepository chatHistoryJpaRepository;
    private final EmbeddingCacheRepository embeddingCacheRepository;

    public ChatService(
            LocalEmbeddingService embeddingService,
            VectorStoreService vectorStoreService,
            GeminiChatService geminiChatService,
            GeminiChatModel geminiChatModel,
            RepositoryJpaRepository repositoryJpaRepository,
            ChatHistoryJpaRepository chatHistoryJpaRepository,
            EmbeddingCacheRepository embeddingCacheRepository
    ) {
        this.embeddingService = embeddingService;
        this.vectorStoreService = vectorStoreService;
        this.geminiChatService = geminiChatService;
        this.geminiChatModel = geminiChatModel;
        this.repositoryJpaRepository = repositoryJpaRepository;
        this.chatHistoryJpaRepository = chatHistoryJpaRepository;
        this.embeddingCacheRepository = embeddingCacheRepository;
    }

    @Transactional
    @Deprecated
    public ChatResponse chat(ChatRequest request) {
        RepositoryEntity repo = repositoryJpaRepository.findById(request.repositoryId())
                .orElseThrow(() -> new RepositoryNotFoundException(request.repositoryId()));

        if (repo.getStatus() != IndexStatus.INDEXED) {
            throw new RepositoryIndexingException(
                    "Repository is not indexed yet. Current status: " + repo.getStatus());
        }

        log.info("Processing blocking chat question for repo={}: '{}'",
                repo.getName(), request.question());

        float[] questionEmbedding = embeddingService.getEmbedding(request.question());
        List<Double> questionVector = embeddingService.toDoubleList(questionEmbedding);

        Filter.Expression metaFilter = new FilterExpressionBuilder()
                .eq("repository_id", String.valueOf(repo.getId()))
                .build();

        SearchRequest searchRequest = SearchRequest.builder()
                .query(request.question())
                .topK(8) 
                .filterExpression(metaFilter) 
                .similarityThreshold(0.5)
                .build();

        List<SearchResult> semanticChunks = vectorStoreService.query(
                repo.getChromaCollectionId(), questionVector, 8, repo.getId());

        List<String> keywords = extractKeywords(request.question());
        List<SearchResult> lexicalChunks = new ArrayList<>();
        Set<String> seenLexicalContents = new HashSet<>();
        outerLoop:
        for (String kw : keywords) {
            List<EmbeddingCache> matches = embeddingCacheRepository.findExactMatches(kw);
            for (EmbeddingCache match : matches) {
                if (match.getContent() == null || match.getContent().isBlank()) continue;
                String contentHash = calculateSHA256(match.getContent());
                if (!seenLexicalContents.contains(contentHash)) {
                    seenLexicalContents.add(contentHash);
                    lexicalChunks.add(new SearchResult(
                            match.getContent(),
                            "Lexical Match (" + kw + ")",
                            "java",
                            null,
                            null,
                            0.0
                    ));
                    if (lexicalChunks.size() >= 4) {
                        break outerLoop;
                    }
                }
            }
        }

        List<SearchResult> deduplicatedChunks = rrfFuse(semanticChunks, lexicalChunks);

        if (deduplicatedChunks.isEmpty()) {
            log.warn("No chunks retrieved for question in repo={}", repo.getName());
            return new ChatResponse("Information not found in repository.", List.of(), List.of());
        }

        log.info("Retrieved {} hybrid chunks ({} semantic, {} lexical, {} deduplicated via RRF)",
                (semanticChunks.size() + lexicalChunks.size()), semanticChunks.size(), lexicalChunks.size(), deduplicatedChunks.size());

        String answer = geminiChatService.generateAnswer(request.question(), deduplicatedChunks);

        List<String> sources = deduplicatedChunks.stream()
                .map(SearchResult::filePath)
                .filter(fp -> fp != null && !fp.isBlank())
                .distinct()
                .sorted()
                .toList();

        ChatHistory history = ChatHistory.builder()
                .repositoryId(request.repositoryId())
                .question(request.question())
                .answer(answer)
                .sources(String.join(",", sources))
                .build();
        chatHistoryJpaRepository.save(history);

        log.info("Chat completed for repo={}, {} sources cited", repo.getName(), sources.size());
        return new ChatResponse(answer, sources, deduplicatedChunks);
    }

    @Transactional
    public Flux<String> chatStream(ChatRequest request) {
        RepositoryEntity repo = repositoryJpaRepository.findById(request.repositoryId())
                .orElseThrow(() -> new RepositoryNotFoundException(request.repositoryId()));

        if (repo.getStatus() != IndexStatus.INDEXED) {
            throw new RepositoryIndexingException(
                    "Repository is not indexed yet. Current status: " + repo.getStatus());
        }

        log.info("Processing reactive streaming chat query for repo={}: '{}'",
                repo.getName(), request.question());

        float[] questionEmbedding = embeddingService.getEmbedding(request.question());
        List<Double> questionVector = embeddingService.toDoubleList(questionEmbedding);

        Filter.Expression metaFilter = new FilterExpressionBuilder()
                .eq("repository_id", String.valueOf(repo.getId()))
                .build();

        SearchRequest searchRequest = SearchRequest.builder()
                .query(request.question())
                .topK(8) 
                .filterExpression(metaFilter) 
                .similarityThreshold(0.5)
                .build();

        List<SearchResult> semanticChunks = vectorStoreService.query(
                repo.getChromaCollectionId(), questionVector, 8, repo.getId());

        List<String> keywords = extractKeywords(request.question());
        List<SearchResult> lexicalChunks = new ArrayList<>();
        Set<String> seenLexicalContents = new HashSet<>();
        outerLoop:
        for (String kw : keywords) {
            List<EmbeddingCache> matches = embeddingCacheRepository.findExactMatches(kw);
            for (EmbeddingCache match : matches) {
                if (match.getContent() == null || match.getContent().isBlank()) continue;
                String contentHash = calculateSHA256(match.getContent());
                if (!seenLexicalContents.contains(contentHash)) {
                    seenLexicalContents.add(contentHash);
                    lexicalChunks.add(new SearchResult(
                            match.getContent(),
                            "Lexical Match (" + kw + ")",
                            "java",
                            null,
                            null,
                            0.0
                    ));
                    if (lexicalChunks.size() >= 4) {
                        break outerLoop;
                    }
                }
            }
        }

        List<SearchResult> deduplicatedChunks = rrfFuse(semanticChunks, lexicalChunks);

        if (deduplicatedChunks.isEmpty()) {
            log.warn("No chunks retrieved for question in repo={}", repo.getName());
            return Flux.just("Information not found in repository.");
        }

        log.info("RRF complete. Grounding context loaded with {} deduplicated chunks", deduplicatedChunks.size());

        String promptText = geminiChatService.buildPrompt(request.question(), deduplicatedChunks);
        
        List<String> sources = deduplicatedChunks.stream()
                .map(SearchResult::filePath)
                .filter(fp -> fp != null && !fp.isBlank())
                .distinct()
                .sorted()
                .toList();

        StringBuilder fullAnswer = new StringBuilder();

        return geminiChatModel.stream(new Prompt(promptText))
                .map(response -> response.getResult().getOutput().getText())
                .doOnNext(fullAnswer::append)
                .doOnComplete(() -> {
                    try {
                        ChatHistory history = ChatHistory.builder()
                                .repositoryId(request.repositoryId())
                                .question(request.question())
                                .answer(fullAnswer.toString())
                                .sources(String.join(",", sources))
                                .build();
                        chatHistoryJpaRepository.save(history);
                        log.info("Persisted stream chat history successfully");
                    } catch (Exception e) {
                        log.error("Failed to save streaming chat history", e);
                    }
                });
    }

    private static class RrfItem {
        final SearchResult result;
        final String hash;
        double score = 0.0;

        RrfItem(SearchResult result, String hash) {
            this.result = result;
            this.hash = hash;
        }
    }

    private List<SearchResult> rrfFuse(List<SearchResult> semanticChunks, List<SearchResult> lexicalChunks) {
        double k = 60.0;
        Map<String, RrfItem> rrfMap = new HashMap<>();

        for (int i = 0; i < semanticChunks.size(); i++) {
            SearchResult sr = semanticChunks.get(i);
            if (sr.content() == null || sr.content().isBlank()) continue;
            String hash = calculateSHA256(sr.content());
            RrfItem item = rrfMap.computeIfAbsent(hash, h -> new RrfItem(sr, h));
            item.score += 1.0 / (k + (i + 1));
        }

        for (int i = 0; i < lexicalChunks.size(); i++) {
            SearchResult sr = lexicalChunks.get(i);
            if (sr.content() == null || sr.content().isBlank()) continue;
            String hash = calculateSHA256(sr.content());
            RrfItem item = rrfMap.computeIfAbsent(hash, h -> new RrfItem(sr, h));
            item.score += 1.0 / (k + (i + 1));
        }

        List<RrfItem> sortedRrf = new ArrayList<>(rrfMap.values());
        sortedRrf.sort((a, b) -> Double.compare(b.score, a.score));

        return sortedRrf.stream()
                .limit(8)
                .map(item -> item.result)
                .collect(Collectors.toList());
    }

    private List<String> extractKeywords(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        
        String cleanQuery = query.replaceAll("[^a-zA-Z0-9_\\s]", " ");
        String[] words = cleanQuery.split("\\s+");

        Set<String> stopWords = Set.of(
            "what", "how", "why", "who", "where", "when", "does", "do", "did", "is", "are", "was", "were",
            "the", "a", "an", "this", "that", "these", "those", "here", "there", "in", "on", "at", "by",
            "for", "with", "about", "against", "between", "into", "through", "during", "before", "after",
            "above", "below", "to", "from", "up", "down", "of", "and", "or", "but", "if", "then", "else",
            "any", "all", "some", "none", "each", "every", "other", "another", "such", "own", "code",
            "project", "repository", "repo", "program", "application", "app", "file", "class", "method",
            "function", "variable", "interface", "package", "dependency", "dependencies"
        );

        List<String> keywords = new ArrayList<>();
        for (String w : words) {
            String lw = w.trim().toLowerCase();
            if (lw.length() >= 3 && !stopWords.contains(lw)) {
                keywords.add(w.trim());
            }
        }
        return keywords;
    }

    private String calculateSHA256(String text) {
        if (text == null) return "";
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(text.trim().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            log.error("Failed to compute SHA-256 hash", e);
            return text;
        }
    }

    public List<ChatHistoryResponse> getHistory(Long repositoryId) {
        
        repositoryJpaRepository.findById(repositoryId)
                .orElseThrow(() -> new RepositoryNotFoundException(repositoryId));

        return chatHistoryJpaRepository.findByRepositoryIdOrderByCreatedAtDesc(repositoryId)
                .stream()
                .map(h -> new ChatHistoryResponse(
                        h.getId(),
                        h.getRepositoryId(),
                        h.getQuestion(),
                        h.getAnswer(),
                        parseSources(h.getSources()),
                        h.getCreatedAt()
                ))
                .toList();
    }

    private List<String> parseSources(String sources) {
        if (sources == null || sources.isBlank()) return List.of();
        return Arrays.stream(sources.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }
}
