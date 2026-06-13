package com.gitscope.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * JPA entity representing a cached repository file path in PostgreSQL.
 * This replaces JGit-based disk reads during file explorer queries.
 */
@Entity
@Table(name = "files", indexes = {
    @Index(name = "idx_files_repository_id", columnList = "repository_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "repository_id", nullable = false)
    private Long repositoryId;

    @Column(name = "path", nullable = false, columnDefinition = "TEXT")
    private String path;
}
