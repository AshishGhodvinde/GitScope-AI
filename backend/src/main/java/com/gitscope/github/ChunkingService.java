package com.gitscope.github;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service that breaks source files into semantic code chunks.
 *
 * Strategy:
 *   Java  → chunk by class, then methods inside each class
 *   JS/TS → chunk by React components, hooks, route handlers, exports
 *   Other → chunk by fixed-size with overlap
 */
@Service
@Slf4j
public class ChunkingService {

    @Value("${rag.max-chunk-size:1500}")
    private int maxChunkSize;

    @Value("${rag.chunk-overlap:200}")
    private int chunkOverlap;

    // Java class-level declarations
    private static final Pattern JAVA_CLASS_PATTERN = Pattern.compile(
            "(?:public|private|protected)?\\s*(?:abstract|final)?\\s*(?:class|interface|enum|record)\\s+(\\w+)",
            Pattern.MULTILINE);

    // Java method declarations (simplified)
    private static final Pattern JAVA_METHOD_PATTERN = Pattern.compile(
            "(?:public|private|protected|static|final|synchronized|\\s)+[\\w<>\\[\\],\\s]+\\s+(\\w+)\\s*\\([^)]*\\)\\s*(?:throws[^{]+)?\\{",
            Pattern.MULTILINE);

    // React functional components
    private static final Pattern REACT_COMPONENT_PATTERN = Pattern.compile(
            "(?:export\\s+(?:default\\s+)?)?(?:const|function)\\s+(\\w+)\\s*[=:(].*?(?:=>|\\{)",
            Pattern.MULTILINE);

    // Named exports and functions
    private static final Pattern JS_FUNCTION_PATTERN = Pattern.compile(
            "(?:export\\s+)?(?:async\\s+)?function\\s+(\\w+)|const\\s+(\\w+)\\s*=\\s*(?:async\\s+)?(?:\\([^)]*\\)|\\w+)\\s*=>",
            Pattern.MULTILINE);

    /**
     * Produces a list of semantic chunks from a single source file.
     *
     * @param file     the source file
     * @param filePath relative path from repository root
     * @return list of code chunks
     */
    public List<CodeChunk> chunkFile(File file, String filePath) {
        String content;
        try {
            content = Files.readString(file.toPath());
        } catch (IOException e) {
            log.warn("Failed to read file: {}", filePath, e);
            return List.of();
        }

        if (content.isBlank()) {
            return List.of();
        }

        String language = detectLanguage(filePath);
        List<CodeChunk> chunks = new ArrayList<>();

        switch (language) {
            case "java" -> chunks.addAll(chunkJavaFile(content, filePath));
            case "javascript", "typescript" -> chunks.addAll(chunkJsFile(content, filePath, language));
            default -> chunks.addAll(chunkGeneric(content, filePath, language));
        }

        // If no chunks were extracted by pattern matching, fall back to generic chunking
        if (chunks.isEmpty()) {
            chunks.addAll(chunkGeneric(content, filePath, language));
        }

        // Silently discard high-noise, low-signal structures
        List<CodeChunk> filteredChunks = new ArrayList<>();
        for (CodeChunk chunk : chunks) {
            if (!isLowValueChunk(chunk.getContent())) {
                filteredChunks.add(chunk);
            }
        }

        return filteredChunks;
    }

