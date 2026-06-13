import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, User, Copy, Check } from 'lucide-react';
import { SourceList } from './SourceBadge';
import { LoadingSpinner } from './LoadingSpinner';
import { useTheme } from '../context/ThemeContext';
import type { ChatMessage as ChatMessageType } from '../types';

/**
 * Premium code sandbox block with high-contrast background for legibility.
 * BUG FIX: skips render when code content is empty/whitespace.
 */
function CodeSandboxBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const { isDark } = useTheme();

  // ── BUG FIX: Don't render empty code blocks ──────────────────────────────────
  if (!code || !code.trim()) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract file path from a leading comment line
  const lines = code.split('\n');
  let filePath = `snippet.${language || 'txt'}`;
  let cleanCode = code;

  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    const pathRegex = /^(?:\/\/|#|--|\/\*)\s*([a-zA-Z0-9_\-./]+)(?:\s*\*\/)?$/;
    const match = firstLine.match(pathRegex);
    if (match) {
      filePath = match[1];
      cleanCode = lines.slice(1).join('\n');
    } else {
      const commentRegex = /^(?:\/\/|#|--|\/\*)\s*(.*?)(?:\s*\*\/)?$/;
      const cm = firstLine.match(commentRegex);
      if (cm) {
        const content = cm[1].trim();
        if (content.includes('/') || content.includes('.')) {
          filePath = content;
          cleanCode = lines.slice(1).join('\n');
        }
      }
    }
  }

  // If after path extraction the code is empty, skip
  if (!cleanCode.trim()) return null;

  return (
    <div
      className="relative group rounded-xl overflow-hidden my-4"
      style={{ background: 'var(--code-bg)', border: '1px solid var(--code-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 select-none"
        style={{ background: 'var(--code-header)', borderBottom: '1px solid var(--code-border)' }}
      >
        <span
          className="font-mono text-[10px] font-medium truncate max-w-[80%]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {filePath}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] transition-colors focus:outline-none cursor-pointer"
          style={{ color: copied ? '#34d399' : 'var(--text-muted)' }}
          onMouseEnter={e => { if (!copied) e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { if (!copied) e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          {copied
            ? <><Check className="w-3 h-3" /><span>Copied</span></>
            : <><Copy className="w-3 h-3" /><span>Copy</span></>
          }
        </button>
      </div>

      {/* Code viewport */}
      <div className="w-full overflow-x-auto">
        <SyntaxHighlighter
          language={language || 'text'}
          style={isDark ? vscDarkPlus : prism}
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
            fontSize: '12px',
            lineHeight: '1.65',
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
          }}
          codeTagProps={{ className: 'font-mono text-sm leading-relaxed antialiased' }}
        >
          {cleanCode}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const time = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex gap-3 animate-slide-up w-full ${isUser ? 'justify-end' : 'justify-start'}`}>

      {/* Bot icon */}
      {!isUser && (
        <div
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Bot className="w-3.5 h-3.5 text-indigo-400" />
        </div>
      )}

      {/* Message frame */}
      <div className={`flex flex-col gap-1 max-w-[88%] ${isUser ? 'items-end' : 'items-start flex-1'}`}>

        {/* Metadata header */}
        <div className="flex items-center gap-1.5 text-[10px] select-none mb-0.5"
             style={{ color: 'var(--text-muted)' }}>
          <span className="font-semibold">{isUser ? 'You' : 'GitScope Assistant'}</span>
          <span>·</span>
          <span>{time}</span>
        </div>

        {/* Content bubble */}
        <div className={`text-sm w-full ${
          isUser
            ? 'px-3.5 py-2.5 rounded-xl inline-block max-w-2xl text-left'
            : 'bg-transparent py-0.5'
        }`}
          style={isUser ? {
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
          } : {}}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2 py-1 select-none">
              <LoadingSpinner size="sm" />
              <span className="text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>
                Running query…
              </span>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {message.content}
            </p>
          ) : (
            <div className="markdown-body animate-fade-in">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  code({ node: _node, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className ?? '');
                    const isInline = !match;
                    const codeString = String(children).replace(/\n$/, '');

                    return isInline ? (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    ) : (
                      <CodeSandboxBlock language={match[1] ?? 'code'} code={codeString} />
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Source citations — horizontal scroll pill row */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full mt-2 select-none">
            <SourceList sources={message.sources} />
          </div>
        )}
      </div>

      {/* User icon */}
      {isUser && (
        <div
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <User className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
        </div>
      )}
    </div>
  );
}
