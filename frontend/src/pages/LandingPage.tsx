import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, Zap, ArrowRight, CheckCircle,
  Code2, Search, MessageSquare, Lock,
} from 'lucide-react';
import { indexRepository } from '../api/repositories';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { motion, useInView } from 'framer-motion';
import type { Variants } from 'framer-motion';

// ── Data ─────────────────────────────────────────────────────────────────────
const EXAMPLE_REPOS = [
  'https://github.com/spring-projects/spring-petclinic',
  'https://github.com/facebook/react',
  'https://github.com/expressjs/express',
];

const FEATURES = [
  {
    icon: Code2,
    title: 'Smart Code Chunking',
    description: 'Semantically splits Java classes, React components, and Node routes for precise context retrieval.',
    color: '#0fbf3e',
  },
  {
    icon: Search,
    title: 'Vector Similarity Search',
    description: 'Embeds code with all-MiniLM-L6-v2 locally, stores in ChromaDB for lightning-fast semantic queries.',
    color: '#58a6ff',
  },
  {
    icon: MessageSquare,
    title: 'RAG-Powered Chat',
    description: 'Ask anything — get grounded answers with exact source files cited, never hallucinated.',
    color: '#bc8cff',
  },
  {
    icon: Lock,
    title: 'Model Fallback Routing',
    description: 'Automatically retries with gemini-1.5-flash on 429/503 errors. Zero interruptions during demos.',
    color: '#e3b341',
  },
];

const HOW_IT_WORKS = [
  'Clone repository via JGit',
  'Scan & filter source files',
  'Chunk code semantically',
  'Generate local ONNX embeddings',
  'Store vectors in ChromaDB',
  'Answer questions with RAG + Gemini',
];

// ── Animation variants (typed to satisfy Framer Motion v12 strict types) ──────
const containerVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 28 },
  },
};

