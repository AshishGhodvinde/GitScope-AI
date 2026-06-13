package com.gitscope.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * JPA entity representing a cached embedding vector, keyed by SHA-256 content hash.
 * This avoids re-vectorizing unchanged text chunks.
 */
@Entity
@Table(name = "embedding_cache", indexes = {
    @Index(name = "idx_content_hash", columnList = "content_hash", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmbeddingCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "content_hash", nullable = false, unique = true, length = 64)
    private String contentHash;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "vector_json", nullable = false, columnDefinition = "TEXT")
    private String vectorJson; // JSON representation of float[]

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
