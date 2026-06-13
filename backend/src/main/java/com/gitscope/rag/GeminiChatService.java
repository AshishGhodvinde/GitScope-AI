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

                [SYSTEM INSTRUCTION: ENTERPRISE CODELINE INTELLIGENCE]
                You are an advanced enterprise repository intelligence framework analyzing a repository code asset partition.
                You must identify, map, and explain all web communications entry points across multiple architecture styles:
                1. MODERN SPRING REST: Track and parse `@RestController`, `@Controller`, `@RequestMapping`, `@GetMapping`, and `@PostMapping`.
                2. CLASSIC JAVA EE SERVLETS: Track and parse implementations extending `HttpServlet`, classes annotated with `@WebServlet`, or web layout files tracking mapping routes. Treat `doGet(HttpServletRequest request, HttpServletResponse response)` and `doPost()` as core transactional API endpoints.
                3. If an architectural element or endpoint maps to legacy servlet infrastructures, document its relative parameter structures, session handling filters, and business service redirection logic fully.

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
                [SYSTEM INSTRUCTION: EXHAUSTIVE EXPERT CODEBASE SUMMARY]
                You are a principal enterprise static analysis engine auditing the repository: %s
                Generate an extensive, highly technical repository overview. Do NOT include conversational filler, greetings, or introductory remarks.
                Return the summary strictly structured using these exact markdown headers in order:

                ### 1. CORE ARCHITECTURAL OVERVIEW
                Detail the system architecture, transaction boundaries, and key design patterns used (e.g. MVC, Repository, Service Layer, RAG pipeline). Explain what the application does at an engineering level, including the problem domain, primary user-facing flows, and non-obvious technical constraints. Be exhaustive — minimum 5 sentences.

                ### 2. PACKAGE-BY-PACKAGE TEARDOWN
                Analyze each structural folder visible in the codebase (controllers, services, repositories, config, models, utils, etc.). For each package:
                - State its responsibility
                - List the key classes/interfaces and what they do
                - Explain how data enters and exits the package
                Use the '──>' arrow notation (e.g., `com/gitscope/controller/RepositoryController.java` ──> Handles HTTP /api/repositories/** endpoints, delegates indexing to RepositoryService).

                ### 3. DEPENDENCY INTERACTION MAP
                Document all detected framework configurations and library dependencies. For each detected dependency:
                - Name the library/framework
                - State its version if visible
                - Explain its structural role (e.g., Spring Data JPA ──> ORM layer for PostgreSQL persistence; ChromaDB ──> Vector store for semantic chunk retrieval)
                Include build tool configuration (Maven/Gradle), testing frameworks, and any AI or ML libraries detected.

                Be highly technical, specific, and exhaustive. Never produce a generic or brief summary.

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
