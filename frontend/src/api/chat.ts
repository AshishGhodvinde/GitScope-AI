import apiClient from './client';
import type { ChatRequest, ChatResponse, ChatHistoryEntry } from '../types';

/**
 * Sends a question about a repository and receives an AI-generated answer
 * with cited source files (full RAG pipeline).
 */
export async function sendChatMessage(data: ChatRequest): Promise<ChatResponse> {
  const res = await apiClient.post<ChatResponse>('/chat', data);
  return res.data;
}

/**
 * Returns the full chat history for a repository, newest first.
 */
export async function getChatHistory(repositoryId: number): Promise<ChatHistoryEntry[]> {
  const res = await apiClient.get<ChatHistoryEntry[]>(`/chat/history/${repositoryId}`);
  return res.data;
}
