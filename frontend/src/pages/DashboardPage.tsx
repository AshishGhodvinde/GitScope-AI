import { useOutletContext, Link } from 'react-router-dom';
import { MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react';
import type { WorkspaceContextType } from '../components/WorkspaceLayout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';

/**
 * High-Density Repository Dashboard / Summary View.
 * Displays the cached AI-generated codebase summary with proper layout containment.
 */
export function DashboardPage() {
  const {
    repo,
    summary,
    loadingSummary,
  } = useOutletContext<WorkspaceContextType>();

  if (!repo) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full flex-1 min-w-0 flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--canvas-bg)' }}
    >
      {/* Sub-header */}
      <div
        className="h-12 px-5 md:px-8 flex items-center justify-between shrink-0 select-none border-b"
        style={{ borderColor: 'var(--divider)', background: 'var(--glass-bg)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: repo.status === 'INDEXED' ? 'var(--accent)' : 'var(--text-muted)' }}
          />
          <h1
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            Codebase Insights Summary
          </h1>
        </div>

        {repo.status === 'INDEXED' && (
          <Link
            to={`/repository/${repo.id}/chat`}
            className="btn-primary !text-xs !py-1.5 !px-3"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat with Code
          </Link>
        )}
      </div>

      {/* ── Scroll area (w-full + min-w-0 containment) ── */}
      <div className="w-full flex-1 min-w-0 overflow-y-auto p-6 md:p-10 scrollbar-hide">
        <div className="max-w-3xl mx-auto w-full min-w-0">

          {/* INDEXING state */}
          {repo.status === 'INDEXING' && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <LoadingSpinner size="lg" />
              <div className="text-center">
                <p className="text-sm font-medium animate-pulse" style={{ color: 'var(--text-primary)' }}>
                  Analyzing repository &amp; generating codebase map…
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  Building embeddings and syntax structures. This may take a few minutes.
                </p>
              </div>
            </div>
          )}

          {/* FAILED state */}
          {repo.status === 'FAILED' && (
            <div
              className="rounded-xl p-6 flex flex-col sm:flex-row items-start gap-4"
              style={{
                background: 'rgba(248,81,73,0.05)',
                border: '1px solid rgba(248,81,73,0.18)',
              }}
            >
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-rose-400 text-sm mb-1">Indexing Failed</h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Something went wrong during indexing. Return to Home to re-index the repository.
                </p>
                <Link to="/" className="btn-secondary mt-3 inline-flex !text-xs !py-1.5 !px-3">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Index Another Repo
                </Link>
              </div>
            </div>
          )}

          {/* INDEXED state */}
          {repo.status === 'INDEXED' && (
            <div className="space-y-4 w-full min-w-0">
              {loadingSummary ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <LoadingSpinner size="lg" />
                  <p className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>
                    Synthesizing code statistics with Gemini…
                  </p>
                </div>
              ) : summary ? (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="rounded-2xl p-6 md:p-8 w-full min-w-0"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {/* Markdown with full-width containment */}
                  <article className="markdown-body custom-summary-layout w-full min-w-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {summary.summary}
                    </ReactMarkdown>
                  </article>
                </motion.div>
              ) : (
                <div className="text-center py-12 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Summary could not be generated.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
