import { Link, useLocation } from 'react-router-dom';
import { GitBranch, Zap, BookOpen, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function Navbar() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-brand-400 bg-brand-500/10 border-brand-500/30'
      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5';

  return (
    <header className="sticky top-0 z-40 shrink-0 backdrop-blur-md bg-white/30 dark:bg-zinc-950/30 border-b border-zinc-200/10 dark:border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-500/25 group-hover:shadow-brand-500/40 transition-shadow">
            <GitBranch className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            <span className="gradient-text">GitScope</span>
            <span className="text-slate-400 font-light ml-1 text-sm">AI</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${isActive('/')}`}
          >
            <Zap className="w-3.5 h-3.5" />
            Index
          </Link>
          <Link
            to="/docs"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${isActive('/docs')}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Docs
          </Link>
        </nav>

        {/* Theme toggle & Status pill */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border transition-all focus:outline-none"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
              color: 'var(--text-secondary)',
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark
              ? <Sun className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4 text-indigo-400" />
            }
          </button>

          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
            Live
          </span>
        </div>
      </div>
    </header>
  );
}
