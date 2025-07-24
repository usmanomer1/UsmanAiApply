import React from 'react';
import { useSidebar } from '../../contexts/SidebarContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isExpanded } = useSidebar();
  
  return (
    <main className={`flex-1 transition-all duration-300 ${isExpanded ? 'ml-[240px]' : 'ml-[70px]'}`}>
      {children}
    </main>
  );
};