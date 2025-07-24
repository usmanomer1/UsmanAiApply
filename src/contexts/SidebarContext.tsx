import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('sidebar-expanded');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSidebar = () => {
    setIsExpanded(prev => !prev);
  };

  const setSidebarExpanded = (expanded: boolean) => {
    setIsExpanded(expanded);
  };

  // Save to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebar-expanded', String(isExpanded));
  }, [isExpanded]);

  return (
    <SidebarContext.Provider value={{ isExpanded, toggleSidebar, setSidebarExpanded }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};