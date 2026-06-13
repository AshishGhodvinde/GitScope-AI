import React, { createContext, useContext, useState } from 'react';

export interface ActiveFileTrigger {
  path: string;
  timestamp: number;
}

interface ActiveFileContextType {
  activeFileTrigger: ActiveFileTrigger | null;
  triggerFileSelect: (path: string) => void;
  clearFileSelect: () => void;
}

const ActiveFileContext = createContext<ActiveFileContextType | undefined>(undefined);

export function ActiveFileProvider({ children }: { children: React.ReactNode }) {
  const [activeFileTrigger, setActiveFileTrigger] = useState<ActiveFileTrigger | null>(null);

  const triggerFileSelect = (path: string) => {
    setActiveFileTrigger({ path, timestamp: Date.now() });
  };

  const clearFileSelect = () => {
    setActiveFileTrigger(null);
  };

  return (
    <ActiveFileContext.Provider value={{ activeFileTrigger, triggerFileSelect, clearFileSelect }}>
      {children}
    </ActiveFileContext.Provider>
  );
}

export function useActiveFile() {
  const context = useContext(ActiveFileContext);
  if (!context) {
    throw new Error('useActiveFile must be used within an ActiveFileProvider');
  }
  return context;
}
