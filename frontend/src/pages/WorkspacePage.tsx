import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, 
  ArrowRight, 
  FolderGit2, 
  ChevronRight, 
  FileText, 
  Search, 
  CheckSquare, 
  Square,
  Copy,
  Check,
  X,
  Loader2,
  Folder,
  FolderOpen,
  FileCode
} from "lucide-react"
import { PromptInputBox } from "@/components/ui/ai-prompt-box"
import type { PromptMode } from "@/components/ui/ai-prompt-box"
import { LiquidAurora } from "@/components/ui/liquid-aurora"

interface WorkspacePageProps {
  repoId: number;
  repoUrl: string;
  onBack: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  citations?: string[];
  isLoading?: boolean;
  mode?: PromptMode;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileNode[];
}

interface RepositoryDetails {
  id: number;
  name: string;
  owner: string;
  url: string;
  status: string;
  fileCount: number | null;
  chunkCount: number | null;
}

const EXT_COLORS: Record<string, string> = {
  java:   '#fb923c',
  ts:     '#60a5fa',
  tsx:    '#22d3ee',
  js:     '#facc15',
  jsx:    '#fde047',
  json:   '#4ade80',
  yml:    '#a78bfa',
  yaml:   '#a78bfa',
  xml:    '#f87171',
  md:     '#94a3b8',
  css:    '#38bdf8',
  html:   '#fb923c',
  py:     '#4ade80',
  go:     '#22d3ee',
  sql:    '#a78bfa',
};

function getExtColor(fileName: string): string {
  const ext = fileName.split('.').pop() ?? '';
  return EXT_COLORS[ext] ?? '#8b949e';
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  collapsed: Set<string>;
  toggleDir: (path: string) => void;
  onSelectFile: (path: string) => void;
}

