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

@RestController
@RequestMapping("/api/repositories")
@Slf4j
public class RepositoryController {

    private final RepositoryService repositoryService;

    public RepositoryController(RepositoryService repositoryService) {
        this.repositoryService = repositoryService;
    }

    @PostMapping("/index")
    public ResponseEntity<IndexRepositoryResponse> indexRepository(
            @Valid @RequestBody IndexRepositoryRequest request) {
        log.info("POST /api/repositories/index - url={}", request.repositoryUrl());
        IndexRepositoryResponse response = repositoryService.indexRepository(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<RepositoryResponse>> getAllRepositories() {
        return ResponseEntity.ok(repositoryService.getAllRepositories());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RepositoryResponse> getRepository(@PathVariable Long id) {
        return ResponseEntity.ok(repositoryService.getRepository(id));
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<SummaryResponse> getSummary(@PathVariable Long id) {
        log.info("GET /api/repositories/{}/summary", id);
        return ResponseEntity.ok(repositoryService.getSummary(id));
    }

    @GetMapping("/{id}/files")
    public ResponseEntity<List<FileEntity>> getRepositoryFiles(@PathVariable Long id) {
        return ResponseEntity.ok(repositoryService.getFiles(id));
    }
}
