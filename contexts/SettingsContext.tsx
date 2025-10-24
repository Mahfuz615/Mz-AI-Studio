import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ChatMode = 'standard' | 'fast' | 'thinking' | 'search';

interface SettingsContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  defaultChatMode: ChatMode;
  setDefaultChatMode: (mode: ChatMode) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [defaultChatMode, setDefaultChatModeState] = useState<ChatMode>('standard');

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme;
    const storedChatMode = localStorage.getItem('defaultChatMode') as ChatMode;

    if (storedTheme) {
      setThemeState(storedTheme);
    } else {
        // Default to user's system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setThemeState(prefersDark ? 'dark' : 'light');
    }

    if (storedChatMode) {
      setDefaultChatModeState(storedChatMode);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setDefaultChatMode = (newMode: ChatMode) => {
    setDefaultChatModeState(newMode);
    localStorage.setItem('defaultChatMode', newMode);
  };
  
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <SettingsContext.Provider value={{ theme, setTheme, defaultChatMode, setDefaultChatMode }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
