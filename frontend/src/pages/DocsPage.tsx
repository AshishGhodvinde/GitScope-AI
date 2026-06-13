import { BookOpen, Code2, GitBranch } from 'lucide-react';

export function DocsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 animate-fade-in">
      <div className="mb-10">
        <span className="badge badge-blue mb-4">
          <BookOpen className="w-3 h-3" />
          Documentation
        </span>
        <h1 className="text-3xl font-bold text-slate-100 mb-3">
          How <span className="gradient-text">GitScope AI</span> works
        </h1>
        <p className="text-slate-400 leading-relaxed">
          GitScope AI is an AI-powered repository intelligence platform. It lets you chat
          with any public GitHub codebase using Retrieval-Augmented Generation (RAG).
        </p>
      </div>

      {[
        {
          icon: GitBranch,
          title: 'Step 1 — Index a Repository',
          color: 'brand',
          content: `Paste a public GitHub URL on the home page and click **Index Repository**.

The system will:
1. Clone the repo using JGit (shallow clone for speed)
2. Scan all source files, ignoring \`node_modules\`, \`target\`, \`build\`, etc.
3. Parse files into semantic code chunks (class-level for Java, component-level for React)
4. Generate embeddings using Google Gemini \`text-embedding-004\`
5. Store vectors in ChromaDB and metadata in PostgreSQL

Typical indexing time: **30 seconds to 3 minutes** depending on repository size.`,
        },
        {
          icon: Code2,
          title: 'Step 2 — Explore the Dashboard',
          color: 'violet',
          content: `After indexing, you land on the Repository Dashboard:

- **AI Summary** — Gemini analyses representative code samples and writes a summary covering project purpose, tech stack, architecture, and key modules.
- **Files** — A searchable, collapsible file tree of all indexed source files.`,
        },
        {
          icon: BookOpen,
          title: 'Step 3 — Chat with the Codebase',
          color: 'emerald',
          content: `Click **Chat with Repo** to open the chat interface.

**RAG pipeline:**
1. Your question is embedded using Gemini embeddings
2. ChromaDB finds the top-5 most similar code chunks
3. Those chunks become the context sent to Gemini
4. Gemini answers **only from that context** — it will say *"Information not found in repository"* if the answer isn't in the code
5. Source files are always cited below every answer

**Supported question types:**
- Architecture and design patterns
- Authentication and security flows
- Database schemas and entity relationships
- API endpoints and controllers
- Configuration and environment setup`,
        },
      ].map(({ icon: Icon, title, color, content }) => (
        <div key={title} className="glass-card p-6 mb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center
              bg-${color}-500/10 border border-${color}-500/20`}>
              <Icon className={`w-4 h-4 text-${color}-400`} />
            </div>
            <h2 className="font-semibold text-slate-200">{title}</h2>
          </div>
          <div className="markdown-body text-sm">
            {content.split('\n').map((line, i) => {
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="font-semibold text-slate-200 mt-3 mb-1">{line.slice(2, -2)}</p>;
              }
              if (line.match(/^\d+\./)) {
                return <p key={i} className="text-slate-400 ml-4 mb-1">{line}</p>;
              }
              if (line.startsWith('-')) {
                return <p key={i} className="text-slate-400 ml-4 mb-1">• {line.slice(1)}</p>;
              }
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-slate-400 mb-2 leading-relaxed">{line}</p>;
            })}
          </div>
        </div>
      ))}

      <div className="glass-card p-6">
        <h2 className="font-semibold text-slate-200 mb-4">Supported File Types</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            ['.java', 'Java', 'orange'],
            ['.ts / .tsx', 'TypeScript', 'blue'],
            ['.js / .jsx', 'JavaScript', 'yellow'],
            ['.json', 'JSON', 'green'],
            ['.yml / .yaml', 'YAML', 'violet'],
            ['.md', 'Markdown', 'slate'],
          ].map(([ext, lang, color]) => (
            <div key={ext} className="glass-card p-3">
              <p className={`text-xs font-mono font-bold text-${color}-400`}>{ext}</p>
              <p className="text-xs text-slate-500 mt-0.5">{lang}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
