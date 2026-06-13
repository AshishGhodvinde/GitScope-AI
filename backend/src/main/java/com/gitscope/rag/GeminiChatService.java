package com.gitscope.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gitscope.config.GeminiConfig;
import com.gitscope.exception.AIServiceException;
import com.gitscope.vectorstore.VectorStoreService.SearchResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service that handles the RAG pipeline: builds prompts and calls the Gemini Chat API.
 *
 * Prompt strategy: context-only answering with injection prevention.
 */
@Service
@Slf4j
public class GeminiChatService {

    private final RestTemplate restTemplate;
    private final GeminiConfig geminiConfig;
    private final ObjectMapper objectMapper;

    public GeminiChatService(RestTemplate restTemplate, GeminiConfig geminiConfig) {
        this.restTemplate = restTemplate;
        this.geminiConfig = geminiConfig;
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Sends a question with retrieved context to Gemini and returns the generated answer.
     *
     * @param question    the user's natural language question
     * @param results     top-K retrieved chunks from ChromaDB
     * @return the AI-generated answer
     */
    public String generateAnswer(String question, List<SearchResult> results) {
        String prompt = buildPrompt(question, results);
        return callGemini(prompt);
    }

    /**
     * Generates an AI summary of the entire repository based on representative code samples.
     *
     * @param repositoryName   name of the repository
     * @param codeContext      sample code content for context
     * @return AI-generated summary
     */
    public String generateSummary(String repositoryName, String codeContext) {
        String prompt = buildSummaryPrompt(repositoryName, codeContext);
        return callGemini(prompt);
    }

    // ─────────────────────────────────────────────────────────────────
    // Prompt construction
    // ─────────────────────────────────────────────────────────────────

    public String buildPrompt(String question, List<SearchResult> results) {
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < results.size(); i++) {
            SearchResult result = results.get(i);
            context.append("--- Source ").append(i + 1).append(": ").append(result.filePath()).append(" ---\n");
            if (result.className() != null) {
                context.append("Class: ").append(result.className()).append("\n");
            }
            context.append(result.content()).append("\n\n");
        }

        return """
                [SYSTEM INSTRUCTION: CORE RESPONSE GEOMETRY]
                You are an expert repository intelligence engine. You must structure your answers with extreme technical clarity:
                1. NEVER run class definitions, annotations, or multi-line expressions inline inside conversational sentences. 
                2. Use distinct, clean Markdown headers (###) to separate logical points.
                3. Every file path modification or exploration suggestion must be wrapped in a separate, isolated markdown code block specifying the programming language (e.g., ```java ... ```).
                4. Use clear, spaced bullet points and bold key phrases to make answers instantly scannable at a single glance.

                You are an expert code assistant for the GitScope AI platform.
                Your job is to answer questions about a GitHub repository based on the provided code context (including file contents, file paths, package names, and structure).

                GUIDELINES:
                1. Ground your answer in the provided repository context.
                2. If the context is completely irrelevant or does not contain enough information to form a reasonable answer, respond with: "Information not found in repository."
                3. Do not invent classes, methods, or functionality that are not present in the context.
                4. Be precise, clear, helpful, and technical. Analyze architectural patterns, dependencies, and logic visible in the code snippets and file structures.
                5. Use markdown formatting for code snippets, directory lists, and explanations.

                REPOSITORY CONTEXT:
                %s

                QUESTION: %s

                ANSWER:
                """.formatted(context.toString(), sanitizeInput(question));
    }

    private String buildSummaryPrompt(String repositoryName, String codeContext) {
        return """
                [SYSTEM INSTRUCTION: DEEP ARCHITECTURAL INSIGHT GENERATION]
                You are a principal enterprise codebase auditing tool. When generating a repository summary, you must run a comprehensive, long-form technical teardown of the repository: %s
                Based on the provided code samples, generate a highly detailed report. Do NOT include conversational filler or introductory remarks. Return the summary strictly structured using these exact markdown headers:

                ### 🎯 Core Purpose
                Elaborate extensively on what this application accomplishes, detailing transaction domains, business rules, and technical objectives. Avoid basic one-line summaries.

                ### 🛠️ Architecture & Tech Stack
                Document every framework dependency identified (Spring Boot components, security setups, database integrations, frontend dependencies, AI tools) and explicitly state how data flows through them.

                ### 🔑 Critical Module Entry Points
                Map out the precise directory locations of primary API controllers, service handling loops, and entity models, detailing exactly where execution flow triggers. Use the '──>' arrow format (e.g., `com/gitscope/controller/RepositoryController.java` ──> Handles repository indexing request entry points).

                Be highly technical, specific, and exhaustive in your analysis.

                CODE SAMPLES:
                %s

                SUMMARY:
                """.formatted(repositoryName, codeContext);
    }

    // ─────────────────────────────────────────────────────────────────
    // Gemini API call
    // ─────────────────────────────────────────────────────────────────

    private String callGemini(String prompt) {
        String primaryModel = geminiConfig.getModel();
        return callGeminiWithModel(prompt, primaryModel);
    }

    private String callGeminiWithModel(String prompt, String modelName) {
        String url = geminiConfig.getBaseUrl()
                + "/models/" + modelName
                + ":generateContent?key=" + geminiConfig.getApiKey();

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.1,
                        "maxOutputTokens", 2048
                ),
                "safetySettings", List.of(
                        Map.of("category", "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold", "BLOCK_ONLY_HIGH")
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new AIServiceException("Gemini API returned: " + response.getStatusCode());
            }

            return extractTextFromResponse(response.getBody());

        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            if ((status == 429 || status == 503) && "gemini-2.5-flash".equals(modelName)) {
                log.warn("Gemini REST API failed with status {}. Retrying with fallback model gemini-1.5-flash.", status);
                return callGeminiWithModel(prompt, "gemini-1.5-flash");
            }
            throw new AIServiceException("Gemini API call returned status code: " + status + ". Response: " + e.getResponseBodyAsString(), e);
        } catch (AIServiceException e) {
            throw e;
        } catch (Exception e) {
            log.error("Gemini API call failed", e);
            throw new AIServiceException("Failed to generate AI response: " + e.getMessage(), e);
        }
    }

    private String extractTextFromResponse(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && !parts.isEmpty()) {
                    return parts.get(0).path("text").asText("");
                }
            }

            // Check for error response
            JsonNode error = root.path("error");
            if (!error.isMissingNode()) {
                throw new AIServiceException("Gemini API error: " + error.path("message").asText());
            }

            throw new AIServiceException("Could not parse Gemini response");
        } catch (AIServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new AIServiceException("Failed to parse Gemini response: " + e.getMessage(), e);
        }
    }

    /**
     * Sanitizes user input to prevent prompt injection attacks.
     */
    private String sanitizeInput(String input) {
        if (input == null) return "";
        // Remove patterns that could be used for prompt injection
        return input
                .replace("STRICT RULES:", "")
                .replace("SYSTEM:", "")
                .replace("IGNORE PREVIOUS", "")
                .trim();
    }
}
