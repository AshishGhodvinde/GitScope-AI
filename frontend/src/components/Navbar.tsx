import { Link, useLocation } from 'react-router-dom';
import { GitBranch, Zap, BookOpen, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';

export function Navbar() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header
      className="sticky top-0 z-40 shrink-0 border-b"
      style={{
        background: 'var(--canvas-bg)',
        borderColor: 'var(--divider)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-200 group-hover:shadow-lg"
            style={{
              background: 'rgba(15,191,62,0.12)',
              borderColor: 'rgba(15,191,62,0.30)',
              boxShadow: '0 0 12px rgba(15,191,62,0.10)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(15,191,62,0.25)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(15,191,62,0.55)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 12px rgba(15,191,62,0.10)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(15,191,62,0.30)';
            }}
          >
            <GitBranch className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>
          <span className="font-bold text-lg tracking-tight">
            <span className="gradient-text">GitScope</span>
            <span className="font-light ml-1 text-sm" style={{ color: 'var(--text-muted)' }}>AI</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {[
            { to: '/',     icon: Zap,      label: 'Index' },
            { to: '/docs', icon: BookOpen, label: 'Docs'  },
          ].map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200"
              style={{
                borderColor: isActive(to) ? 'rgba(15,191,62,0.30)' : 'transparent',
                background:  isActive(to) ? 'rgba(15,191,62,0.08)' : 'transparent',
                color:       isActive(to) ? 'var(--accent)' : 'var(--text-muted)',
              }}
              onMouseEnter={e => {
                if (!isActive(to)) {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive(to)) {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)';
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                }
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {isActive(to) && (
                <motion.div
                  layoutId="nav-active-dot"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ background: 'var(--accent)' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border transition-all focus:outline-none"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 8px var(--accent-glow)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--glass-border)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark
              ? <Sun  className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4 text-indigo-400" />
            }
          </button>

          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-dot-blink" style={{ background: 'var(--accent)' }} />
            Live
          </span>
        </div>
      </div>
    </header>
  );
}
