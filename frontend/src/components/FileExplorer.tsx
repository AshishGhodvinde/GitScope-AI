import { useState, useMemo, useEffect } from 'react';
import { Search, FolderOpen, FileCode, ChevronRight } from 'lucide-react';
import { useActiveFile } from '../context/ActiveFileContext';

interface FileExplorerProps {
  files: string[];
}

function buildTree(files: string[]) {
  const tree: Record<string, string[]> = {};
  files.forEach((filePath) => {
    const parts = filePath.split('/');
    if (parts.length === 1) {
      tree[''] = [...(tree[''] ?? []), filePath];
    } else {
      const dir = parts.slice(0, -1).join('/');
      tree[dir] = [...(tree[dir] ?? []), parts[parts.length - 1]];
    }
  });
  return tree;
}

const EXT_COLORS: Record<string, string> = {
  java:  '#fb923c', // orange-400
  ts:    '#60a5fa', // blue-400
  tsx:   '#22d3ee', // cyan-400
  js:    '#facc15', // yellow-400
  jsx:   '#fde047', // yellow-300
  json:  '#4ade80', // green-400
  yml:   '#a78bfa', // violet-400
  yaml:  '#a78bfa',
  xml:   '#f87171', // red-400
  md:    '#94a3b8', // slate-400
  css:   '#38bdf8', // sky-400
  html:  '#fb923c',
  py:    '#4ade80',
  go:    '#22d3ee',
  rs:    '#f97316',
  sql:   '#a78bfa',
};

function getExtColor(fileName: string): string {
  const ext = fileName.split('.').pop() ?? '';
  return EXT_COLORS[ext] ?? 'var(--text-muted)';
}

export function FileExplorer({ files }: FileExplorerProps) {
  const { activeFileTrigger } = useActiveFile();
  const [search, setSearch]       = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const filtered = useMemo(
    () => search.trim()
      ? files.filter(f => f.toLowerCase().includes(search.toLowerCase()))
      : files,
    [files, search]
  );

  const tree = useMemo(() => buildTree(filtered), [filtered]);
  const dirs = Object.keys(tree).sort();

  const toggleDir = (dir: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(dir) ? next.delete(dir) : next.add(dir);
      return next;
    });
  };

  // ── Active file highlight from source badge click ────────────────────────────
  useEffect(() => {
    if (!activeFileTrigger) return;
    const filePath = activeFileTrigger.path;
    const parts = filePath.split('/');

    if (parts.length > 1) {
      const parents: string[] = [];
      for (let i = 1; i < parts.length; i++) {
        parents.push(parts.slice(0, i).join('/'));
      }
      setCollapsed(prev => {
        const next = new Set(prev);
        parents.forEach(p => next.delete(p));
        return next;
      });
    }

    setHighlighted(filePath);
    const clear = setTimeout(() => setHighlighted(null), 3500);
    const scroll = setTimeout(() => {
      const safeId = filePath.replace(/[^a-zA-Z0-9]/g, '-');
      document.getElementById(`file-row-${safeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);

    return () => { clearTimeout(clear); clearTimeout(scroll); };
  }, [activeFileTrigger]);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Search */}
      <div className="relative mb-2 px-1">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter files…"
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition-all"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* File count */}
      <p className="text-[9px] font-semibold uppercase tracking-wider mb-2 px-1"
         style={{ color: 'var(--text-muted)' }}>
        {filtered.length} / {files.length} files
      </p>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-4 space-y-0.5 text-xs">
        {dirs.map(dir => (
          <div key={dir || '__root__'}>
            {/* Directory row */}
            {dir && (
              <button
                onClick={() => toggleDir(dir)}
                className="flex items-center gap-1 w-full text-left px-1 py-1 rounded-md transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                <ChevronRight
                  className={`w-3 h-3 shrink-0 transition-transform duration-150 ${collapsed.has(dir) ? '' : 'rotate-90'}`}
                  style={{ color: 'var(--text-muted)' }}
                />
                <FolderOpen className="w-3 h-3 shrink-0" style={{ color: '#f59e0b' }} />
                <span className="font-medium truncate text-[11px]">{dir}</span>
              </button>
            )}

            {/* Files */}
            {!collapsed.has(dir) && (
              <div className={dir ? 'ml-5 pl-2 space-y-0.5 mt-0.5' : 'space-y-0.5'}
                   style={dir ? { borderLeft: '1px solid var(--filetree-guide, rgba(99, 102, 241, 0.22))' } : {}}>
                {(tree[dir] ?? []).map(fileName => {
                  const fullPath = dir ? `${dir}/${fileName}` : fileName;
                  const isHit = highlighted === fullPath;
                  const safeId = fullPath.replace(/[^a-zA-Z0-9]/g, '-');

                  return (
                    <div
                      key={fileName}
                      id={`file-row-${safeId}`}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200 cursor-default ${
                        isHit ? 'animate-pulse' : ''
                      }`}
                      style={isHit ? {
                        background: 'rgba(99,102,241,0.12)',
                        border: '1px solid rgba(99,102,241,0.25)',
                        color: 'var(--text-primary)',
                      } : {
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={e => {
                        if (!isHit) e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                      onMouseLeave={e => {
                        if (!isHit) e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      <FileCode
                        className="w-3 h-3 shrink-0"
                        style={{ color: getExtColor(fileName) }}
                      />
                      <span className="truncate font-mono text-[11px]">{fileName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-center text-[11px] py-8" style={{ color: 'var(--text-muted)' }}>
            No files match filter.
          </p>
        )}
      </div>
    </div>
  );
}
