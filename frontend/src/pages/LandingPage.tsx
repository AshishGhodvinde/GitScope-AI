import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Zap, ArrowRight, CheckCircle, Code2, Search, MessageSquare } from 'lucide-react';
import { indexRepository } from '../api/repositories';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { motion } from 'framer-motion';

const EXAMPLE_REPOS = [
  'https://github.com/spring-projects/spring-petclinic',
  'https://github.com/facebook/react',
  'https://github.com/expressjs/express',
];

const FEATURES = [
  {
    icon: Code2,
    title: 'Smart Code Chunking',
    description: 'Semantically splits Java classes, React components, and Node routes for precise retrieval.',
    color: 'brand',
  },
  {
    icon: Search,
    title: 'Vector Search',
    description: 'Embeds code with Gemini and stores in ChromaDB for lightning-fast semantic similarity search.',
    color: 'violet',
  },
  {
    icon: MessageSquare,
    title: 'RAG-Powered Chat',
    description: 'Ask anything — get grounded answers with exact source files cited, never hallucinated.',
    color: 'emerald',
  },
];

const featureColors: Record<string, string> = {
  brand:   'from-brand-500/20 to-brand-600/5 border-brand-500/20 text-brand-400',
  violet:  'from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-400',
  emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
};

export function LandingPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const navigate = useNavigate();
  const { success, error } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      inputRef.current?.focus();
      return;
    }

    const githubPattern = /^https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+/;
    if (!githubPattern.test(url.trim())) {
      error('Invalid URL', 'Please enter a valid public GitHub repository URL.');
      return;
    }

    setLoading(true);
    setStep('Cloning repository…');

    const steps = [
      { msg: 'Cloning repository…',     delay: 0     },
      { msg: 'Scanning source files…',  delay: 3000  },
      { msg: 'Generating embeddings…',  delay: 8000  },
      { msg: 'Storing vectors…',        delay: 15000 },
      { msg: 'Finalising index…',       delay: 25000 },
    ];

    const timers = steps.map(({ msg, delay }) =>
      setTimeout(() => setStep(msg), delay)
    );

    try {
      const result = await indexRepository({ repositoryUrl: url.trim() });
      timers.forEach(clearTimeout);
      success(
        'Repository indexed!',
        `${result.fileCount} files · ${result.chunkCount} chunks ready`
      );
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

  const setExample = (repo: string) => {
    setUrl(repo);
    inputRef.current?.focus();
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
      }}
      className="relative min-h-[calc(100vh-64px)] overflow-hidden"
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-dots opacity-60 pointer-events-none" />
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[600px]
                      bg-gradient-radial from-brand-600/15 via-violet-600/5 to-transparent
                      rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-32">
        {/* Badge */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: -10 },
            visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } }
          }}
          className="flex justify-center mb-8"
        >
          <span className="badge badge-blue">
            <Zap className="w-3 h-3" />
            Powered by Gemini + ChromaDB
          </span>
        </motion.div>

        {/* Hero headline */}
        <motion.h1
          variants={{
            hidden: { opacity: 0, y: 20, scale: 0.98 },
            visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 26 } }
          }}
          className="text-center text-5xl sm:text-6xl lg:text-7xl font-black leading-tight tracking-tight mb-6"
        >
          Understand any
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-tr from-orange-400 via-pink-500 to-indigo-400 filter drop-shadow-[0_2px_15px_rgba(236,72,153,0.15)] select-none">
            GitHub repo
          </span>
          <br />
          <span className="text-slate-700 dark:text-slate-300">with AI</span>
        </motion.h1>

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 15 },
            visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } }
          }}
          className="text-center text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Paste a GitHub URL. GitScope AI indexes the codebase, generates embeddings,
          and lets you chat with the code — getting grounded answers with exact source files.
        </motion.p>

        {/* Index form (Frosted Command Console Capsule) */}
        <motion.form
          onSubmit={handleIndex}
          variants={{
            hidden: { opacity: 0, y: 15 },
            visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } }
          }}
          className="shadow-2xl backdrop-blur-xl border border-zinc-200/30 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 p-2.5 flex flex-col sm:flex-row gap-2 mb-4 rounded-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-blue-400/20 focus-within:border-blue-500/50 dark:focus-within:border-blue-400/40 shadow-inner"
        >
          <div className="flex-1 relative flex items-center">
            <GitBranch className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              ref={inputRef}
              id="repo-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              className="w-full pl-10 pr-4 py-3 bg-transparent border-0 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-0 transition-all duration-200"
              disabled={loading}
              aria-label="GitHub repository URL"
            />
          </div>
          <button
            id="index-button"
            type="submit"
            disabled={loading || !url.trim()}
            className="btn-primary shrink-0 py-3.5 px-6 rounded-xl cursor-pointer"
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
        </motion.form>

        {/* Loading status */}
        {loading && step && (
          <p className="text-center text-sm text-brand-400 animate-pulse mb-4">{step}</p>
        )}

        {/* Example repos */}
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { delay: 0.1, type: 'spring', stiffness: 220, damping: 26 } }
          }}
          className="flex flex-wrap justify-center gap-2 mb-20"
        >
          <span className="text-xs text-slate-600">Try:</span>
          {EXAMPLE_REPOS.map((repo) => {
            const name = repo.split('/').slice(-2).join('/');
            return (
              <button
                key={repo}
                onClick={() => setExample(repo)}
                className="text-xs text-slate-500 hover:text-brand-400 font-mono
                           transition-colors duration-150 hover:underline cursor-pointer"
                disabled={loading}
              >
                {name}
              </button>
            );
          })}
        </motion.div>

        {/* Feature cards */}
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
          className="grid sm:grid-cols-3 gap-4 mb-16"
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const c = featureColors[f.color];
            return (
              <motion.div
                key={f.title}
                variants={{
                  hidden: { opacity: 0, y: 15, scale: 0.98 },
                  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 26 } }
                }}
                className={`glass-card-hover p-5 bg-gradient-to-br ${c.split(' ')[0]} ${c.split(' ')[1]}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                                 bg-gradient-to-br ${c.split(' ')[0]} border ${c.split(' ')[2]}
                                 mb-3`}>
                  <Icon className={`w-4.5 h-4.5 ${c.split(' ')[3]}`} />
                </div>
                <h3 className="font-semibold text-slate-200 mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* How it works */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 15 },
            visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 26 } }
          }}
          className="glass-card p-6"
        >
          <h2 className="font-semibold text-slate-200 mb-5 flex items-center gap-2">
            <span className="gradient-text">How it works</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Clone repository via JGit',
              'Scan & filter source files',
              'Chunk code semantically',
              'Generate Gemini embeddings',
              'Store vectors in ChromaDB',
              'Answer questions with RAG',
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/30
                                 text-brand-400 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-400">{step}</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500/60 ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
