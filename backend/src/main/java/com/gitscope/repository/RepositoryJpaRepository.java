package com.gitscope.repository;

import com.gitscope.entity.RepositoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RepositoryJpaRepository extends JpaRepository<RepositoryEntity, Long> {

    Optional<RepositoryEntity> findByUrl(String url);

    boolean existsByUrl(String url);
}
