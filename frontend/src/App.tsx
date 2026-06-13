import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ToastContainer';
import { ThemeProvider } from './context/ThemeContext';
import { LandingPage }   from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage }      from './pages/ChatPage';
import { DocsPage }      from './pages/DocsPage';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { ActiveFileProvider } from './context/ActiveFileContext';
import { FluidMeshCanvas } from './components/FluidMeshCanvas';

/**
 * Root content component to access router location context.
 */
function AppContent() {
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/repository/');

  return (
    <div className={`min-h-screen flex flex-col ${isWorkspace ? 'h-screen w-screen overflow-hidden' : ''}`}
         style={{ color: 'var(--text-primary)' }}>
      {/* Global animated ambient mesh background */}
      <FluidMeshCanvas />

      <Navbar />

      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/"                          element={<LandingPage />}   />
          <Route path="/docs"                      element={<DocsPage />}      />

          {/* Workspace Layout wrapping repository routes */}
          <Route element={<WorkspaceLayout />}>
            <Route path="/repository/:id"            element={<DashboardPage />} />
            <Route path="/repository/:id/chat"       element={<ChatPage />}      />
          </Route>

          {/* 404 fallback */}
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
              <p className="text-6xl font-black gradient-text">404</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Page not found.</p>
              <a href="/" className="btn-primary">Go Home</a>
            </div>
          } />
        </Routes>
      </main>

      {/* Global toast notifications */}
      <ToastContainer />

      {/* Footer (only on landing & doc pages) */}
      {!isWorkspace && (
        <footer className="py-6 text-center" style={{ borderTop: '1px solid var(--divider)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            GitScope AI · Spring Boot 3 · React · ChromaDB · Google Gemini
          </p>
        </footer>
      )}
    </div>
  );
}

/**
 * Root application component.
 * Wraps the app in BrowserRouter, ThemeProvider, and ToastProvider.
 */
export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <ActiveFileProvider>
            <AppContent />
          </ActiveFileProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
