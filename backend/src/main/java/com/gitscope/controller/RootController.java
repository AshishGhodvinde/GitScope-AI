package com.gitscope.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Handles automated health check pings to the root path of the backend.
 */
@RestController
public class RootController {

    @GetMapping("/")
    public String healthCheck() {
        return "GitScope AI Backend Engine is Active and Running.";
    }
}
