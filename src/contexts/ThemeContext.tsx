import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Favicon update utility function
const updateFavicon = (isDark: boolean) => {
  const favicon = document.getElementById('favicon') as HTMLLinkElement;
  const appleTouchIcon = document.getElementById('apple-touch-icon') as HTMLLinkElement;
  const shortcutIcon = document.getElementById('shortcut-icon') as HTMLLinkElement;
  
  const lightFavicon = '/images/logos/light_theme_favicon.png';
  const darkFavicon = '/images/logos/dark_theme_favicon.png';
  
  const selectedFavicon = isDark ? darkFavicon : lightFavicon;
  
  if (favicon) favicon.href = selectedFavicon;
  if (appleTouchIcon) appleTouchIcon.href = selectedFavicon;
  if (shortcutIcon) shortcutIcon.href = selectedFavicon;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setIsDark(saved === 'dark');
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Update favicon when theme changes
    updateFavicon(isDark);
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};