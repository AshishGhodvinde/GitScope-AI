import { FileCode, Hash } from 'lucide-react';
import { useActiveFile } from '../context/ActiveFileContext';

interface SourceBadgeProps {
  filePath: string;
}

const EXT_COLORS: Record<string, string> = {
  java: '#fb923c',
  ts:   '#60a5fa',
  tsx:  '#22d3ee',
  js:   '#facc15',
  jsx:  '#fde047',
  json: '#4ade80',
  yml:  '#a78bfa',
  yaml: '#a78bfa',
  xml:  '#f87171',
  md:   '#94a3b8',
  css:  '#38bdf8',
  html: '#fb923c',
  py:   '#4ade80',
  go:   '#22d3ee',
  sql:  '#a78bfa',
};

/**
 * A single micro-pill source chip with file-type color dot.
 * Styled as a horizontal scrollable pill badge.
 */
export function SourceBadge({ filePath }: SourceBadgeProps) {
  const { triggerFileSelect } = useActiveFile();
  const fileName = filePath.split('/').pop() ?? filePath;
  const ext = fileName.split('.').pop() ?? '';
  const color = EXT_COLORS[ext] ?? 'var(--text-muted)';

  return (
    <span
      onClick={() => triggerFileSelect(filePath)}
      className="source-chip"
      title={`Click to locate: ${filePath}`}
    >
      {/* Colored dot for file type */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 flex-shrink-0"
        style={{ background: color }}
      />
      <FileCode className="w-3 h-3 shrink-0" style={{ color }} />
      <span className="truncate max-w-[180px]">{fileName}</span>
    </span>
  );
}

/**
 * Horizontal scrolling source pill row with count header.
 */
export function SourceList({ sources }: { sources: string[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div
      className="mt-2 pt-2.5"
      style={{ borderTop: '1px solid var(--divider)' }}
    >
      <div className="flex items-center gap-1.5 mb-2 select-none">
        <Hash className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Grounding Citations ({sources.length})
        </span>
      </div>

      {/* Horizontal scrolling pill row */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 flex-wrap">
        {sources.map(src => (
          <SourceBadge key={src} filePath={src} />
        ))}
      </div>
    </div>
  );
}
