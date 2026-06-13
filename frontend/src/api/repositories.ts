import apiClient from './client';
import type {
  IndexRepositoryRequest,
  IndexRepositoryResponse,
  Repository,
  SummaryResponse,
  FileEntity,
} from '../types';

/**
 * Sends a repository URL to the backend for indexing.
 * This triggers cloning, chunking, embedding, and vector storage.
 */
export async function indexRepository(
  data: IndexRepositoryRequest
): Promise<IndexRepositoryResponse> {
  const res = await apiClient.post<IndexRepositoryResponse>('/repositories/index', data);
  return res.data;
}

/**
 * Returns all indexed repositories.
 */
export async function getAllRepositories(): Promise<Repository[]> {
  const res = await apiClient.get<Repository[]>('/repositories');
  return res.data;
}

/**
 * Returns metadata for a single repository by ID.
 */
export async function getRepository(id: number): Promise<Repository> {
  const res = await apiClient.get<Repository>(`/repositories/${id}`);
  return res.data;
}

/**
 * Fetches the AI-generated summary for a repository.
 */
export async function getRepositorySummary(id: number): Promise<SummaryResponse> {
  const res = await apiClient.get<SummaryResponse>(`/repositories/${id}/summary`);
  return res.data;
}

/**
 * Returns the list of all indexed file paths for a repository.
 */
export async function getRepositoryFiles(id: number): Promise<FileEntity[]> {
  const res = await apiClient.get<FileEntity[]>(`/repositories/${id}/files`);
  return res.data;
}
