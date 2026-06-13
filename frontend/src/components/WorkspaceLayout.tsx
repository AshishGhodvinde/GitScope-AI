import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import {
  GitBranch, BookOpen, MessageSquare, ExternalLink,
  ChevronLeft, Files, Database, Compass
} from 'lucide-react';
import { getRepository, getRepositoryFiles, getRepositorySummary } from '../api/repositories';
import type { Repository, FileListResponse, SummaryResponse } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { FileExplorer } from './FileExplorer';
import { useToast } from '../context/ToastContext';
import { motion } from 'framer-motion';

export interface WorkspaceContextType {
  repo: Repository | null;
  fileData: FileListResponse | null;
  summary: SummaryResponse | null;
  loadingRepo: boolean;
  loadingSummary: boolean;
  loadingFiles: boolean;
  fetchSummary: () => Promise<void>;
  refetchRepo: () => Promise<void>;
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

  const [loadingRepo,    setLoadingRepo]    = useState(true);
  const [loadingFiles,   setLoadingFiles]   = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

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

  useEffect(() => { fetchRepo(); }, [fetchRepo]);

  useEffect(() => {
    if (repo && repo.status === 'INDEXED') {
      fetchFiles();
      if (!location.pathname.endsWith('/chat')) {
        fetchSummary();
      }
    }
  }, [repo, location.pathname, fetchFiles, fetchSummary]);

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

  if (loadingRepo) {
    return (
      <div className="relative z-10 flex h-[calc(100vh-64px)] w-screen items-center justify-center">
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
      {/* ── Full viewport layout (sits below global header) ── */}
      <div className="relative z-10 flex h-[calc(100vh-64px)] w-screen overflow-hidden font-sans">

        {/* ── Left Sidebar (motion spring animation) ── */}
        <motion.aside
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          className="bg-white/40 dark:bg-zinc-950/40 backdrop-blur-2xl border-r border-zinc-200/20 dark:border-white/5 w-72 lg:w-1/4 max-w-[320px] min-w-[270px] flex-shrink-0 flex flex-col h-full overflow-hidden select-none"
          style={{ zIndex: 20 }}
        >
          {/* Top: nav home + online indicator */}
          <div className="p-4 flex items-center justify-between"
               style={{ borderBottom: '1px solid var(--divider)' }}>
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Workbench Home</span>
            </Link>

            <div className="flex items-center gap-2">
              {/* Online dot */}
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 px-1.5 py-0.5 rounded"
                   style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </div>
            </div>
          </div>

          {/* Repository identity block */}
          <div
            className="p-4 m-3 rounded-xl"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                <GitBranch className="w-4.5 h-4.5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--text-primary)' }}
                    title={`${repo.owner}/${repo.name}`}
                  >
                    {repo.name}
                  </h2>
                  {statusBadge}
                </div>
                <p className="text-xs truncate mb-1" style={{ color: 'var(--text-muted)' }}>
                  {repo.owner}
                </p>
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  GitHub Repository
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
                  className="rounded-lg p-2 flex flex-col"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--divider)' }}
                >
                  <span
                    className="text-[10px] font-medium flex items-center gap-1 mb-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Icon className="w-2.5 h-2.5" /> {label}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation hub */}
          <div className="px-3 pb-2 flex flex-col gap-1">
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

          {/* File tree portal */}
          <div className="flex-1 overflow-hidden flex flex-col px-3 pb-3 min-h-0">
            <div className="mb-2 flex items-center gap-1.5">
              <Compass className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                Repository Files
              </span>
            </div>

            <div
              className="flex-1 overflow-hidden rounded-xl"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                maxHeight: '55vh',
              }}
            >
              {loadingFiles ? (
                <div className="flex items-center justify-center h-full py-8">
                  <LoadingSpinner size="sm" label="Scanning…" />
                </div>
              ) : fileData ? (
                <div className="h-full overflow-y-auto scrollbar-thin p-2">
                  <FileExplorer files={fileData.files} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No files scanned.</p>
                </div>
              )}
            </div>
          </div>
        </motion.aside>

        {/* ── Right Content Viewport (motion spring fade/slide animation) ── */}
        <motion.main
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.08 }}
          className="flex-1 h-full overflow-hidden flex flex-col"
          style={{ minWidth: 0 }}
        >
          <Outlet context={{
            repo,
            fileData,
            summary,
            loadingRepo,
            loadingSummary,
            loadingFiles,
            fetchSummary,
            refetchRepo: fetchRepo,
          } satisfies WorkspaceContextType} />
        </motion.main>
      </div>
    </>
  );
}