    private boolean isLowValueChunk(String content) {
        if (content == null) return true;
        String trimmed = content.trim();

        // 1. Chunks containing fewer than 100 characters
        if (trimmed.length() < 100) {
            return true;
        }

        // 2. Auto-generated boilerplates (hashCode(), equals(), toString())
        if (trimmed.contains("hashCode()") || trimmed.contains("toString()") || trimmed.contains("equals(Object")) {
            return true;
        }
        if (trimmed.contains("@Override") && (trimmed.contains("hashCode") || trimmed.contains("equals") || trimmed.contains("toString"))) {
            return true;
        }

        // 3. Trivial accessors (Empty constructors, single-line getters/setters)
        String singleLine = trimmed.replaceAll("\\s+", " ");

        // Empty constructor
        if (singleLine.matches("(?i).*(?:public|private|protected)?\\s*\\w+\\s*\\(\\s*\\)\\s*\\{\\s*\\}")) {
            return true;
        }

        // Single-line getter
        if (singleLine.matches("(?i).*(?:public|private|protected)?\\s*[\\w<>]+\\s+get\\w+\\s*\\(\\s*\\)\\s*\\{\\s*return\\s+[^;]+;\\s*\\}")) {
            return true;
        }

        // Single-line setter
        if (singleLine.matches("(?i).*(?:public|private|protected)?\\s*void\\s+set\\w+\\s*\\([^)]*\\)\\s*\\{\\s*(?:this\\.)?\\w+\\s*=\\s*[^;]+;\\s*\\}")) {
            return true;
        }

        return false;
    }

    // ─────────────────────────────────────────────────────────────────
    // Java chunking — class-level chunks with method extraction
    // ─────────────────────────────────────────────────────────────────

    private List<CodeChunk> chunkJavaFile(String content, String filePath) {
        List<CodeChunk> chunks = new ArrayList<>();
        String[] lines = content.split("\n");

        String currentClassName = null;
        StringBuilder classBuilder = new StringBuilder();
        String currentMethodName = null;
        StringBuilder methodBuilder = new StringBuilder();
        int braceDepth = 0;
        boolean insideClass = false;
        boolean insideMethod = false;

        for (String line : lines) {
            // Detect class declaration
            Matcher classMatcher = JAVA_CLASS_PATTERN.matcher(line);
            if (classMatcher.find() && !insideClass) {
                currentClassName = classMatcher.group(1);
                insideClass = true;
                classBuilder = new StringBuilder();
            }

            // Count braces to track scope
            braceDepth += countChar(line, '{') - countChar(line, '}');

            if (insideClass) {
                classBuilder.append(line).append("\n");

                // Detect method declarations inside class
                Matcher methodMatcher = JAVA_METHOD_PATTERN.matcher(line);
                if (methodMatcher.find() && braceDepth == 2 && !insideMethod) {
                    currentMethodName = methodMatcher.group(1);
                    insideMethod = true;
                    methodBuilder = new StringBuilder();
                }

                if (insideMethod) {
                    methodBuilder.append(line).append("\n");
                }

                // Method ends when we return to class scope
                if (insideMethod && braceDepth == 1) {
                    String methodContent = methodBuilder.toString();
                    if (!methodContent.isBlank() && methodContent.length() > 50) {
                        chunks.add(buildChunk(methodContent, filePath, "java",
                                currentClassName, currentMethodName, "METHOD"));
                    }
                    insideMethod = false;
                    currentMethodName = null;
                    methodBuilder = new StringBuilder();
                }

                // Class ends when braceDepth returns to 0
                if (braceDepth == 0 && insideClass) {
                    String classContent = classBuilder.toString();
                    // Only add class chunk if it's not too long (avoid duplicating method chunks)
                    if (classContent.length() <= maxChunkSize * 2) {
                        chunks.add(buildChunk(classContent, filePath, "java",
                                currentClassName, null, "CLASS"));
                    }
                    insideClass = false;
                    currentClassName = null;
                    classBuilder = new StringBuilder();
                }
            }
        }

        // If class parsing didn't yield results, fall back to generic
        if (chunks.isEmpty()) {
            return chunkGeneric(content, filePath, "java");
        }

        return chunks;
    }

    // ─────────────────────────────────────────────────────────────────
    // JavaScript / TypeScript chunking — components, hooks, functions
    // ─────────────────────────────────────────────────────────────────

