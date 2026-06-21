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

    // -----------------------------------------------------------------------
    // Public prompt builders
    // -----------------------------------------------------------------------

    /**
     * Builds a prompt with a strict scope-guardrail system instruction.
     * Gemini is instructed to ONLY answer from the provided context and to
     * politely decline questions about unrelated repositories or general knowledge.
     */
    public String buildGuardrailPrompt(
            String question,
            List<SearchResult> results,
            String repoUrl,
            String repoIdentifier) {

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
                [SYSTEM INSTRUCTION: SCOPE GUARDRAIL — READ CAREFULLY]
                You are GitScope AI, an expert software architecture analysis assistant.
                You are currently analyzing the following repository: %s (identifier: %s)

                CRITICAL RULES:
                1. You must ONLY answer questions using the provided repository context chunks below.
                2. Do NOT use your general training knowledge to answer questions about code not present in the context.
                3. If the user explicitly asks about a different repository by name, or if the question is completely unrelated to the active codebase (e.g., general knowledge, recipes, sports), you must politely decline:
                   State exactly: "I can only analyze and answer questions regarding the currently active repository: %s."
                4. If the user asks a non-programming general-knowledge question completely unrelated to software engineering, respond:
                   "I am a strict technical analysis tool dedicated to codebase architecture mapping. I cannot help with non-programming questions."
                5. Do NOT invent classes, methods, or functionality not present in the context.
                6. Ground every answer in the retrieved context. If it does not contain enough information, say: "Information not found in repository."

                [SYSTEM INSTRUCTION: RESPONSE FORMATTING]
                1. Use distinct, clean Markdown headers (###) to separate logical points.
                2. Every code snippet must be in a fenced code block with the programming language specified.
                3. Use clear, spaced bullet points and bold key phrases for scannable answers.
                4. NEVER run class definitions or multi-line expressions inline inside conversational sentences.

                [SYSTEM INSTRUCTION: ENTERPRISE CODELINE INTELLIGENCE]
                Track and explain all web entry points across architecture styles:
                - MODERN SPRING REST: @RestController, @RequestMapping, @GetMapping, @PostMapping
                - CLASSIC JAVA EE: HttpServlet, @WebServlet, doGet/doPost

                REPOSITORY CONTEXT:
                %s

                USER QUESTION: %s

                ANSWER:
                """.formatted(repoUrl, repoIdentifier, repoUrl, context.toString(), sanitizeInput(question));
    }

    /**
     * Builds the legacy non-guardrail prompt (used by generateAnswer/Summary).
     */
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
                3. Every file path modification or exploration suggestion must be wrapped in a separate, isolated markdown code block specifying the programming language.
                4. Use clear, spaced bullet points and bold key phrases to make answers instantly scannable at a single glance.

                You are an expert code assistant for the GitScope AI platform.
                Your job is to answer questions about a GitHub repository based on the provided code context.

                GUIDELINES:
                1. Ground your answer in the provided repository context.
                2. If the context is completely irrelevant or does not contain enough information, respond with: "Information not found in repository."
                3. Do not invent classes, methods, or functionality not present in the context.
                4. Be precise, clear, helpful, and technical.
                5. Use markdown formatting for code snippets, directory lists, and explanations.

                REPOSITORY CONTEXT:
                %s

                QUESTION: %s

                ANSWER:
                """.formatted(context.toString(), sanitizeInput(question));
    }

    public String generateAnswer(String question, List<SearchResult> results) {
        String prompt = buildPrompt(question, results);
        return callGemini(prompt);
    }

    public String generateSummary(String repositoryName, String codeContext) {
        String prompt = buildSummaryPrompt(repositoryName, codeContext);
        return callGemini(prompt);
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private String buildSummaryPrompt(String repositoryName, String codeContext) {
        return """
                [SYSTEM INSTRUCTION: EXHAUSTIVE EXPERT CODEBASE SUMMARY]
                You are a principal enterprise static analysis engine auditing the repository: %s
                Generate an extensive, highly technical repository overview. Do NOT include conversational filler, greetings, or introductory remarks.
                Return the summary strictly structured using these exact markdown headers in order:

                ### 1. CORE ARCHITECTURAL OVERVIEW
                Detail the system architecture, transaction boundaries, and key design patterns used. Be exhaustive — minimum 5 sentences.

                ### 2. PACKAGE-BY-PACKAGE TEARDOWN
                Analyze each structural folder visible in the codebase. For each package:
                - State its responsibility
                - List the key classes/interfaces and what they do
                - Explain how data enters and exits the package
                Use the '──>' arrow notation.

                ### 3. DEPENDENCY INTERACTION MAP
                Document all detected framework configurations and library dependencies. For each detected dependency:
                - Name the library/framework
                - State its version if visible
                - Explain its structural role

                CODE SAMPLES:
                %s

                SUMMARY:
                """.formatted(repositoryName, codeContext);
    }

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
                        "maxOutputTokens", 4096
                ),
                "safetySettings", List.of(
                        Map.of("category", "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold", "BLOCK_ONLY_HIGH")
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new AIServiceException("Gemini API returned: " + response.getStatusCode());
            }
            return extractTextFromResponse(response.getBody());

        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            if ((status == 429 || status == 503) && "gemini-3.5-flash".equals(modelName)) {
                log.warn("Gemini REST API failed with status {}. Retrying with fallback model gemini-2.5-flash.", status);
                return callGeminiWithModel(prompt, "gemini-2.5-flash");
            }
            throw new AIServiceException("Gemini API returned status " + status + ": " + e.getResponseBodyAsString(), e);
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

    private String sanitizeInput(String input) {
        if (input == null) return "";
        return input
                .replace("STRICT RULES:", "")
                .replace("SYSTEM:", "")
                .replace("IGNORE PREVIOUS", "")
                .trim();
    }
}
