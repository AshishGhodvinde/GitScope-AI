// ─── Repository ───────────────────────────────────────────────────────────────

export interface Repository {
  id: number;
  name: string;
  owner: string;
  url: string;
  status: 'INDEXING' | 'INDEXED' | 'FAILED';
  fileCount: number | null;
  chunkCount: number | null;
  indexedAt: string | null;
}

export interface IndexRepositoryRequest {
  repositoryUrl: string;
}

export interface IndexRepositoryResponse {
  repositoryId: number;
  name: string;
  owner: string;
  status: string;
  fileCount: number;
  chunkCount: number;
}

export interface SummaryResponse {
  repositoryId: number;
  name: string;
  summary: string;
}

export interface FileListResponse {
  repositoryId: number;
  repositoryName: string;
  files: string[];
  totalFiles: number;
}

export interface FileEntity {
  id: number;
  repositoryId: number;
  path: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface SearchResult {
  content: string;
  filePath: string;
  language: string;
  className: string | null;
  methodName: string | null;
  distance: number;
}

export interface ChatRequest {
  repositoryId: number;
  question: string;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  segments?: SearchResult[];
}

export interface ChatHistoryEntry {
  id: number;
  repositoryId: number;
  question: string;
  answer: string;
  sources: string[];
  segments?: SearchResult[];
  createdAt: string;
}

// ─── UI state ─────────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: Date;
  isLoading?: boolean;
}

// ─── API Error ────────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
  fieldErrors?: Record<string, string>;
}
