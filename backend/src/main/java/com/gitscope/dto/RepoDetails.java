package com.gitscope.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepoDetails {
    private String status; // "INGESTING", "COMPLETED", "FAILED"
    private int fileCount;
    private int chunkCount;
    private List<String> files; // Full list of file paths for the Codebase Explorer tree
    private Map<String, Integer> architecturePulse; // maintainability, security, performance
    private String summary; // Gemini-generated codebase analysis blueprint
}
