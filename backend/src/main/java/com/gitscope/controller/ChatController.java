package com.gitscope.controller;

import com.gitscope.dto.ChatHistoryResponse;
import com.gitscope.dto.ChatRequest;
import com.gitscope.dto.ChatResponse;
import com.gitscope.service.ChatService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@Slf4j
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chat(@Valid @RequestBody ChatRequest request) {
        log.info("POST /api/chat (streaming) - repoId={}, question='{}'",
                request.repositoryId(), request.question());
        return chatService.chatStream(request);
    }

    @GetMapping("/history/{repositoryId}")
    public ResponseEntity<List<ChatHistoryResponse>> getHistory(@PathVariable Long repositoryId) {
        return ResponseEntity.ok(chatService.getHistory(repositoryId));
    }
}
