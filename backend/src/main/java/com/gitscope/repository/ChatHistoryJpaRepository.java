package com.gitscope.repository;

import com.gitscope.entity.ChatHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatHistoryJpaRepository extends JpaRepository<ChatHistory, Long> {

    List<ChatHistory> findByRepositoryIdOrderByCreatedAtDesc(Long repositoryId);
}
