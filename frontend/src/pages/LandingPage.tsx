import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AntiGravityCanvas } from "@/components/ui/particle-effect-for-hero"
import { Navbar } from "@/components/ui/mini-navbar"
import { Search, ArrowRight, FolderGit2, Terminal, CheckCircle2, AlertCircle, Loader2, X, BookOpen, HelpCircle, Code2, Compass } from "lucide-react"

interface LandingPageProps {
  onSelectRepo: (url: string) => void;
}

interface RepositoryListItem {
  repoIdentifier: string;
  repoUrl: string;
  branch: string;
  status: string;
  fileCount: number | null;
  chunkCount: number | null;
}

export default function LandingPage({ onSelectRepo }: LandingPageProps) {
  const [repoUrl, setRepoUrl] = useState("")
  const [isIndexing, setIsIndexing] = useState(false)
  const [recentRepos, setRecentRepos] = useState<RepositoryListItem[]>([])
  const [isDocsOpen, setIsDocsOpen] = useState(false)
  const [indexingCompleted, setIndexingCompleted] = useState(false)
  const [indexedRepoIdentifier, setIndexedRepoIdentifier] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [activeStep, setActiveStep] = useState(0)
  const [errorMsg, setErrorMsg] = useState("")

  const loadingSteps = [
    "Cloning repository from GitHub (shallow copy)...",
    "Scanning directory tree and filtering junk assets...",
    "Tokenizing source code into semantic chunks...",
    "Generating vector embeddings using local JVM ONNX model...",
    "Storing index items in ChromaDB and caching file structure..."
  ]

  useEffect(() => {
    fetch("/api/repositories")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load workspaces")
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setRecentRepos(data)
        }
      })
      .catch((err) => console.error("Error loading repositories:", err))
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!repoUrl.trim() || isIndexing) return

    setIsIndexing(true)
    setProgress(0)
    setActiveStep(0)
    setErrorMsg("")

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval)
          return 95
        }
        const next = prev + Math.floor(Math.random() * 4) + 1
        
        if (next < 20) setActiveStep(0)
        else if (next < 45) setActiveStep(1)
        else if (next < 65) setActiveStep(2)
        else if (next < 85) setActiveStep(3)
        else setActiveStep(4)
        
        return next
      })
    }, 400)

    fetch("/api/repositories/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repositoryUrl: repoUrl.trim() })
    })
      .then(async (res) => {
        // 202 Accepted is the success response for async ingestion
        if (!res.ok && res.status !== 202) {
          const text = await res.text().catch(() => "Indexing request failed")
          throw new Error(text || `HTTP error! Status: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        const identifier: string = data.repoIdentifier
        setIndexedRepoIdentifier(identifier)
        // Start polling the status endpoint until COMPLETED or FAILED
        const pollStatus = () => {
          fetch(`/api/repositories/status?id=${encodeURIComponent(identifier)}`)
            .then(r => r.json())
            .then((statusData) => {
              if (statusData.status === "COMPLETED") {
                clearInterval(progressInterval)
                setProgress(100)
                setActiveStep(4)
                setIndexingCompleted(true)
              } else if (statusData.status === "FAILED" || statusData.status === "FAILED_EMPTY") {
                clearInterval(progressInterval)
                const msg = statusData.status === "FAILED_EMPTY"
                  ? "No matching source code files found. The repository may contain only binary or lock files."
                  : (statusData.message || "Indexing failed on the server.")
                setErrorMsg(msg)
                setIsIndexing(false)
              }
              // INGESTING — keep polling
            })
            .catch(() => { /* keep polling */ })
        }
        const pollInterval = setInterval(pollStatus, 2500)
        // Clear poll interval after max 10 minutes
        setTimeout(() => clearInterval(pollInterval), 600000)
      })
      .catch((err) => {
        clearInterval(progressInterval)
        console.error("Indexing failed:", err)
        setErrorMsg(err.message || "An unexpected indexing error occurred. Please verify the GitHub URL.")
        setIsIndexing(false)
      })
  }

  const handleSelectWorkspace = (url: string) => {
    if (isIndexing) return
    onSelectRepo(url)
  }

  return (
    <div className="relative min-h-screen w-full text-white overflow-y-auto selection:bg-[#0fbf3e]/30 selection:text-white bg-black">
      <Navbar onDocsClick={() => setIsDocsOpen(true)} />
      <AntiGravityCanvas />

      <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 z-10 pointer-events-none">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="text-center text-7xl sm:text-[9rem] md:text-[11rem] lg:text-[13rem] xl:text-[15rem] font-black tracking-tighter bg-gradient-to-r from-white via-[#a2f9b4] to-[#0fbf3e] bg-clip-text text-transparent leading-none select-none"
        >
          GitScope AI
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-center text-sm md:text-base text-zinc-400 max-w-md tracking-wide font-light"
        >
          Analyze, map, and converse with any codebase architecture instantly.
        </motion.p>

        <motion.form 
          onSubmit={handleSearchSubmit}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 120, damping: 22 }}
          className="relative mt-10 w-full max-w-2xl bg-neutral-900/40 border border-neutral-800/80 backdrop-blur-xl rounded-full p-2 flex items-center shadow-3xl focus-within:border-zinc-700 transition-all group pointer-events-auto"
        >
          <Search className="ml-4 h-5 w-5 text-zinc-500 group-focus-within:text-[#0fbf3e] transition-colors flex-shrink-0" />
          <input 
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="Paste a public GitHub repository URL..."
            className="w-full bg-transparent px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
            disabled={isIndexing}
          />
          <button 
            type="submit"
            className={`p-3 rounded-full transition-all flex items-center justify-center flex-shrink-0 ${
              repoUrl && !isIndexing ? 'bg-[#0fbf3e] text-black hover:bg-[#2ea44f] scale-100 opacity-100' : 'bg-zinc-800 text-zinc-600 scale-95 opacity-50'
            }`}
            disabled={!repoUrl || isIndexing}
          >
            <ArrowRight className="h-4 w-4 stroke-[2.5]" />
          </button>
        </motion.form>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500 pointer-events-auto"
        >
          <span>Try a sample codebase:</span>
          {[
            { label: 'spring-petclinic', url: 'https://github.com/spring-projects/spring-petclinic' },
            { label: 'react-router', url: 'https://github.com/remix-run/react-router' },
            { label: 'shopping-cart', url: 'https://github.com/shashiraraja/shopping-cart' }
          ].map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => setRepoUrl(sample.url)}
              className="px-2 py-1 bg-zinc-900/60 border border-zinc-800 rounded-md text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
            >
              {sample.label}
            </button>
          ))}
        </motion.div>

        <AnimatePresence>
          {(isIndexing || errorMsg) && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="w-full max-w-xl mt-8 p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 shadow-2xl backdrop-blur-md pointer-events-auto text-left"
            >
              {errorMsg ? (
                <div className="flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-red-400">Indexing Failed</h4>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-normal">{errorMsg}</p>
                    <button
                      onClick={() => setErrorMsg("")}
                      className="mt-2 text-[10px] text-zinc-500 hover:text-white underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {indexingCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0fbf3e]" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 text-[#0fbf3e] animate-spin" />
                      )}
                      <span className="text-xs font-medium text-zinc-200">
                        {indexingCompleted ? "Indexing Complete" : "Structuring Codebase RAG..."}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[#0fbf3e] font-semibold">{progress}%</span>
                  </div>

                  <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-[#0fbf3e] to-[#2ea44f] rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>

                  {indexingCompleted ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="pt-2 flex flex-col items-center gap-4 text-center"
                    >
                      <p className="text-xs text-zinc-300">
                        Workspace files tokenized, embedded, and cached in vector database. Your RAG environment is ready.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (indexedRepoIdentifier) {
                            onSelectRepo(repoUrl.trim());
                            setIsIndexing(false);
                            setIndexingCompleted(false);
                            setIndexedRepoIdentifier(null);
                          }
                        }}
                        className="px-5 py-2.5 rounded-full bg-[#0fbf3e] hover:bg-[#2ea44f] text-black font-semibold text-xs transition-all shadow-lg shadow-[#0fbf3e]/20 flex items-center gap-1.5 cursor-pointer"
                      >
                        Proceed to Workspace <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      {loadingSteps.map((step, idx) => {
                        const isDone = progress >= (idx + 1) * 20
                        const isActive = activeStep === idx

                        return (
                          <div key={idx} className="flex items-start gap-2.5 text-[11px]">
                            <div className="mt-0.5 shrink-0">
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#0fbf3e]" />
                              ) : isActive ? (
                                <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-neutral-700" />
                              )}
                            </div>
                            <span className={isDone ? "text-zinc-500 line-through" : isActive ? "text-white font-medium animate-pulse" : "text-zinc-600"}>
                              {step}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div id="recent-workspaces" className="relative w-full max-w-5xl mx-auto px-6 pb-24 z-10 pointer-events-none -mt-12 scroll-mt-24">
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-neutral-800 to-transparent my-12" />
        
        <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase flex items-center gap-2 mb-6">
          <Terminal className="h-4 w-4 text-zinc-500" /> Recent Workspaces
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pointer-events-auto">
          {recentRepos.length > 0 ? (
            recentRepos.map((project) => {
              // Parse owner/name from the repoUrl
              const urlParts = project.repoUrl.replace(/\.git$/, "").split("/")
              const repoName  = urlParts[urlParts.length - 1] ?? project.repoUrl
              const repoOwner = urlParts[urlParts.length - 2] ?? ""
              const isReady   = project.status === "COMPLETED"
              const isFailing = project.status === "FAILED" || project.status === "FAILED_EMPTY"
              return (
              <div 
                key={project.repoIdentifier}
                onClick={() => isReady && handleSelectWorkspace(project.repoUrl)}
                className={`group relative bg-neutral-900/20 border border-neutral-900 backdrop-blur-md rounded-xl p-5 hover:bg-neutral-900/40 hover:border-zinc-800 transition-all flex items-start justify-between ${
                  isReady ? "cursor-pointer" : "cursor-default opacity-75"
                }`}
              >
                <div className="flex gap-4 items-start">
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg group-hover:border-zinc-700 transition-all text-zinc-400 group-hover:text-white">
                    <FolderGit2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-zinc-200 group-hover:text-white transition-colors">
                      {repoOwner} <span className="text-zinc-600">/</span> {repoName}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full inline-block ${
                          isReady ? "bg-[#0fbf3e]" : isFailing ? "bg-red-500" : "bg-yellow-500 animate-pulse"
                        }`} /> 
                        {isReady ? "Ready" : isFailing ? "Failed" : "Indexing"}
                      </span>
                      {project.branch && project.branch !== "main" && (
                        <>
                          <span>•</span>
                          <span>{project.branch}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] uppercase font-medium tracking-wider px-2 py-1 bg-zinc-900/80 border border-zinc-800 text-zinc-400 rounded-md">
                  {project.status}
                </div>
              </div>
              )
            })
          ) : (
            <div className="col-span-2 text-center py-8 text-xs text-zinc-600 border border-dashed border-neutral-800 rounded-xl">
              No active workspaces found. Paste a GitHub URL above to index your first repository.
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isDocsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDocsOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-lg z-50 bg-[#0d1117] border-l border-neutral-800 shadow-2xl p-6 overflow-y-auto pointer-events-auto flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#0fbf3e]/10 border border-[#0fbf3e]/20 rounded-lg text-[#0fbf3e]">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-white">Documentation Guide</h3>
                    <p className="text-xs text-zinc-500">Learn how to maximize GitScope AI</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDocsOpen(false)}
                  className="p-1.5 hover:bg-neutral-800 rounded-lg text-zinc-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 space-y-6 text-sm">
                
                <div className="p-4 bg-gradient-to-br from-[#0fbf3e]/5 to-transparent border border-[#0fbf3e]/10 rounded-xl">
                  <h4 className="font-semibold text-white mb-1.5 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#0fbf3e]" />
                    What is GitScope AI?
                  </h4>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    GitScope AI is an advanced workspace agent designed to help developers comprehend legacy architectures, find symbols, and solve codebase issues locally.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-white border-b border-neutral-800 pb-1">Getting Started</h4>
                  <ol className="space-y-4">
                    <li className="flex gap-3">
                      <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-neutral-850 text-xs text-zinc-300 font-mono flex-shrink-0">1</span>
                      <div>
                        <h5 className="font-medium text-zinc-200 text-xs">Enter repository URL</h5>
                        <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">
                          Paste any public GitHub repository URL into the command box. E.g. <code>https://github.com/spring-projects/spring-petclinic</code>.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-neutral-850 text-xs text-zinc-300 font-mono flex-shrink-0">2</span>
                      <div>
                        <h5 className="font-medium text-zinc-200 text-xs">Workspace Chunking & Embedding</h5>
                        <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">
                          GitScope clones the code, tokenizes files into semantic chunks, generates vector embeddings using our local JVM ONNX model, and saves them to ChromaDB.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-neutral-850 text-xs text-zinc-300 font-mono flex-shrink-0">3</span>
                      <div>
                        <h5 className="font-medium text-zinc-200 text-xs">Converse with Architecture</h5>
                        <p className="text-zinc-400 text-[11px] leading-relaxed mt-0.5">
                          Once indexing completes, your workspace is ready. You can query files, ask visual architectures, and perform code chats.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-white border-b border-neutral-800 pb-1">Chat & Issues Mode</h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                      <h5 className="font-medium text-zinc-200 text-xs flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-[#0fbf3e]" />
                        General Q&A
                      </h5>
                      <p className="text-zinc-400 text-[11px] leading-relaxed mt-1">
                        Use the chat interface to ask questions about your codebase logic, file functions, configuration options, or to get help tracing complex call flows.
                      </p>
                    </div>

                    <div className="p-3 bg-neutral-900/50 border border-neutral-800 rounded-lg">
                      <h5 className="font-medium text-zinc-200 text-xs flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-[#0fbf3e]" />
                        Issues Solver
                      </h5>
                      <p className="text-zinc-400 text-[11px] leading-relaxed mt-1">
                        Toggle the <b>Issues</b> mode in the prompt box, paste bug details or features list, and GitScope AI will analyze your workspace structure to prepare a verification and task checklist.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              <div className="border-t border-neutral-800 pt-4 mt-6 text-center">
                <span className="text-[10px] text-zinc-600 font-mono">GitScope AI v1.0.0 • Local LLM & ChromaDB RAG</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