// ── Section reveal wrapper (useInView) ────────────────────────────────────────
function RevealSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ type: 'spring' as const, stiffness: 220, damping: 26 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Landing Page ──────────────────────────────────────────────────────────────
export function LandingPage() {
  const [url, setUrl]         = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState('');
  const navigate = useNavigate();
  const { success, error } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) { inputRef.current?.focus(); return; }

    const githubPattern = /^https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+/;
    if (!githubPattern.test(url.trim())) {
      error('Invalid URL', 'Please enter a valid public GitHub repository URL.');
      return;
    }

    setLoading(true);
    setStep('Cloning repository…');

    const steps = [
      { msg: 'Cloning repository…',    delay: 0     },
      { msg: 'Scanning source files…', delay: 3000  },
      { msg: 'Generating embeddings…', delay: 8000  },
      { msg: 'Storing vectors…',       delay: 15000 },
      { msg: 'Finalising index…',      delay: 25000 },
    ];

    const timers = steps.map(({ msg, delay }) => setTimeout(() => setStep(msg), delay));

    try {
      const result = await indexRepository({ repositoryUrl: url.trim() });
      timers.forEach(clearTimeout);
      success('Repository indexed!', `${result.fileCount} files · ${result.chunkCount} chunks ready`);
      navigate(`/repository/${result.repositoryId}`);
    } catch (err: unknown) {
      timers.forEach(clearTimeout);
      const msg = err instanceof Error ? err.message : 'Indexing failed. Please try again.';
      error('Indexing failed', msg);
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  const setExample = (repo: string) => { setUrl(repo); inputRef.current?.focus(); };

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden" style={{ background: 'var(--canvas-bg)' }}>

      {/* ── Ambient orbs (GPU composited — no layout impact) ── */}
      <div
        className="orb animate-orb"
        style={{
          width: 600,
          height: 600,
          top: -120,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, rgba(15,191,62,0.14) 0%, transparent 70%)',
        }}
      />
      <div
        className="orb"
        style={{
          width: 400,
          height: 400,
          bottom: 200,
          right: -100,
          background: 'radial-gradient(circle, rgba(88,166,255,0.10) 0%, transparent 70%)',
          animation: 'orbFloat 16s ease-in-out infinite reverse',
        }}
      />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 bg-dots opacity-40 pointer-events-none" />

      {/* ── Hero ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-20 text-center"
      >
        {/* Badge */}
        <motion.div variants={itemVariants} className="flex justify-center mb-8">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border"
            style={{
              background: 'rgba(15,191,62,0.08)',
              borderColor: 'rgba(15,191,62,0.25)',
              color: 'var(--accent)',
            }}
          >
            <Zap className="w-3 h-3" />
            Powered by Gemini + ChromaDB + ONNX Embeddings
          </span>
        </motion.div>

        {/* Hero headline */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl sm:text-6xl lg:text-8xl font-black leading-[1.05] tracking-tight mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          Understand any
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #0fbf3e 0%, #3fb950 40%, #58d680 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 30px rgba(15,191,62,0.25))',
            }}
          >
            GitHub repo
          </span>
          <br />
          <span style={{ color: 'var(--text-secondary)' }}>with AI</span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          variants={itemVariants}
          className="text-base sm:text-lg max-w-2xl mx-auto mb-12 leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          Paste a GitHub URL. GitScope AI indexes the codebase, generates local vector embeddings,
          and lets you chat with the code — grounded answers with exact source files cited.
        </motion.p>

        {/* ── Index form ── */}
        <motion.form
          onSubmit={handleIndex}
          variants={itemVariants}
          className="relative max-w-2xl mx-auto mb-4"
        >
          <div
            className="flex flex-col sm:flex-row gap-2 p-2 rounded-2xl border transition-all duration-200"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
            }}
          >
            <div className="flex-1 relative flex items-center">
              <GitBranch
                className="absolute left-3.5 w-4 h-4 shrink-0"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                ref={inputRef}
                id="repo-url-input"
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                className="w-full pl-10 pr-4 py-3 bg-transparent border-0 font-mono text-sm focus:outline-none"
                style={{ color: 'var(--text-primary)' }}
                disabled={loading}
                aria-label="GitHub repository URL"
                onFocus={e => {
                  const wrap = e.currentTarget.closest('form')?.querySelector('.flex.gap-2') as HTMLElement | null;
                  if (wrap) {
                    wrap.style.borderColor = 'var(--accent)';
                    wrap.style.boxShadow = '0 0 0 3px var(--accent-glow)';
                  }
                }}
                onBlur={e => {
                  const wrap = e.currentTarget.closest('form')?.querySelector('.flex.gap-2') as HTMLElement | null;
                  if (wrap) {
                    wrap.style.borderColor = 'var(--glass-border)';
                    wrap.style.boxShadow = '';
                  }
                }}
              />
            </div>
            <button
              id="index-button"
              type="submit"
              disabled={loading || !url.trim()}
              className="btn-primary shrink-0 py-3 px-6 rounded-xl cursor-pointer"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Indexing…</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Index Repository
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </motion.form>

        {/* Loading status */}
        {loading && step && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm mb-4 animate-pulse"
            style={{ color: 'var(--accent)' }}
          >
            {step}
          </motion.p>
        )}

        {/* Example repos */}
        <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3 mb-24">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Try:</span>
          {EXAMPLE_REPOS.map(repo => {
            const name = repo.split('/').slice(-2).join('/');
            return (
              <button
                key={repo}
                onClick={() => setExample(repo)}
                disabled={loading}
                className="text-xs font-mono transition-colors duration-150 hover:underline cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {name}
              </button>
            );
          })}
        </motion.div>
      </motion.div>

      {/* ── Features section (scroll-triggered) ── */}
      <RevealSection className="relative max-w-5xl mx-auto px-4 sm:px-6 mb-20">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.2em] mb-8 text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          Core Capabilities
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring' as const, stiffness: 220, damping: 26, delay: i * 0.07 }}
                whileHover={{ y: -4 }}
                className="relative rounded-2xl p-5 border cursor-default overflow-hidden"
                style={{
                  background: 'var(--glass-bg)',
                  borderColor: 'var(--glass-border)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = f.color;
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${f.color}22`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--glass-border)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 border"
                  style={{ background: `${f.color}14`, borderColor: `${f.color}30` }}
                >
                  <Icon className="w-4 h-4" style={{ color: f.color }} />
                </div>
                <h3 className="font-semibold text-sm mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {f.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </RevealSection>

      {/* ── How it works — vertical timeline ── */}
      <RevealSection className="relative max-w-2xl mx-auto px-4 sm:px-6 pb-32">
        <div
          className="rounded-2xl p-7 border"
          style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}
        >
          <h2
            className="font-bold text-sm mb-6 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border"
              style={{
                color: 'var(--accent)',
                borderColor: 'rgba(15,191,62,0.25)',
                background: 'rgba(15,191,62,0.08)',
              }}
            >
              Pipeline
            </span>
            How it works
          </h2>
          <div className="relative">
            {/* Vertical connecting line */}
            <div
              className="absolute left-[13px] top-2 bottom-2 w-px"
              style={{ background: 'linear-gradient(to bottom, var(--accent), transparent)' }}
            />
            <div className="space-y-4">
              {HOW_IT_WORKS.map((s, i) => (
                <motion.div
                  key={s}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring' as const, stiffness: 220, damping: 26, delay: i * 0.06 }}
                  className="flex items-center gap-4"
                >
                  <span
                    className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 border relative z-10"
                    style={{
                      background: 'var(--canvas-bg)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                  <CheckCircle
                    className="w-3.5 h-3.5 ml-auto shrink-0"
                    style={{ color: 'var(--accent)', opacity: 0.6 }}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </RevealSection>
    </div>
  );
}
