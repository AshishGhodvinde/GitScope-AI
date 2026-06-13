package com.gitscope.repository;

import com.gitscope.entity.RepositoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * JPA repository for RepositoryEntity — provides CRUD + custom finders.
 */
@Repository
public interface RepositoryJpaRepository extends JpaRepository<RepositoryEntity, Long> {

    Optional<RepositoryEntity> findByUrl(String url);

    boolean existsByUrl(String url);
}
