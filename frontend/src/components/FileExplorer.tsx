import { useState, useMemo, useEffect } from 'react';
import { Search, FolderOpen, Folder, FileCode, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveFile } from '../context/ActiveFileContext';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileNode[];
}

interface FileExplorerProps {
  files: string[];
}

// ── Bulletproof Iterative Path-to-Tree Builder ────────────────────────────────
export function buildFileTree(flatPaths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const rawPath of flatPaths) {
    if (!rawPath || !rawPath.trim()) continue;
    const parts = rawPath.trim().split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue; // skip empty segments from leading/trailing slashes
      const isLast = i === parts.length - 1;
      const currentAccumulatedPath = parts.slice(0, i + 1).join('/');

      let existingNode = currentLevel.find(node => node.name === part);

      if (!existingNode) {
        const newNode: FileNode = {
          name: part,
          path: currentAccumulatedPath,
          isDirectory: !isLast,
          children: [],
        };
        currentLevel.push(newNode);
        existingNode = newNode;
      } else if (isLast && existingNode.isDirectory) {
        // A directory was previously created; mark it as a file if this is the final segment
        existingNode.isDirectory = false;
      }

      currentLevel = existingNode.children;
    }
  }

  // Sort: directories first, then files — all alphabetically
  const sortTree = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    nodes.forEach(node => {
      if (node.children.length > 0) sortTree(node.children);
    });
  };

  sortTree(root);
  return root;
}

// ── Extension colour map ──────────────────────────────────────────────────────
const EXT_COLORS: Record<string, string> = {
  java:  '#fb923c',
  ts:    '#60a5fa',
  tsx:   '#22d3ee',
  js:    '#facc15',
  jsx:   '#fde047',
  json:  '#4ade80',
  yml:   '#a78bfa',
  yaml:  '#a78bfa',
  xml:   '#f87171',
  md:    '#94a3b8',
  css:   '#38bdf8',
  html:  '#fb923c',
  py:    '#4ade80',
  go:    '#22d3ee',
  rs:    '#f97316',
  sql:   '#a78bfa',
  sh:    '#34d399',
  txt:   '#6b7280',
  gradle:'#02b0b0',
  toml:  '#a78bfa',
};

function getExtColor(fileName: string): string {
  const ext = fileName.split('.').pop() ?? '';
  return EXT_COLORS[ext] ?? 'var(--text-muted)';
}

// ── Recursive Tree Node ───────────────────────────────────────────────────────
interface TreeNodeProps {
  node: FileNode;
  depth: number;
  collapsed: Set<string>;
  toggleDir: (path: string) => void;
  highlighted: string | null;
}

function TreeNode({ node, depth, collapsed, toggleDir, highlighted }: TreeNodeProps) {
  const isOpen = !collapsed.has(node.path);
  const isHit  = highlighted === node.path;
  const indent = depth * 12;

  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => toggleDir(node.path)}
          className="flex items-center gap-1 w-full text-left py-0.5 rounded-md transition-colors duration-100"
          style={{
            paddingLeft: `${indent + 4}px`,
            paddingRight: '4px',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <ChevronRight
            className={`w-3 h-3 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          />
          {isOpen
            ? <FolderOpen className="w-3 h-3 shrink-0" style={{ color: '#e3b341' }} />
            : <Folder     className="w-3 h-3 shrink-0" style={{ color: '#e3b341' }} />
          }
          <span className="font-medium text-[11px] truncate">{node.name}</span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && node.children.length > 0 && (
            <motion.div
              key="children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ borderLeft: '1px solid var(--filetree-guide)', marginLeft: `${indent + 10}px` }}>
                {node.children.map(child => (
                  <TreeNode
                    key={child.path}
                    node={child}
                    depth={depth + 1}
                    collapsed={collapsed}
                    toggleDir={toggleDir}
                    highlighted={highlighted}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // File leaf
  const safeId = node.path.replace(/[^a-zA-Z0-9]/g, '-');
  return (
    <div
      id={`file-row-${safeId}`}
      className={`flex items-center gap-1.5 py-0.5 rounded-md transition-all duration-150 cursor-default ${
        isHit ? 'animate-pulse' : ''
      }`}
      style={{
        paddingLeft: `${indent + 8}px`,
        paddingRight: '4px',
        ...(isHit
          ? {
              background: 'rgba(15, 191, 62, 0.10)',
              border: '1px solid rgba(15, 191, 62, 0.25)',
              color: 'var(--text-primary)',
            }
          : { color: 'var(--text-muted)' }),
      }}
      onMouseEnter={e => {
        if (!isHit) e.currentTarget.style.color = 'var(--text-secondary)';
      }}
      onMouseLeave={e => {
        if (!isHit) e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      <FileCode className="w-3 h-3 shrink-0" style={{ color: getExtColor(node.name) }} />
      <span className="font-mono text-[11px] truncate">{node.name}</span>
    </div>
  );
}

// ── File Explorer Component ───────────────────────────────────────────────────
export function FileExplorer({ files }: FileExplorerProps) {
  const { activeFileTrigger } = useActiveFile();
  const [search, setSearch]           = useState('');
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set());
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      search.trim()
        ? files.filter(f => f.toLowerCase().includes(search.toLowerCase()))
        : files,
    [files, search]
  );

  const tree = useMemo(() => buildFileTree(filtered), [filtered]);

  const toggleDir = (path: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  // ── Active file highlight from source badge click ──────────────────────────
  useEffect(() => {
    if (!activeFileTrigger) return;
    const filePath = activeFileTrigger.path;
    const parts    = filePath.split('/');

    // Expand all ancestor directories
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
    const clearTimer = setTimeout(() => setHighlighted(null), 3500);
    const scrollTimer = setTimeout(() => {
      const safeId = filePath.replace(/[^a-zA-Z0-9]/g, '-');
      document.getElementById(`file-row-${safeId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);

    return () => {
      clearTimeout(clearTimer);
      clearTimeout(scrollTimer);
    };
  }, [activeFileTrigger]);

  return (
    <div className="flex flex-col h-full select-none">
      {/* Search input */}
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
          onFocus={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-glow)';
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--input-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* File count */}
      <p
        className="text-[9px] font-semibold uppercase tracking-wider mb-2 px-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {filtered.length} / {files.length} files
      </p>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-4 text-xs space-y-0.5">
        {tree.length > 0 ? (
          tree.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              collapsed={collapsed}
              toggleDir={toggleDir}
              highlighted={highlighted}
            />
          ))
        ) : (
          <p className="text-center text-[11px] py-8" style={{ color: 'var(--text-muted)' }}>
            No files match filter.
          </p>
        )}
      </div>
    </div>
  );
}
