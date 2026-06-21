package com.gitscope.controller;

import com.gitscope.dto.*;
import com.gitscope.service.RepositoryService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for repository indexing and status polling.
 *
 * <p>All endpoints are stateless — no database IDs are used.
 * Repositories are identified by the composite key {@code repoUrl#branch}.
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
     * Starts async ingestion for the given repository URL + branch.
     * Returns 202 Accepted immediately so the frontend is never blocked.
     */
    @PostMapping("/index")
    public ResponseEntity<IndexRepositoryResponse> indexRepository(
            @Valid @RequestBody IndexRepositoryRequest request) {
        log.info("POST /api/repositories/index - url={} branch={}", request.repositoryUrl(), request.branch());
        IndexRepositoryResponse response = repositoryService.indexRepository(request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    /**
     * Polls the in-memory status for a repository.
     * The {@code id} parameter is the composite {@code repoIdentifier} string.
     */
    @GetMapping("/status")
    public ResponseEntity<RepoDetails> getStatus(@RequestParam String id) {
        log.info("GET /api/repositories/status?id={}", id);
        return ResponseEntity.ok(repositoryService.getStatus(id));
    }

    /**
     * Returns a list of all repositories that have been submitted for indexing
     * in this server session, with their current statuses.
     */
    @GetMapping
    public ResponseEntity<List<RepositoryResponse>> getAllRepositories() {
        return ResponseEntity.ok(repositoryService.getAllRepositories());
    }
}
