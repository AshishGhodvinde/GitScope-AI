package com.gitscope.repository;

import com.gitscope.entity.FileEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * JPA repository for CRUD operations on relational FileEntity cache entries.
 */
@Repository
public interface FileRepository extends JpaRepository<FileEntity, Long> {

    List<FileEntity> findByRepositoryId(Long repositoryId);

    @Modifying
    @Transactional
    @Query("DELETE FROM FileEntity f WHERE f.repositoryId = :repositoryId")
    void deleteByRepositoryId(@Param("repositoryId") Long repositoryId);
}
