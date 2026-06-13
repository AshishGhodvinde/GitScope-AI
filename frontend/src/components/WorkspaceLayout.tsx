import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import {
  GitBranch, BookOpen, MessageSquare, ExternalLink,
  ChevronLeft, Files, Database, Compass, History
} from 'lucide-react';
import { getRepository, getRepositoryFiles, getRepositorySummary } from '../api/repositories';
import { getChatHistory } from '../api/chat';
import type { Repository, FileListResponse, SummaryResponse, ChatHistoryEntry } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { FileExplorer } from './FileExplorer';
import { useToast } from '../context/ToastContext';

export interface WorkspaceContextType {
  repo: Repository | null;
  fileData: FileListResponse | null;
  summary: SummaryResponse | null;
  loadingRepo: boolean;
  loadingSummary: boolean;
  loadingFiles: boolean;
  fetchSummary: () => Promise<void>;
  refetchRepo: () => Promise<void>;
  history: ChatHistoryEntry[];
  loadingHistory: boolean;
  fetchHistory: () => Promise<void>;
  selectHistoryEntry: ChatHistoryEntry | null;
  setSelectHistoryEntry: (entry: ChatHistoryEntry | null) => void;
}

export function WorkspaceLayout() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { error } = useToast();

  const repoId = Number(id);

  const [repo, setRepo]       = useState<Repository | null>(null);
  const [fileData, setFileData] = useState<FileListResponse | null>(null);
  const [summary, setSummary]  = useState<SummaryResponse | null>(null);
  const [history, setHistory]  = useState<ChatHistoryEntry[]>([]);
  const [selectHistoryEntry, setSelectHistoryEntry] = useState<ChatHistoryEntry | null>(null);

  const [loadingRepo,    setLoadingRepo]    = useState(true);
  const [loadingFiles,   setLoadingFiles]   = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Fetch Repo metadata ──────────────────────────────────────────────────────
  const fetchRepo = useCallback(async () => {
    try {
      setLoadingRepo(true);
      const data = await getRepository(repoId);
      setRepo(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load repository.';
      error('Repository Error', msg);
      navigate('/');
    } finally {
      setLoadingRepo(false);
    }
  }, [repoId, error, navigate]);

  // ── Fetch File tree list ─────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    if (fileData) return;
    try {
      setLoadingFiles(true);
      const data = await getRepositoryFiles(repoId);
      setFileData(data);
    } catch (err: unknown) {
      console.error('Failed to fetch file tree list', err);
    } finally {
      setLoadingFiles(false);
    }
  }, [repoId, fileData]);

  // ── Fetch AI summary ─────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    if (summary || loadingSummary) return;
    try {
      setLoadingSummary(true);
      const data = await getRepositorySummary(repoId);
      setSummary(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate repository summary.';
      error('Summary Error', msg);
    } finally {
      setLoadingSummary(false);
    }
  }, [repoId, summary, loadingSummary, error]);

  // ── Fetch Chat History ───────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!repoId) return;
    setLoadingHistory(true);
    try {
      const data = await getChatHistory(repoId);
      setHistory(data);
    } catch (err: unknown) {
      console.error('Failed to fetch chat history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [repoId]);

  useEffect(() => { fetchRepo(); }, [fetchRepo]);

  useEffect(() => {
    if (repo && repo.status === 'INDEXED') {
      fetchFiles();
      fetchHistory();
      if (!location.pathname.endsWith('/chat')) {
        fetchSummary();
      }
    }
  }, [repo, location.pathname, fetchFiles, fetchSummary, fetchHistory]);

  // ── Poll repository status if INDEXING ──────────────────────────────────────
  useEffect(() => {
    if (!repo || repo.status !== 'INDEXING') return;
    const interval = setInterval(async () => {
      try {
        const data = await getRepository(repoId);
        if (data.status !== 'INDEXING') {
          setRepo(data);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to poll repo status', err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [repo, repoId]);

  const handleHistoryClick = (entry: ChatHistoryEntry) => {
    if (!location.pathname.endsWith('/chat')) {
      navigate(`/repository/${repoId}/chat`);
    }
    setSelectHistoryEntry(entry);
  };

  if (loadingRepo) {
    return (
      <div className="relative z-10 flex h-[calc(100vh-64px)] w-screen items-center justify-center bg-[color:var(--canvas-bg)]">
        <LoadingSpinner size="lg" label="Initializing workspace…" />
      </div>
    );
  }

  if (!repo) return null;

  const isChatPage = location.pathname.includes('/chat');

  const statusBadge = {
    INDEXED: (
      <span className="badge badge-green text-[9px]">Indexed</span>
    ),
    INDEXING: (
      <span className="badge badge-yellow text-[9px] animate-pulse">Indexing…</span>
    ),
    FAILED: (
      <span className="badge badge-red text-[9px]">Failed</span>
    ),
  }[repo.status];

  return (
    <>
      {/* ── 3-Column IDE Workspace Layout (solid, high-contrast panels) ── */}
      <div className="relative z-10 flex h-[calc(100vh-64px)] w-screen overflow-hidden font-sans bg-[color:var(--canvas-bg)] text-[color:var(--text-primary)]">

        {/* ── COLUMN 1: Operational Sidebar (20% width) ── */}
        <div
          className="w-1/5 min-w-[240px] max-w-[320px] shrink-0 flex flex-col h-full overflow-hidden select-none bg-[color:var(--glass-sidebar)] border-r"
          style={{ borderColor: 'var(--divider)' }}
        >
          {/* Top Home portal */}
          <div
            className="p-4 flex items-center justify-between shrink-0"
            style={{ borderBottom: '1px solid var(--divider)' }}
          >
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs transition-colors text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Workbench Home</span>
            </Link>

            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1 text-[10px] text-emerald-400 px-1.5 py-0.5 rounded border"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  borderColor: 'rgba(16,185,129,0.15)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </div>
            </div>
          </div>

          {/* Repo metadata card */}
          <div
            className="p-4 m-3 rounded-xl border"
            style={{
              background: 'var(--canvas-bg)',
              borderColor: 'var(--divider)',
            }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  background: 'var(--glass-sidebar)',
                  borderColor: 'var(--divider)',
                }}
              >
                <GitBranch className="w-4.5 h-4.5 text-[color:var(--accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2
                    className="text-sm font-semibold truncate text-[color:var(--text-primary)]"
                    title={`${repo.owner}/${repo.name}`}
                  >
                    {repo.name}
                  </h2>
                  {statusBadge}
                </div>
                <p className="text-xs truncate mb-1 text-[color:var(--text-secondary)]">
                  {repo.owner}
                </p>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] transition-colors"
                >
                  GitHub Link
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Files, label: 'Files', value: repo.fileCount },
                { icon: Database, label: 'Chunks', value: repo.chunkCount },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-lg p-2 flex flex-col border"
                  style={{
                    background: 'var(--glass-sidebar)',
                    borderColor: 'var(--divider)',
                  }}
                >
                  <span className="text-[10px] font-medium flex items-center gap-1 mb-0.5 text-[color:var(--text-muted)]">
                    <Icon className="w-2.5 h-2.5" /> {label}
                  </span>
                  <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="px-3 pb-2 flex flex-col gap-1 shrink-0">
            <Link
              to={`/repository/${repo.id}`}
              className={`nav-item ${!isChatPage ? 'active' : ''}`}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              AI Summary
            </Link>
            <Link
              to={`/repository/${repo.id}/chat`}
              className={`nav-item ${isChatPage ? 'active' : ''}`}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              Chat with Codebase
            </Link>
          </div>

          {/* Saved Session history (renders below tabs) */}
          <div className="flex-1 overflow-hidden flex flex-col px-3 pb-3 mt-4 min-h-0">
            <div
              className="mb-2 flex items-center gap-1.5 px-1 pb-2 border-b"
              style={{ borderColor: 'var(--divider)' }}
            >
              <History className="w-3 h-3 text-[color:var(--text-muted)]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                Query History
              </span>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 pr-1">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-6">
                  <LoadingSpinner size="sm" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-[11px] text-center py-6 text-[color:var(--text-muted)]">
                  No query history.
                </p>
              ) : (
                history.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => handleHistoryClick(entry)}
                    className="w-full text-left p-2.5 rounded-lg transition-colors border cursor-pointer hover:bg-[color:var(--glass-bg)] bg-[color:var(--canvas-bg)]"
                    style={{ borderColor: 'var(--divider)' }}
                  >
                    <p className="text-xs font-semibold truncate leading-normal text-[color:var(--text-primary)]">
                      {entry.question}
                    </p>
                    <p className="text-[10px] truncate text-[color:var(--text-secondary)] mt-0.5">
                      {entry.answer}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── COLUMN 2: Center Main View (55% width) ── */}
        <div className="w-[55%] flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-[color:var(--canvas-bg)]">
          <Outlet context={{
            repo,
            fileData,
            summary,
            loadingRepo,
            loadingSummary,
            loadingFiles,
            fetchSummary,
            refetchRepo: fetchRepo,
            history,
            loadingHistory,
            fetchHistory,
            selectHistoryEntry,
            setSelectHistoryEntry,
          } satisfies WorkspaceContextType} />
        </div>

        {/* ── COLUMN 3: Right File Explorer (25% width) ── */}
        <div
          className="w-1/4 min-w-[260px] max-w-[380px] shrink-0 flex flex-col h-full overflow-hidden select-none bg-[color:var(--glass-sidebar)] border-l"
          style={{ borderColor: 'var(--divider)' }}
        >
          <div
            className="p-4 flex items-center gap-1.5 shrink-0"
            style={{ borderBottom: '1px solid var(--divider)' }}
          >
            <Compass className="w-3.5 h-3.5 text-[color:var(--text-muted)]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
              Repository Files
            </span>
          </div>

          <div className="flex-1 overflow-hidden p-3 min-h-0">
            {loadingFiles ? (
              <div className="flex items-center justify-center h-full py-8">
                <LoadingSpinner size="sm" label="Scanning…" />
              </div>
            ) : fileData ? (
              <div className="h-full overflow-y-auto scrollbar-thin">
                <FileExplorer files={fileData.files} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <p className="text-xs text-[color:var(--text-muted)] font-mono">No files scanned.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
