import { useState } from "react"
import LandingPage from "@/pages/LandingPage"
import WorkspacePage from "@/pages/WorkspacePage"

function App() {
  const [activeRepoId, setActiveRepoId] = useState<number | null>(null)
  const [activeRepoUrl, setActiveRepoUrl] = useState<string>("")

  return (
    <>
      {activeRepoId ? (
        <WorkspacePage 
          repoId={activeRepoId} 
          repoUrl={activeRepoUrl} 
          onBack={() => { 
            setActiveRepoId(null); 
            setActiveRepoUrl(""); 
          }} 
        />
      ) : (
        <LandingPage 
          onSelectRepo={(id, url) => { 
            setActiveRepoId(id); 
            setActiveRepoUrl(url); 
          }} 
        />
      )}
    </>
  )
}

export default App