    private List<CodeChunk> chunkJsFile(String content, String filePath, String language) {
        List<CodeChunk> chunks = new ArrayList<>();
        String[] lines = content.split("\n");

        String currentName = null;
        StringBuilder builder = new StringBuilder();
        int braceDepth = 0;
        boolean capturing = false;

        for (String line : lines) {
            // Check for component or function start
            Matcher componentMatcher = REACT_COMPONENT_PATTERN.matcher(line);
            Matcher funcMatcher = JS_FUNCTION_PATTERN.matcher(line);

            boolean isComponentStart = componentMatcher.find() && !capturing;
            boolean isFuncStart = funcMatcher.find() && !capturing;

            if (isComponentStart || isFuncStart) {
                // Save previous chunk
                if (capturing && builder.length() > 50) {
                    String chunkType = currentName != null && Character.isUpperCase(currentName.charAt(0))
                            ? "COMPONENT" : "FUNCTION";
                    chunks.add(buildChunk(builder.toString(), filePath, language,
                            null, currentName, chunkType));
                }

                currentName = isComponentStart
                        ? componentMatcher.group(1)
                        : (funcMatcher.group(1) != null ? funcMatcher.group(1) : funcMatcher.group(2));
                builder = new StringBuilder();
                capturing = true;
            }

            braceDepth += countChar(line, '{') - countChar(line, '}');

            if (capturing) {
                builder.append(line).append("\n");

                // Chunk ends when brace depth returns to 0
                if (braceDepth <= 0 && builder.length() > 50) {
                    String chunkType = currentName != null && Character.isUpperCase(currentName.charAt(0))
                            ? "COMPONENT" : "FUNCTION";
                    chunks.add(buildChunk(builder.toString(), filePath, language,
                            null, currentName, chunkType));
                    capturing = false;
                    currentName = null;
                    builder = new StringBuilder();
                    braceDepth = 0;
                }
            }
        }

        // Capture any remaining content
        if (capturing && builder.length() > 50) {
            chunks.add(buildChunk(builder.toString(), filePath, language,
                    null, currentName, "FUNCTION"));
        }

        return chunks.isEmpty() ? chunkGeneric(content, filePath, language) : chunks;
    }

    // ─────────────────────────────────────────────────────────────────
    // Generic sliding-window chunking for YAML, JSON, Markdown, etc.
    // ─────────────────────────────────────────────────────────────────

    private List<CodeChunk> chunkGeneric(String content, String filePath, String language) {
        List<CodeChunk> chunks = new ArrayList<>();

        if (content.length() <= maxChunkSize) {
            chunks.add(buildChunk(content, filePath, language, null, null, "FILE"));
            return chunks;
        }

        int start = 0;
        while (start < content.length()) {
            int end = Math.min(start + maxChunkSize, content.length());
            // Try to break at a newline boundary
            if (end < content.length()) {
                int newlineIndex = content.lastIndexOf('\n', end);
                if (newlineIndex > start) {
                    end = newlineIndex;
                }
            }
            chunks.add(buildChunk(content.substring(start, end), filePath, language,
                    null, null, "FILE"));
            start = Math.max(start + 1, end - chunkOverlap);
        }

        return chunks;
    }

    // ─────────────────────────────────────────────────────────────────
    // Utilities
    // ─────────────────────────────────────────────────────────────────

    private CodeChunk buildChunk(String content, String filePath, String language,
                                  String className, String methodName, String chunkType) {
        return CodeChunk.builder()
                .id(UUID.randomUUID().toString())
                .content(content.strip())
                .filePath(filePath)
                .language(language)
                .className(className)
                .methodName(methodName)
                .chunkType(chunkType)
                .build();
    }

    private String detectLanguage(String filePath) {
        if (filePath.endsWith(".java")) return "java";
        if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
        if (filePath.endsWith(".js") || filePath.endsWith(".jsx")) return "javascript";
        if (filePath.endsWith(".json")) return "json";
        if (filePath.endsWith(".yml") || filePath.endsWith(".yaml")) return "yaml";
        if (filePath.endsWith(".md")) return "markdown";
        return "text";
    }

    private int countChar(String line, char c) {
        int count = 0;
        for (char ch : line.toCharArray()) {
            if (ch == c) count++;
        }
        return count;
    }
}
