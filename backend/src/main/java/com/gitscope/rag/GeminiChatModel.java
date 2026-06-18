package com.gitscope.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.gitscope.config.GeminiConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@Slf4j
public class GeminiChatModel implements ChatModel {

    private final GeminiConfig geminiConfig;
    private final WebClient webClient;

    public GeminiChatModel(GeminiConfig geminiConfig, WebClient.Builder webClientBuilder) {
        this.geminiConfig = geminiConfig;
        this.webClient = webClientBuilder.baseUrl(geminiConfig.getBaseUrl()).build();
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        log.info("GeminiChatModel.call blocking execution requested");
        try {
            List<ChatResponse> responses = stream(prompt).collectList().block();
            if (responses == null || responses.isEmpty()) {
                return new ChatResponse(List.of(new Generation(new AssistantMessage(""))));
            }
            String fullText = responses.stream()
                    .flatMap(res -> res.getResults().stream())
                    .map(gen -> gen.getOutput().getText())
                    .collect(Collectors.joining());
            return new ChatResponse(List.of(new Generation(new AssistantMessage(fullText))));
        } catch (Exception e) {
            log.error("Blocking Gemini API call failed", e);
            throw new RuntimeException("Failed to generate AI response: " + e.getMessage(), e);
        }
    }

    private String buildGeminiUri(String modelName) {
        return "/models/" + modelName + ":streamGenerateContent?key=" + geminiConfig.getApiKey();
    }

    @Override
    public Flux<ChatResponse> stream(Prompt prompt) {
        String instructions = prompt.getContents();
        String primaryModel = geminiConfig.getModel();

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", instructions)))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.3,
                        "maxOutputTokens", 2048
                )
        );

        return webClient.post()
                .uri(buildGeminiUri(primaryModel))
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(JsonNode.class)
                .onErrorResume(org.springframework.web.reactive.function.client.WebClientResponseException.class, ex -> {
                    int statusCode = ex.getStatusCode().value();
                    if ((statusCode == 429 || statusCode == 503) && "gemini-2.5-flash".equals(primaryModel)) {
                        log.warn("Primary model {} failed with status {}. Dynamically falling back to gemini-1.5-flash.", primaryModel, statusCode);
                        return webClient.post()
                                .uri(buildGeminiUri("gemini-1.5-flash"))
                                .bodyValue(requestBody)
                                .retrieve()
                                .bodyToFlux(JsonNode.class);
                    }
                    return Flux.error(ex);
                })
                .map(this::extractTextFromChunk)
                .filter(text -> !text.isEmpty())
                .map(text -> new ChatResponse(List.of(new Generation(new AssistantMessage(text)))));
    }

    private String extractTextFromChunk(JsonNode root) {
        try {
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && !parts.isEmpty()) {
                    return parts.get(0).path("text").asText("");
                }
            }
        } catch (Exception e) {
            log.warn("Failed to extract text from chunk", e);
        }
        return "";
    }
}