function TreeNode({ node, depth, collapsed, toggleDir, onSelectFile }: TreeNodeProps) {
  const isOpen = !collapsed.has(node.path);

  if (node.isDirectory) {
    return (
      <div className="w-full">
        <button
          onClick={() => toggleDir(node.path)}
          className="flex items-center gap-1.5 min-w-full w-max text-left py-1 px-2 rounded-md hover:bg-neutral-800/30 text-zinc-400 hover:text-white transition-colors duration-100 whitespace-nowrap"
          style={{ paddingLeft: '6px' }}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
            style={{ color: '#484f58' }}
          />
          {isOpen
            ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#e3b341]" />
            : <Folder className="w-3.5 h-3.5 shrink-0 text-[#e3b341]" />
          }
          <span className="font-mono text-xs">{node.name}</span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && node.children.length > 0 && (
            <motion.div
              key="children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="border-l border-neutral-800/80" style={{ marginLeft: '12px' }}>
                {node.children.map(child => (
                  <TreeNode
                    key={child.path}
                    node={child}
                    depth={depth + 1}
                    collapsed={collapsed}
                    toggleDir={toggleDir}
                    onSelectFile={onSelectFile}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className="flex items-center gap-1.5 min-w-full w-max text-left py-1 px-2 rounded-md hover:bg-neutral-800/30 text-zinc-300 hover:text-white transition-colors duration-100 whitespace-nowrap"
      style={{ paddingLeft: '6px' }}
    >
      <div className="w-3.5 h-3.5 shrink-0" />
      <FileCode className="w-3.5 h-3.5 shrink-0" style={{ color: getExtColor(node.name) }} />
      <span className="font-mono text-xs">{node.name}</span>
    </button>
  );
}

interface MessageBubbleProps {
  msg: ChatMessage;
  onOpenCitation: (path: string) => void;
}

function MessageBubble({ msg, onOpenCitation }: MessageBubbleProps) {
  const [tasks, setTasks] = useState<{ id: string; text: string; done: boolean }[]>([]);

  useEffect(() => {
    if (msg.sender === "assistant" && msg.mode === "issues" && msg.text) {
      const regex = /-\s*\[([ xX]?)\]\s*(.+)/g;
      const parsedTasks: { id: string; text: string; done: boolean }[] = [];
      let match;
      let count = 0;
      while ((match = regex.exec(msg.text)) !== null) {
        parsedTasks.push({
          id: `${msg.id}-t-${count++}`,
          text: match[2].trim(),
          done: match[1].toLowerCase() === "x"
        });
      }
      setTasks(parsedTasks);
    }
  }, [msg]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const isUser = msg.sender === "user";

  const cleanText = useMemo(() => {
    if (msg.mode === "issues" && tasks.length > 0) {
      const listIndex = msg.text.search(/-\s*\[[ xX]?\]/);
      if (listIndex !== -1) {
        return msg.text.substring(0, listIndex).trim();
      }
    }
    return msg.text;
  }, [msg.text, msg.mode, tasks.length]);

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full`}>
      <div className="text-[10px] text-zinc-500 font-mono mb-1 capitalize">
        {isUser ? "You" : "Audit Assistant"}
      </div>
      <div className={
        isUser 
          ? "p-4 rounded-2xl border border-[#30363d] bg-[#21262d] text-white rounded-tr-none max-w-2xl text-xs leading-relaxed" 
          : "text-[#c9d1d9] w-full text-xs leading-relaxed space-y-4"
      }>
        {msg.isLoading ? (
          <div className="p-5 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md shadow-lg flex items-center gap-2.5 text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0fbf3e]" />
            <span>Formulating codebase references...</span>
          </div>
        ) : (
          <>
            <FormattedMessage text={cleanText} />

            {tasks.length > 0 && (
              <div className="p-4 rounded-2xl border border-white/10 bg-black/25 backdrop-blur-md space-y-3 shadow-lg pointer-events-auto">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Actionable Issue Checklist</span>
                <div className="space-y-2">
                  {tasks.map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => toggleTask(t.id)}
                      className="flex items-start gap-2.5 cursor-pointer select-none text-[11px] group text-zinc-300"
                    >
                      <button className="mt-0.5 text-zinc-500 group-hover:text-white transition-colors cursor-pointer">
                        {t.done ? (
                          <CheckSquare className="w-4 h-4 text-[#0fbf3e] fill-current text-opacity-10" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span className={`leading-normal transition-all ${t.done ? "line-through text-zinc-500" : "text-zinc-200"}`}>
                        {t.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {msg.citations && msg.citations.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-xl border border-white/5 bg-black/15 backdrop-blur-md">
                <span className="text-[10px] text-zinc-500">Grounded Citations:</span>
                {msg.citations.map((cite) => (
                  <button
                    key={cite}
                    onClick={() => onOpenCitation(cite)}
                    className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-black/50 border border-neutral-800 hover:border-[#0fbf3e] rounded-md text-[10px] text-[#0fbf3e] hover:text-[#0fbf3e] transition-colors font-mono cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    {cite.split('/').pop()}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function parseInlineStyles(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="font-mono text-[11px] bg-neutral-850 px-1.5 py-0.5 rounded text-emerald-400 border border-neutral-700/55">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function FormattedMessage({ text }: { text: string }) {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!text) return null;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedText(code);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let currentCardItems: React.ReactNode[] = [];
  let cardTitle = "";
  let insideCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";

  const flushCard = (key: string) => {
    if (currentCardItems.length > 0 || cardTitle) {
      elements.push(
        <div key={key} className="p-5 rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md space-y-4 shadow-lg hover:border-[#0fbf3e]/20 transition-all duration-300">
          {cardTitle && (
            <h5 className="text-xs font-semibold text-white uppercase tracking-wider border-b border-neutral-800/60 pb-2 flex items-center gap-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0fbf3e] shadow-[0_0_8px_#0fbf3e]" />
              {cardTitle}
            </h5>
          )}
          <div className="space-y-3.5 text-zinc-300 leading-relaxed text-xs">
            {...currentCardItems}
          </div>
        </div>
      );
      currentCardItems = [];
      cardTitle = "";
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (insideCodeBlock) {
        const codeText = codeBlockLines.join("\n");
        const isCopied = copiedText === codeText;
        currentCardItems.push(
          <div key={`msg-code-${idx}`} className="my-3 border border-white/10 rounded-xl overflow-hidden bg-black/60 shadow-lg pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-[#30363d] text-[10px] text-zinc-500 font-mono select-none">
              <span>{codeBlockLang ? codeBlockLang.toUpperCase() : "CODE"}</span>
              <button
                onClick={() => handleCopyCode(codeText)}
                className="hover:text-white transition-colors cursor-pointer"
              >
                {isCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto font-mono text-xs text-emerald-400 leading-relaxed bg-[#0d1117]/30 select-text">
              <code>{codeText}</code>
            </pre>
          </div>
        );
        insideCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = "";
      } else {
        insideCodeBlock = true;
        codeBlockLang = trimmed.substring(3).trim();
      }
      return;
    }

    if (insideCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    if (trimmed.startsWith("#")) {
      flushCard(`card-flush-${idx}`);
      const match = trimmed.match(/^(#+)\s*(.*)/);
      if (match) {
        cardTitle = match[2].replace(/\*\*/g, "").trim();
      }
      return;
    }

    if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
      const bulletContent = trimmed.substring(1).trim();
      const boldMatch = bulletContent.match(/^\*\*(.*?)\*\*:(.*)/);

      if (boldMatch) {
        const keyName = boldMatch[1].trim();
        const description = boldMatch[2].trim();
        currentCardItems.push(
          <div key={`bullet-bold-${idx}`} className="flex flex-col md:flex-row gap-2 border-b border-neutral-800/30 pb-3 last:border-b-0">
            <span className="font-mono text-xs text-[#0fbf3e] font-semibold shrink-0 min-w-[150px]">
              {keyName}
            </span>
            <span className="text-zinc-300 text-xs leading-normal">
              {parseInlineStyles(description)}
            </span>
          </div>
        );
      } else {
        const cleanBullet = bulletContent.replace(/\*\*/g, "").trim();
        currentCardItems.push(
          <div key={`bullet-normal-${idx}`} className="flex items-start gap-2.5 text-zinc-300">
            <span className="text-[#0fbf3e] mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-[#0fbf3e]/80" />
            <span className="text-xs leading-relaxed">{parseInlineStyles(cleanBullet)}</span>
          </div>
        );
      }
      return;
    }

    if (trimmed) {
      currentCardItems.push(
        <p key={`para-${idx}`} className="text-zinc-300 text-xs leading-relaxed">
          {parseInlineStyles(trimmed)}
        </p>
      );
    }
  });

  flushCard("card-flush-end");

  return (
    <div className="space-y-4 w-full select-text pointer-events-auto">
      {elements}
    </div>
  );
}

function BeautifulSummary({ text }: { text: string }) {
  return <FormattedMessage text={text} />;
}

export default function WorkspacePage({ repoId, repoUrl, onBack }: WorkspacePageProps) {
  const [hasQueried, setHasQueried] = useState(false)
  const [repoDetails, setRepoDetails] = useState<RepositoryDetails | null>(null)
  const [activeTab, setActiveTab] = useState<"chat" | "summary">("chat")
  const [hoveredTab, setHoveredTab] = useState<"chat" | "summary" | null>(null)
  const [isInputHovered, setIsInputHovered] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const isExpanded = isInputHovered || isInputFocused

  const [leftWidth, setLeftWidth] = useState(320)
  const [leftCollapsed, setLeftCollapsed] = useState(false)

  const [rightWidth, setRightWidth] = useState(320)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftWidth

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(220, Math.min(480, startWidth + deltaX))
      setLeftWidth(newWidth)
    }

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag)
      document.removeEventListener("mouseup", stopDrag)
    }

    document.addEventListener("mousemove", doDrag)
    document.addEventListener("mouseup", stopDrag)
  }

  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = rightWidth

    const doDrag = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX
      const newWidth = Math.max(220, Math.min(480, startWidth + deltaX))
      setRightWidth(newWidth)
    }

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag)
      document.removeEventListener("mouseup", stopDrag)
    }

    document.addEventListener("mousemove", doDrag)
    document.addEventListener("mouseup", stopDrag)
  }
  
  const [repoSummary, setRepoSummary] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [flatFiles, setFlatFiles] = useState<string[]>([])
  const [fileFilter, setFileFilter] = useState("")
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [selectedFileCode, setSelectedFileCode] = useState("")
  const [inspectorLoading, setInspectorLoading] = useState(false)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [copiedFile, setCopiedFile] = useState(false)

  useEffect(() => {
    fetch(`/api/repositories/${repoId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setRepoDetails(data)
      })
      .catch(err => console.error("Error loading repo details:", err))

    fetch(`/api/repositories/${repoId}/files`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          const paths = data.map((f: any) => f.path)
          setFlatFiles(paths)
        }
      })
      .catch(err => console.error("Error loading files list:", err))

    fetch(`/api/repositories/${repoId}/summary`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.summary) {
          setRepoSummary(data.summary)
        }
      })
      .catch(err => console.error("Error loading summary:", err))
  }, [repoId])

  const { owner, name } = useMemo(() => {
    if (repoDetails) return { owner: repoDetails.owner, name: repoDetails.name }
    try {
      const parts = repoUrl.replace(/\/$/, "").split("/")
      if (parts.length >= 2) {
        return { owner: parts[parts.length - 2], name: parts[parts.length - 1] }
      }
    } catch (e) {}
    return { owner: "shashiraraja", name: "shopping-cart" }
  }, [repoDetails, repoUrl])

  const languageBreakdown = useMemo(() => {
    if (flatFiles.length === 0) return []
    const counts: Record<string, number> = {}
    let total = 0
    flatFiles.forEach(f => {
      const ext = f.split('.').pop()?.toLowerCase()
      if (ext && ext !== f) {
        counts[ext] = (counts[ext] || 0) + 1
        total++
      }
    })
    return Object.entries(counts)
      .map(([ext, count]) => ({
        lang: ext.toUpperCase(),
        percentage: Math.round((count / total) * 100),
        color: getExtColor("file." + ext)
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 4)
  }, [flatFiles])

  const fileTree = useMemo(() => {
    const filtered = fileFilter.trim()
      ? flatFiles.filter(f => f.toLowerCase().includes(fileFilter.toLowerCase()))
      : flatFiles
    const root: FileNode[] = []
    filtered.forEach(p => {
      const parts = p.split('/')
      let currentLevel = root
      parts.forEach((part, i) => {
        if (!part) return
        const isLast = i === parts.length - 1
        const currentAccumPath = parts.slice(0, i + 1).join('/')
        let node = currentLevel.find(n => n.name === part)
        if (!node) {
          node = { name: part, path: currentAccumPath, isDirectory: !isLast, children: [] }
          currentLevel.push(node)
        }
        currentLevel = node.children
      })
    })

    const sortTree = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
      nodes.forEach(n => {
        if (n.children.length > 0) sortTree(n.children)
      })
    }
    sortTree(root)
    return root
  }, [flatFiles, fileFilter])

  const toggleDir = (path: string) => {
    setCollapsedDirs(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const handleSelectFile = async (path: string) => {
    setSelectedFilePath(path)
    setIsInspectorOpen(true)
    setInspectorLoading(true)
    setSelectedFileCode("Loading code structure from CDN...")

    try {
      let res = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/main/${path}`)
      if (!res.ok) {
        res = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/master/${path}`)
      }
      if (res.ok) {
        const text = await res.text()
        setSelectedFileCode(text)
      } else {
        setSelectedFileCode(`// Error: File content could not be resolved from GitHub Raw CDN.\n// Status code: ${res.status}\n// Verify if repository branch is main or master.`)
      }
    } catch (err) {
      setSelectedFileCode(`// Net connection error during file retrieval: \n// ${(err as Error).message}`)
    } finally {
      setInspectorLoading(false)
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedFile(true)
    setTimeout(() => setCopiedFile(false), 2000)
  }

  const handleQuerySubmit = async (promptText: string, mode: PromptMode) => {
    if (!promptText.trim()) return

    const userPrompt = promptText.trim()
    setHasQueried(true)

    const userMessageId = Math.random().toString(36).slice(2)
    const userMsg: ChatMessage = {
      id: userMessageId,
      sender: "user",
      text: userPrompt,
      mode
    }
    
    const assistantMessageId = Math.random().toString(36).slice(2)
    const assistantMsg: ChatMessage = {
      id: assistantMessageId,
      sender: "assistant",
      text: "",
      isLoading: true,
      mode
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsAiLoading(true)

    if (userPrompt.toLowerCase() === "hi") {
      const welcomeMessage = `👋 Hello! Welcome to **GitScope AI**. I have finished indexing and embedding the **${name}** repository (by **${owner}**).

Here is a quick overview of what we can do together:
- **Semantic Code Search**: Ask me where specific functions, classes, or interfaces are defined.
- **Architectural Q&A**: Learn how components are connected, trace flow paths, or inspect package setups.
- **Issue Solver**: Describe repository issues, tasks, or bugs in detail (toggle the **Issues** button to generate checklists).

Feel free to browse files in the explorer on the right or type your first query below!`;

      setTimeout(() => {
        setMessages(prev =>
          prev.map(m => m.id === assistantMessageId ? { ...m, text: welcomeMessage, isLoading: false } : m)
        )
        setIsAiLoading(false)
      }, 400)
      return
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repoId, question: userPrompt })
      })

      if (!response.ok) {
        throw new Error(`SSE request failed with status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let finished = false
      let accumulatedAnswer = ""
      let buffer = ""
      let currentEventData: string[] = []

      setMessages(prev =>
        prev.map(m => m.id === assistantMessageId ? { ...m, isLoading: false } : m)
      )

      while (reader && !finished) {
        const { value, done } = await reader.read()
        finished = done
        if (value) {
          buffer += decoder.decode(value, { stream: !done })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const cleanLine = line.endsWith('\r') ? line.slice(0, -1) : line
            if (cleanLine.startsWith('data:')) {
              let dataValue = cleanLine.substring(5)
              if (dataValue.startsWith(' ')) {
                dataValue = dataValue.substring(1)
              }
              currentEventData.push(dataValue)
            } else if (cleanLine === '') {
              if (currentEventData.length > 0) {
                accumulatedAnswer += currentEventData.join('\n')
                currentEventData = []
              }
            }
          }

          const displayAnswer = accumulatedAnswer + (currentEventData.length > 0 ? currentEventData.join('\n') : '')

          setMessages(prev =>
            prev.map(m => m.id === assistantMessageId ? { ...m, text: displayAnswer } : m)
          )
        }
      }

      if (currentEventData.length > 0) {
        accumulatedAnswer += currentEventData.join('\n')
        currentEventData = []
        setMessages(prev =>
          prev.map(m => m.id === assistantMessageId ? { ...m, text: accumulatedAnswer } : m)
        )
      }

      setTimeout(async () => {
        try {
          const histRes = await fetch(`/api/chat/history/${repoId}`)
          if (histRes.ok) {
            const historyList = await histRes.json()
            if (Array.isArray(historyList) && historyList.length > 0) {
              const latest = historyList[0] 
              setMessages(prev =>
                prev.map(m => m.id === assistantMessageId ? { ...m, citations: latest.sources } : m)
              )
            }
          }
        } catch (e) {
          console.error("Citations fetch failed", e)
        }
      }, 500)

    } catch (err) {
      console.error(err)
      setMessages(prev =>
        prev.map(m => m.id === assistantMessageId ? { ...m, text: `API connection error: ${(err as Error).message}. Verify if backend service is active.`, isLoading: false } : m)
      )
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleSelectSample = (sampleText: string) => {
    handleQuerySubmit(sampleText, "chat")
  }
  return (
    <LiquidAurora className="text-[#c9d1d9] font-sans select-none">
      <header className="h-14 border-b border-[#30363d] bg-[#161b22]/70 backdrop-blur-md px-6 flex items-center justify-between z-30 relative select-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-[#30363d] text-[#8b949e] hover:text-white transition-colors"
            title="Back to Landing Page"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-wide text-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0fbf3e]" />
              GitScope AI
            </span>
            <span className="text-[#30363d] text-xs">/</span>
            <a 
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#8b949e] hover:text-[#0fbf3e] hover:underline flex items-center gap-1 font-mono"
            >
              {owner} <span className="text-zinc-600">/</span> {name}
              <span className="text-[10px] text-zinc-500">↗</span>
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {}
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="p-1.5 rounded-md hover:bg-[#30363d] text-[#8b949e] hover:text-white transition-colors"
            title={leftCollapsed ? "Show Left Panel" : "Hide Left Panel"}
          >
            <svg className="w-4.5 h-4.5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              {leftCollapsed ? <path d="M12 9l3 3-3 3" /> : <path d="M15 15l-3-3 3-3" />}
            </svg>
          </button>

          {}
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="p-1.5 rounded-md hover:bg-[#30363d] text-[#8b949e] hover:text-white transition-colors"
            title={rightCollapsed ? "Show Right Panel" : "Hide Right Panel"}
          >
            <svg className="w-4.5 h-4.5 fill-none stroke-current" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
              {rightCollapsed ? <path d="M12 15l-3-3 3-3" /> : <path d="M9 9l3 3-3 3" />}
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 w-full flex relative overflow-hidden z-10">
        <motion.aside
          animate={{ 
            width: leftCollapsed ? 0 : leftWidth,
            opacity: leftCollapsed ? 0 : 1
          }}
          transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
          style={{ width: leftCollapsed ? 0 : leftWidth }}
          className="h-full border-r border-white/10 bg-black/25 backdrop-blur-xl flex flex-col z-20 flex-shrink-0 relative overflow-hidden pointer-events-auto shadow-2xl"
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {}
            <div className="relative flex bg-black/25 border border-white/10 rounded-xl p-1 w-full shadow-lg backdrop-blur-md">
              {}
              <div 
                className="absolute top-1 bottom-1 rounded-lg bg-white/5 border border-white/5 transition-all duration-300 ease-out shadow-inner"
                style={{
                  left: activeTab === "chat" ? "4px" : "calc(50% + 2px)",
                  width: "calc(50% - 6px)",
                }}
              />
              {}
              <div 
                className="absolute top-0 h-[2px] bg-emerald-400 transition-all duration-300 ease-in-out shadow-[0_0_8px_#34d399]"
                style={{
                  left: activeTab === "chat" ? "12px" : "calc(50% + 12px)",
                  width: "calc(50% - 24px)",
                  transform: "translateY(-1px)",
                }}
              />

              <button
                onClick={() => setActiveTab("chat")}
                onMouseEnter={() => setHoveredTab("chat")}
                onMouseLeave={() => setHoveredTab(null)}
                className="relative flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer overflow-hidden flex items-center justify-center"
              >
                <div 
                  className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-12 bg-gradient-to-b from-[#0fbf3e]/35 to-transparent blur-md rounded-full transition-opacity duration-300 pointer-events-none"
                  style={{
                    opacity: activeTab === "chat" ? 1 : (hoveredTab === "chat" ? 0.6 : 0)
                  }}
                />
                <span className={`relative z-10 transition-colors duration-200 ${
                  activeTab === "chat" ? "text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                }`}>
                  Chat
                </span>
              </button>

              <button
                onClick={() => setActiveTab("summary")}
                onMouseEnter={() => setHoveredTab("summary")}
                onMouseLeave={() => setHoveredTab(null)}
                className="relative flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer overflow-hidden flex items-center justify-center"
              >
                <div 
                  className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-12 bg-gradient-to-b from-[#0fbf3e]/35 to-transparent blur-md rounded-full transition-opacity duration-300 pointer-events-none"
                  style={{
                    opacity: activeTab === "summary" ? 1 : (hoveredTab === "summary" ? 0.6 : 0)
                  }}
                />
                <span className={`relative z-10 transition-colors duration-200 ${
                  activeTab === "summary" ? "text-white font-semibold" : "text-zinc-400 hover:text-zinc-200"
                }`}>
                  Summary
                </span>
              </button>
            </div>
            
            {}
            <div className="border border-white/5 rounded-xl bg-black/15 backdrop-blur-md p-4 space-y-4 shadow-md">
              <div className="space-y-1">
                <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider block">Repository Scope</span>
                <h3 className="text-sm font-bold text-white font-mono leading-none truncate">{name}</h3>
                <span className="text-[11px] text-zinc-400 block font-mono">Owner: {owner}</span>
              </div>

              {}
              {languageBreakdown.length > 0 && (
                <div className="space-y-2.5 pt-1.5 border-t border-neutral-800">
                  <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider block">Language Composition</span>
                  
                  {}
                  <div className="w-full h-2 rounded-full flex overflow-hidden bg-neutral-800">
                    {languageBreakdown.map((item, idx) => (
                      <div 
                        key={idx} 
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }} 
                        title={`${item.lang}: ${item.percentage}%`}
                      />
                    ))}
                  </div>

                  {}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    {languageBreakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-zinc-300 font-medium">{item.lang}</span>
                        <span className="text-zinc-500">{item.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <a 
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-zinc-600 text-zinc-300 hover:text-white transition-all text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  View Repository ↗
                </a>
              </div>
            </div>

            {}
            <div className="border border-white/5 rounded-xl bg-black/15 backdrop-blur-md p-4 space-y-3.5 shadow-md">
              <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider block">Architecture Pulse</span>

              <div className="space-y-2.5 text-xs">
                {}
                <div className="flex items-center justify-between py-1 border-b border-neutral-800/40">
                  <span className="text-zinc-400">Total Scanned Files</span>
                  <span className="font-mono text-white font-semibold">{flatFiles.length}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-800/40">
                  <span className="text-zinc-400">RAG Vector Chunks</span>
                  <span className="font-mono text-[#0fbf3e] font-semibold">{repoDetails?.chunkCount ?? flatFiles.length * 4}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-800/40">
                  <span className="text-zinc-400">Primary Stack</span>
                  <span className="font-mono text-white font-semibold">{languageBreakdown[0]?.lang ?? "JAVA"}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-800/40">
                  <span className="text-zinc-400">Database Context</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0fbf3e]/10 text-[#0fbf3e] border border-[#0fbf3e]/20 font-mono">Active</span>
                </div>
              </div>

              {}
              <div className="pt-2 space-y-2">
                <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider block">Estimated Ratings</span>
                
                <div className="space-y-1.5">
                  {[
                    { label: "Maintainability", score: 92 },
                    { label: "Security Profile", score: 88 },
                    { label: "Performance", score: 94 }
                  ].map((rate, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-zinc-400">{rate.label}</span>
                        <span className="text-white font-mono font-medium">{rate.score}/100</span>
                      </div>
                      <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${rate.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </motion.aside>
        {!leftCollapsed && (
          <div
            onMouseDown={handleLeftResizeStart}
            className="w-1 h-full hover:bg-[#0fbf3e]/30 active:bg-[#0fbf3e]/60 cursor-col-resize z-30 relative transition-colors duration-150 flex-shrink-0"
          />
        )}

        <div className="flex-1 h-full flex flex-col relative overflow-hidden pointer-events-none">
          <AnimatePresence mode="wait">
            {activeTab === "summary" ? (
              <motion.div
                key="summary-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 overflow-y-auto px-6 py-6 pb-20 scrollbar-thin pointer-events-auto w-full"
              >
                <div className="w-full border border-white/10 rounded-2xl bg-black/30 backdrop-blur-xl overflow-hidden shadow-2xl p-6">
                  {repoSummary ? (
                    <BeautifulSummary text={repoSummary} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-4">
                      <Loader2 className="w-8 h-8 animate-spin text-[#0fbf3e]" />
                      <div className="text-center space-y-1">
                        <p className="font-semibold text-white">Generating repository blueprint...</p>
                        <p className="text-[11px] text-zinc-500 max-w-sm">
                          Analyzing codebase files, tracing architectural layers, and assembling semantic indexing metadata.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : !hasQueried ? (
              
              <motion.div
                key="welcome-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto z-10 w-full pointer-events-auto"
              >
                <motion.h1 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-3 text-center"
                >
                  Ready to chat with <span className="text-[#0fbf3e] font-mono">{name}</span>?
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-zinc-400 text-xs md:text-sm mb-8 text-center max-w-md"
                >
                  Ask questions, search for functions/endpoints, explore architecture structure, or solve repository issues.
                </motion.p>
                
                <motion.div 
                  layoutId="prompt-box-wrapper"
                  className="w-full animate-in fade-in-0 duration-500"
                >
                  <PromptInputBox 
                    onSend={handleQuerySubmit}
                    isLoading={isAiLoading}
                    placeholder="Ask anything about this repository..."
                  />
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="w-full mt-10"
                >
                  <h4 className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-3 text-center">Suggestions to Try</h4>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                    {[
                      "What is the overall architecture structure of this project?",
                      "Find the central endpoints and controller mappings.",
                      "Explain database entity definitions and CRUD repositories."
                    ].map((sample) => (
                      <button
                        key={sample}
                        onClick={() => handleSelectSample(sample)}
                        className="p-3 bg-[#161b22]/70 hover:bg-[#161b22]/90 border border-[#30363d] hover:border-zinc-500 rounded-xl text-[11px] text-zinc-300 hover:text-white transition-all text-left flex flex-col justify-between items-start gap-3 cursor-pointer min-h-[95px]"
                      >
                        <span className="line-clamp-3 leading-normal">{sample}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#0fbf3e] self-end mt-1" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              
              <motion.div
                key="chat-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col relative h-full overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin">
                  <div className="w-full space-y-6 pb-36 pointer-events-auto px-6 md:px-10">
                    {messages.map((msg) => (
                      <MessageBubble 
                        key={msg.id} 
                        msg={msg} 
                        onOpenCitation={handleSelectFile} 
                      />
                    ))}
                  </div>
                </div>

                <motion.div 
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="absolute bottom-6 left-0 right-0 z-20 px-6 pointer-events-auto"
                >
                  <motion.div
                    onMouseEnter={() => setIsInputHovered(true)}
                    onMouseLeave={() => setIsInputHovered(false)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    animate={{ 
                      maxWidth: isExpanded ? 768 : 360,
                    }}
                    transition={{ type: "spring", stiffness: 200, damping: 22 }}
                    className="w-full mx-auto"
                  >
                    <motion.div layoutId="prompt-box-wrapper" className="w-full">
                      <PromptInputBox 
                        onSend={handleQuerySubmit}
                        isLoading={isAiLoading}
                        placeholder="Ask a follow-up question..."
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!rightCollapsed && (
          <div
            onMouseDown={handleRightResizeStart}
            className="w-1 h-full hover:bg-[#0fbf3e]/30 active:bg-[#0fbf3e]/60 cursor-col-resize z-30 relative transition-colors duration-150 flex-shrink-0"
          />
        )}
        <motion.aside
          animate={{ 
            width: rightCollapsed ? 0 : rightWidth,
            opacity: rightCollapsed ? 0 : 1
          }}
          transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
          style={{ width: rightCollapsed ? 0 : rightWidth }}
          className="h-full border-l border-white/10 bg-black/25 backdrop-blur-xl flex flex-col z-20 flex-shrink-0 relative overflow-hidden pointer-events-auto shadow-2xl"
        >
          {}
          <div className="p-4 border-b border-[#30363d] shrink-0">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#0fbf3e]" />
              Codebase Explorer
            </h3>
            
            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                placeholder="Filter file paths..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#0d1117] border border-[#30363d] focus:border-[#0fbf3e] focus:ring-1 focus:ring-[#0fbf3e] outline-none text-white placeholder-zinc-600"
              />
            </div>
          </div>

          {}
          <div className="flex-1 overflow-auto p-2 scrollbar-thin text-xs space-y-0.5">
            {fileTree.length > 0 ? (
              fileTree.map(node => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  collapsed={collapsedDirs}
                  toggleDir={toggleDir}
                  onSelectFile={handleSelectFile}
                />
              ))
            ) : (
              <div className="text-center py-10 text-zinc-600 font-mono text-[11px]">
                No files found matching filter.
              </div>
            )}
          </div>
        </motion.aside>

        <AnimatePresence>
          {isInspectorOpen && selectedFilePath && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="absolute right-0 top-0 bottom-0 w-[60%] border-l border-[#30363d] bg-[#0d1117] shadow-3xl flex flex-col z-50 pointer-events-auto"
            >
              {}
              <div className="h-14 border-b border-[#30363d] bg-[#161b22]/90 px-6 flex items-center justify-between select-none">
                <div className="flex items-center gap-2.5 truncate">
                  <FileText className="w-4 h-4 text-[#0fbf3e] shrink-0" />
                  <span className="font-mono text-xs text-white truncate">{selectedFilePath}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleCopyCode(selectedFileCode)}
                    disabled={inspectorLoading}
                    className="px-2.5 py-1.5 rounded-lg border border-[#30363d] bg-neutral-900 text-zinc-300 hover:text-white hover:border-zinc-500 disabled:opacity-40 transition-colors flex items-center gap-1.5 text-[11px]"
                  >
                    {copiedFile ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#0fbf3e]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => setIsInspectorOpen(false)}
                    className="p-1.5 rounded-md hover:bg-neutral-800 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {}
              <div className="flex-1 overflow-auto p-6 scrollbar-thin bg-[#0d1117] relative">
                {inspectorLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d1117]/80">
                    <Loader2 className="w-6 h-6 text-[#0fbf3e] animate-spin" />
                    <span className="text-xs text-zinc-500 font-mono">Retrieving raw source from GitHub...</span>
                  </div>
                ) : (
                  <pre className="font-mono text-xs text-zinc-300 whitespace-pre leading-relaxed select-text p-2 bg-neutral-900/40 rounded-xl border border-neutral-800/60 overflow-x-auto">
                    <code>{selectedFileCode}</code>
                  </pre>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LiquidAurora>
  )
}
