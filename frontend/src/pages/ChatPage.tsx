import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, Bot, Trash2, History, CornerDownLeft } from 'lucide-react';
import { getChatHistory } from '../api/chat';
import type { ChatMessage, ChatHistoryEntry } from '../types';
import { ChatMessage as ChatMessageComponent } from '../components/ChatMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkspaceContextType } from '../components/WorkspaceLayout';

const SUGGESTED_QUESTIONS = [
  'How does authentication work in this project?',
  'What is the overall architecture of this repository?',
  'How is the database layer structured?',
  'What are the main API endpoints?',
  'How does error handling work?',
  'What dependencies does this project use?',
];

export function ChatPage() {
  const { repo } = useOutletContext<WorkspaceContextType>();
  const { error: showError } = useToast();
  const repoId = repo?.id ?? 0;

  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]         = useState<ChatHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!repoId) return;
    setLoadingHistory(true);
    try {
      const data = await getChatHistory(repoId);
      setHistory(data);
    } catch {
      showError('Error', 'Failed to retrieve chat history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [repoId, showError]);

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory, fetchHistory]);

  // Send message
  const handleSend = async (question: string) => {
    const q = question.trim();
    if (!q || sending || !repoId) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: q,
      timestamp: new Date(),
    };
    const loadingMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setSending(true);

    const apiBase = import.meta.env.VITE_API_URL ?? '/api';

    try {
      const response = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryId: repoId, question: q }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Network response error');
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finished = false;
      let accumulatedAnswer = '';
      let buffer = '';
      let isFirstLineInEvent = true;

      setMessages(prev =>
        prev.map(m => m.id === loadingMsg.id ? { ...m, content: '', isLoading: false } : m)
      );

      while (reader && !finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const cleanLine = line.endsWith('\r') ? line.slice(0, -1) : line;
            if (cleanLine.startsWith('data:')) {
              let dataValue = cleanLine.substring(5);
              if (dataValue.startsWith(' ')) dataValue = dataValue.substring(1);
              if (!isFirstLineInEvent) accumulatedAnswer += '\n';
              accumulatedAnswer += dataValue;
              isFirstLineInEvent = false;
            } else if (cleanLine === '') {
              isFirstLineInEvent = true;
            }
          }

          setMessages(prev =>
            prev.map(m => m.id === loadingMsg.id ? { ...m, content: accumulatedAnswer } : m)
          );
        }
      }

      // Fetch citations from history
      try {
        const historyData = await getChatHistory(repoId);
        setHistory(historyData);
        if (historyData.length > 0) {
          const latestEntry = historyData[0];
          setMessages(prev =>
            prev.map(m => m.id === loadingMsg.id ? { ...m, sources: latestEntry.sources } : m)
          );
        }
      } catch (e) {
        console.error('Failed to load citations from history', e);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Timeout or API service unavailable.';
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id ? { ...m, content: `Connection error: ${msg}`, isLoading: false } : m
        )
      );
      showError('Network Error', msg);
    } finally {
      setSending(false);
      if (inputRef.current) {
        inputRef.current.style.height = '48px';
        inputRef.current.focus();
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSend(input); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); }
  };

  const clearMessages = () => setMessages([]);

  const loadHistoryMessage = (entry: ChatHistoryEntry) => {
    setMessages(prev => [
      ...prev,
      {
        id: `h-u-${entry.id}`,
        role: 'user',
        content: entry.question,
        timestamp: new Date(entry.createdAt),
      },
      {
        id: `h-a-${entry.id}`,
        role: 'assistant',
        content: entry.answer,
        sources: entry.sources,
        timestamp: new Date(entry.createdAt),
      },
    ]);
    setShowHistory(false);
  };

  if (!repo) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className="flex-1 flex h-full overflow-hidden"
    >

      {/* ── Main thread panel ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* Sub-header */}
        <div
          className="h-12 px-5 flex items-center justify-between shrink-0 select-none"
          style={{
            borderBottom: '1px solid var(--divider)',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
            <h1
              className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Interactive Chat Session
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="toggle-history"
              onClick={() => setShowHistory(v => !v)}
              className="btn-secondary !px-2.5 !py-1.5 !text-xs"
              title="Chat history"
              style={showHistory ? {
                background: 'rgba(99,102,241,0.12)',
                borderColor: 'rgba(99,102,241,0.3)',
              } : {}}
            >
              <History className="w-3.5 h-3.5" />
            </button>
            <button
              id="clear-chat"
              onClick={clearMessages}
              className="btn-secondary !px-2.5 !py-1.5 !text-xs"
              title="Clear chat"
              disabled={messages.length === 0}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Message scroll area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-12 py-8 space-y-8 scrollbar-hide">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center min-h-[65%] gap-8">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(99,102,241,0.10)',
                  border: '1px solid rgba(99,102,241,0.18)',
                }}
              >
                <Bot className="w-6 h-6 text-indigo-400" />
              </div>

              <div className="text-center max-w-sm">
                <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Ask GitScope Assistant
                </h2>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Query codebase relationships, entry routers, database schemas, or controller configurations.
                </p>
              </div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
                }}
                className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2"
              >
                {SUGGESTED_QUESTIONS.map(q => (
                  <motion.button
                    key={q}
                    onClick={() => handleSend(q)}
                    disabled={sending}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } }
                    }}
                    className="text-left p-3.5 rounded-xl transition-all text-xs leading-normal flex flex-col justify-between h-[72px] group cursor-pointer"
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-muted)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <span>{q}</span>
                    <span
                      className="text-[10px] flex items-center gap-1 mt-2 font-mono"
                      style={{ color: 'var(--text-muted)', opacity: 0.6 }}
                    >
                      Query <CornerDownLeft className="w-2.5 h-2.5" />
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8">
              {messages.map(msg => (
                <ChatMessageComponent key={msg.id} message={msg} />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Floating capsule input dock (spring entry) ── */}
        <div className="px-4 pb-6 flex justify-center shrink-0 select-none">
          <motion.div
            initial={{ y: 25, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.12 }}
            className="w-full max-w-3xl"
          >
            <form
              onSubmit={handleFormSubmit}
              className="relative flex items-center rounded-2xl shadow-2xl overflow-hidden transition-all border border-zinc-200/30 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl"
              style={{}}
              onFocus={e => {
                (e.currentTarget as HTMLFormElement).style.borderColor = 'rgba(99,102,241,0.45)';
                (e.currentTarget as HTMLFormElement).style.boxShadow = '0 0 0 3px rgba(99,102,241,0.10), 0 8px 32px rgba(0,0,0,0.3)';
              }}
              onBlur={e => {
                (e.currentTarget as HTMLFormElement).style.borderColor = '';
                (e.currentTarget as HTMLFormElement).style.boxShadow = '';
              }}
            >
              <textarea
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Query codebase details about ${repo.name}…`}
                rows={1}
                disabled={sending}
                className="flex-1 pl-4 pr-3 py-3.5 bg-transparent text-sm focus:outline-none resize-none max-h-[180px] leading-relaxed"
                style={{
                  color: 'var(--text-primary)',
                  caretColor: 'var(--accent)',
                }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
                }}
              />

              {/* Right actions: send */}
              <div className="flex items-center gap-1 pr-3 shrink-0">
                {/* Send button */}
                <button
                  id="send-message"
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="p-2 rounded-lg transition-all focus:outline-none cursor-pointer"
                  style={{
                    color: (sending || !input.trim()) ? 'var(--text-muted)' : 'var(--accent)',
                    opacity: (sending || !input.trim()) ? 0.4 : 1,
                  }}
                  aria-label="Send query"
                >
                  {sending ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>

      {/* ── History panel (right slide motion) ── */}
      <AnimatePresence>
        {showHistory && (
          <motion.aside
            key="chat-history-sidebar"
            initial={{ x: 280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 280, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="w-72 flex-shrink-0 flex flex-col h-full overflow-hidden select-none border-l border-zinc-200/20 dark:border-white/5 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-2xl"
            style={{}}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--divider)' }}
            >
              <h3 className="font-semibold text-xs flex items-center gap-1.5"
                  style={{ color: 'var(--text-secondary)' }}>
                <History className="w-3.5 h-3.5" />
                Query History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-[10px] transition-colors cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="sm" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No previous questions found.
                </p>
              ) : (
                history.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => loadHistoryMessage(entry)}
                    className="w-full text-left p-3 rounded-xl transition-all cursor-pointer"
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--glass-border-h)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                    }}
                  >
                    <p className="text-xs font-medium truncate mb-1 leading-normal"
                       style={{ color: 'var(--text-primary)' }}>
                      {entry.question}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {entry.answer}
                    </p>
                    <p className="text-[9px] mt-1.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
