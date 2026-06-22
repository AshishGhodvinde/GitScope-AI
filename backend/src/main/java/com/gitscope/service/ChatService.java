package com.gitscope.service;

import com.gitscope.dto.ChatRequest;
import com.gitscope.embedding.LocalEmbeddingService;
import com.gitscope.rag.GeminiChatModel;
import com.gitscope.rag.GeminiChatService;
import com.gitscope.vectorstore.VectorStoreService;
import com.gitscope.vectorstore.VectorStoreService.SearchResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import com.gitscope.dto.ChatMessageDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Stateless chat service.
 *
 * <p>Performs vector similarity search scoped to a composite {@code repoIdentifier}
 * ({@code repoUrl#branch}), then feeds the retrieved context to Gemini with a
 * strict scope-guardrail system prompt.
 *
 * <p>No relational database, no chat history persistence — fully ephemeral.
 */
@Service
@Slf4j
public class ChatService {

    @Value("${rag.top-k:12}")
    private int topK;

    private static final String DEFAULT_BRANCH = "main";

    private final LocalEmbeddingService embeddingService;
    private final VectorStoreService    vectorStoreService;
    private final GeminiChatService     geminiChatService;
    private final GeminiChatModel       geminiChatModel;

    public ChatService(
            LocalEmbeddingService embeddingService,
            VectorStoreService    vectorStoreService,
            GeminiChatService     geminiChatService,
            GeminiChatModel       geminiChatModel
    ) {
        this.embeddingService   = embeddingService;
        this.vectorStoreService = vectorStoreService;
        this.geminiChatService  = geminiChatService;
        this.geminiChatModel    = geminiChatModel;
    }

    // -----------------------------------------------------------------------
    // Streaming chat — primary entry point
    // -----------------------------------------------------------------------

    /**
     * Runs the full RAG pipeline for the given request and returns a streaming token Flux.
     *
     * <ol>
     *   <li>Resolves the composite {@code repoIdentifier} from {@code repoUrl} + {@code branch}.</li>
     *   <li>Embeds the question locally.</li>
     *   <li>Queries ChromaDB with a strict {@code repoIdentifier} metadata filter.</li>
     *   <li>Builds a guardrail system prompt and calls Gemini in streaming mode.</li>
     * </ol>
     */
    public Flux<String> chatStream(ChatRequest request) {
        String repoUrl = request.repoUrl().trim();
        String branch  = (request.branch() != null && !request.branch().isBlank())
                         ? request.branch().trim() : DEFAULT_BRANCH;
        String repoIdentifier = RepositoryService.buildIdentifier(repoUrl, branch);

        log.info("Streaming chat for repoIdentifier={} question='{}'", repoIdentifier, request.question());

        // 1. Embed the question
        float[]       questionEmbedding = embeddingService.getEmbedding(request.question());
        List<Double>  questionVector    = embeddingService.toDoubleList(questionEmbedding);

        // 2. Retrieve top-K chunks scoped to this exact repo
        List<SearchResult> chunks = vectorStoreService.queryByRepoIdentifier(
                repoIdentifier, questionVector, topK);

        if (chunks.isEmpty()) {
            log.warn("No chunks found for repoIdentifier={}", repoIdentifier);
            return Flux.just(
                "I couldn't find any indexed code for this repository. " +
                "Please make sure indexing has completed (status: COMPLETED) before chatting.");
        }

        log.info("Retrieved {} chunks for repoIdentifier={}", chunks.size(), repoIdentifier);

        // 3. Build the guardrail prompt
        String promptText = geminiChatService.buildGuardrailPrompt(request.question(), chunks, repoUrl, repoIdentifier);

        // 4. Map the history list to Spring AI Message turns, then append the current query
        List<Message> messages = new ArrayList<>();
        if (request.history() != null) {
            for (ChatMessageDto msg : request.history()) {
                if ("user".equalsIgnoreCase(msg.role())) {
                    messages.add(new UserMessage(msg.content()));
                } else if ("model".equalsIgnoreCase(msg.role()) || "assistant".equalsIgnoreCase(msg.role())) {
                    messages.add(new AssistantMessage(msg.content()));
                }
            }
        }
        messages.add(new UserMessage(promptText));

        return geminiChatModel.stream(new Prompt(messages))
                .map(response -> response.getResult().getOutput().getText())
                .doOnComplete(() -> log.info("Stream completed for repoIdentifier={}", repoIdentifier))
                .doOnError(err -> log.error("Stream error for repoIdentifier={}: {}", repoIdentifier, err.getMessage()));
    }

    // -----------------------------------------------------------------------
    // SHA-256 utility (kept for potential future dedup use)
    // -----------------------------------------------------------------------

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
}
