package com.gitscope.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "repositories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RepositoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String owner;

    @Column(nullable = false, unique = true)
    private String url;

    @Column(name = "indexed_at")
    private LocalDateTime indexedAt;

    @Column(name = "file_count")
    private Integer fileCount;

    @Column(name = "chunk_count")
    private Integer chunkCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IndexStatus status;

    @Column(name = "chroma_collection_id")
    private String chromaCollectionId;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    public enum IndexStatus {
        INDEXING, INDEXED, FAILED
    }
}
