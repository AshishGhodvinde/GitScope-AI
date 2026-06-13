import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, Bot, Trash2, CornerDownLeft } from 'lucide-react';
import { getChatHistory } from '../api/chat';
import type { ChatMessage } from '../types';
import { ChatMessage as ChatMessageComponent } from '../components/ChatMessage';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { WorkspaceContextType } from '../components/WorkspaceLayout';

const SUGGESTED_QUESTIONS = [
  'How does authentication work in this project?',
  'What is the overall architecture of this repository?',
  'How is the database layer structured?',
  'What are the main API endpoints?',
  'How does error handling work?',
  'What dependencies does this project use?',
];

const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 28, delay: i * 0.05 },
  }),
};

const msgVariants: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 30 } },
};

export function ChatPage() {
  const {
    repo,
    fetchHistory,
    selectHistoryEntry,
    setSelectHistoryEntry,
  } = useOutletContext<WorkspaceContextType>();

  const { error: showError } = useToast();
  const repoId = repo?.id ?? 0;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load query from history click in left panel
  useEffect(() => {
    if (!selectHistoryEntry) return;
    const exists = messages.some(m => m.id === `h-a-${selectHistoryEntry.id}`);
    if (!exists) {
      setMessages(prev => [
        ...prev,
        {
          id: `h-u-${selectHistoryEntry.id}`,
          role: 'user',
          content: selectHistoryEntry.question,
          timestamp: new Date(selectHistoryEntry.createdAt),
        },
        {
          id: `h-a-${selectHistoryEntry.id}`,
          role: 'assistant',
          content: selectHistoryEntry.answer,
          sources: selectHistoryEntry.sources,
          timestamp: new Date(selectHistoryEntry.createdAt),
        },
      ]);
    }
    setSelectHistoryEntry(null);
  }, [selectHistoryEntry, messages, setSelectHistoryEntry]);

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

      // Fetch citations & refresh history
      try {
        const historyData = await getChatHistory(repoId);
        await fetchHistory();
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
          m.id === loadingMsg.id
            ? { ...m, content: `Connection error: ${msg}`, isLoading: false }
            : m
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

  if (!repo) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="w-full flex-1 min-w-0 flex h-full overflow-hidden"
    >
      {/* ── Main thread panel ── */}
      <div className="w-full flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[color:var(--canvas-bg)]">

        {/* Sub-header */}
        <div
          className="h-12 px-5 flex items-center justify-between shrink-0 select-none border-b"
          style={{ borderColor: 'var(--divider)', background: 'var(--glass-bg)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-dot-blink" style={{ background: 'var(--accent)' }} />
            <h1 className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
              Interactive Chat Session
            </h1>
          </div>
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

        {/* ── Message scroll area — GPU optimized ── */}
        <div className="w-full flex-1 min-w-0 flex flex-col bg-[#101411] overflow-hidden">
          <div className="chat-scroll-zone flex-1 overflow-y-auto px-8 py-6 w-full min-w-0">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center min-h-[65%] gap-8 w-full min-w-0">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center border"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--accent)', boxShadow: '0 0 24px var(--accent-glow)' }}
                >
                  <Bot className="w-7 h-7" style={{ color: 'var(--accent)' }} />
                </div>

                <div className="text-center max-w-sm min-w-0 w-full">
                  <h2 className="text-sm font-semibold mb-1 text-[color:var(--text-primary)]">
                    Ask GitScope Assistant
                  </h2>
                  <p className="text-xs leading-relaxed text-[color:var(--text-muted)]">
                    Query codebase relationships, entry routers, database schemas, or controller configurations.
                  </p>
                </div>

                <div className="w-full max-w-2xl min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUGGESTED_QUESTIONS.map((q, i) => (
                    <motion.button
                      key={q}
                      custom={i}
                      initial="hidden"
                      animate="visible"
                      variants={cardVariants}
                      onClick={() => handleSend(q)}
                      disabled={sending}
                      className="text-left p-3.5 rounded-xl transition-all text-xs leading-normal flex flex-col justify-between h-[72px] group cursor-pointer border w-full min-w-0"
                      style={{
                        background: 'var(--glass-bg)',
                        borderColor: 'var(--divider)',
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 12px var(--accent-glow)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)';
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                      }}
                    >
                      <span className="break-words min-w-0 w-full">{q}</span>
                      <span className="text-[10px] flex items-center gap-1 mt-2 font-mono" style={{ color: 'var(--accent)', opacity: 0.7 }}>
                        Query <CornerDownLeft className="w-2.5 h-2.5" />
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto w-full min-w-0 prose prose-invert break-words text-wrap space-y-8">
                <AnimatePresence initial={false}>
                  {messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      variants={msgVariants}
                      initial="hidden"
                      animate="visible"
                      className="w-full min-w-0"
                    >
                      <ChatMessageComponent message={msg} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Floating input dock ── */}
        <div className="px-4 pb-6 flex justify-center shrink-0 select-none bg-[color:var(--canvas-bg)] w-full min-w-0">
          <motion.div
            initial={{ y: 25, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.1 }}
            className="w-full max-w-3xl min-w-0"
          >
            <form
              onSubmit={handleFormSubmit}
              className="relative flex items-center rounded-2xl shadow-xl overflow-hidden transition-all border"
              style={{ borderColor: 'var(--divider)', background: 'var(--glass-bg)' }}
              onFocus={e => {
                (e.currentTarget as HTMLFormElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLFormElement).style.boxShadow = '0 0 0 3px var(--accent-glow)';
              }}
              onBlur={e => {
                (e.currentTarget as HTMLFormElement).style.borderColor = 'var(--divider)';
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
                className="flex-1 min-w-0 pl-4 pr-3 py-3.5 bg-transparent text-sm focus:outline-none resize-none max-h-[180px] leading-relaxed text-[color:var(--text-primary)]"
                style={{ caretColor: 'var(--accent)' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
                }}
              />
              <div className="flex items-center gap-1 pr-3 shrink-0">
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
    </motion.div>
  );
}
