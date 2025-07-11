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
  // Always use light mode
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Force light mode
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    updateFavicon(false);
  }, []);

  // Disable theme toggle
  const toggleTheme = () => {
    // Do nothing - keep light mode
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};