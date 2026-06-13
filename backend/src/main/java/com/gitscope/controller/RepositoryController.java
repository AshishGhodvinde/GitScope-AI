package com.gitscope.controller;

import com.gitscope.dto.*;
import com.gitscope.entity.FileEntity;
import com.gitscope.service.RepositoryService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for repository management endpoints.
 *
 * POST /api/repositories/index        → index a new repository
 * GET  /api/repositories              → list all repositories
 * GET  /api/repositories/{id}         → get repository details
 * GET  /api/repositories/{id}/summary → AI-generated summary
 * GET  /api/repositories/{id}/files   → file explorer
 */
@RestController
@RequestMapping("/api/repositories")
@Slf4j
public class RepositoryController {

    private final RepositoryService repositoryService;

    public RepositoryController(RepositoryService repositoryService) {
        this.repositoryService = repositoryService;
    }

    /**
     * Indexes a public GitHub repository.
     * Clones, parses, embeds, and stores code in ChromaDB + PostgreSQL.
     */
    @PostMapping("/index")
    public ResponseEntity<IndexRepositoryResponse> indexRepository(
            @Valid @RequestBody IndexRepositoryRequest request) {
        log.info("POST /api/repositories/index - url={}", request.repositoryUrl());
        IndexRepositoryResponse response = repositoryService.indexRepository(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Returns all indexed repositories.
     */
    @GetMapping
    public ResponseEntity<List<RepositoryResponse>> getAllRepositories() {
        return ResponseEntity.ok(repositoryService.getAllRepositories());
    }

    /**
     * Returns metadata for a single repository.
     */
    @GetMapping("/{id}")
    public ResponseEntity<RepositoryResponse> getRepository(@PathVariable Long id) {
        return ResponseEntity.ok(repositoryService.getRepository(id));
    }

    /**
     * Returns an AI-generated summary for the indexed repository.
     */
    @GetMapping("/{id}/summary")
    public ResponseEntity<SummaryResponse> getSummary(@PathVariable Long id) {
        log.info("GET /api/repositories/{}/summary", id);
        return ResponseEntity.ok(repositoryService.getSummary(id));
    }

    /**
     * Returns the list of all indexed file paths.
     */
    @GetMapping("/{id}/files")
    public ResponseEntity<List<FileEntity>> getRepositoryFiles(@PathVariable Long id) {
        return ResponseEntity.ok(repositoryService.getFiles(id));
    }
}
