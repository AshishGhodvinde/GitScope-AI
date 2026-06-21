package com.gitscope.controller;

import com.gitscope.dto.ChatRequest;
import com.gitscope.service.ChatService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

/**
 * REST controller for streaming AI chat responses.
 *
 * <p>Stateless — no database IDs. Chat is scoped to a repository via
 * {@code repoUrl} + optional {@code branch} in the request body.
 */
@RestController
@RequestMapping("/api/chat")
@Slf4j
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    /**
     * Streams an AI answer for the given question about the specified repository.
     * The frontend should read the response as Server-Sent Events (text/event-stream).
     */
    @PostMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chat(@Valid @RequestBody ChatRequest request) {
        log.info("POST /api/chat (streaming) - repoUrl={} question='{}'",
                request.repoUrl(), request.question());
        return chatService.chatStream(request);
    }
}
