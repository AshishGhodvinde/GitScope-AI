package com.gitscope.repository;

import com.gitscope.entity.EmbeddingCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmbeddingCacheRepository extends JpaRepository<EmbeddingCache, Long> {
    Optional<EmbeddingCache> findByContentHash(String contentHash);

    @Query(value = "SELECT * FROM embedding_cache WHERE LOWER(content) LIKE LOWER(CONCAT('%', :keyword, '%')) LIMIT 4", nativeQuery = true)
    List<EmbeddingCache> findExactMatches(@Param("keyword") String keyword);
}
