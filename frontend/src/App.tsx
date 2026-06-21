import { useState } from "react"
import LandingPage from "@/pages/LandingPage"
import WorkspacePage from "@/pages/WorkspacePage"

function App() {
  const [activeRepoUrl, setActiveRepoUrl] = useState<string>("")

  return (
    <>
      {activeRepoUrl ? (
        <WorkspacePage 
          repoUrl={activeRepoUrl} 
          onBack={() => setActiveRepoUrl("")} 
        />
      ) : (
        <LandingPage 
          onSelectRepo={(url) => setActiveRepoUrl(url)} 
        />
      )}
    </>
  )
}

export default App
