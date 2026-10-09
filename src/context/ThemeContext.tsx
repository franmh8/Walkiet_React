import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  border: string;
  divider: string;
  headerBackground: string;
  tabBarBackground: string;
  tabBarBorder: string;
  activeTab: string;
  inactiveTab: string;
  badgeBackground: string;
  badgeBorder: string;
  pttOuterBg: string;
  pttOuterBorder: string;
  pttInnerBg: string;
  pttInnerBorder: string;
  pttIcon: string;
  inputBg: string;
  inputBorder: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
}

export const lightColors: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#8a1a36',
  primaryHover: '#691c32',
  border: '#e2e8f0',
  divider: '#f1f5f9',
  headerBackground: '#ffffff',
  tabBarBackground: '#ffffff',
  tabBarBorder: '#e2e8f0',
  activeTab: '#8a1a36',
  inactiveTab: '#64748b',
  badgeBackground: '#f1f5f9',
  badgeBorder: '#cbd5e1',
  pttOuterBg: 'rgba(255, 255, 255, 0.95)',
  pttOuterBorder: '#e2e8f0',
  pttInnerBg: '#f1f5f9',
  pttInnerBorder: '#cbd5e1',
  pttIcon: '#334155',
  inputBg: '#ffffff',
  inputBorder: '#cbd5e1',
  pillBg: '#ecfdf5',
  pillBorder: '#a7f3d0',
  pillText: '#065f46',
};

export const darkColors: ThemeColors = {
  background: '#070c16',
  surface: '#0d1527',
  card: '#101826',
  cardBorder: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  primary: '#eb527c',
  primaryHover: '#bc2e54',
  border: '#1e293b',
  divider: '#161f30',
  headerBackground: '#070c16',
  tabBarBackground: '#070c16',
  tabBarBorder: '#1e293b',
  activeTab: '#eb527c',
  inactiveTab: '#64748b',
  badgeBackground: '#1e293b',
  badgeBorder: '#334155',
  pttOuterBg: '#111927',
  pttOuterBorder: '#1e293b',
  pttInnerBg: '#15233a',
  pttInnerBorder: '#334155',
  pttIcon: '#cbd5e1',
  inputBg: '#0f172a',
  inputBorder: '#334155',
  pillBg: 'rgba(6, 78, 59, 0.35)',
  pillBorder: 'rgba(16, 185, 129, 0.4)',
  pillText: '#6ee7b7',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('c5i_theme_mode');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved as ThemeMode;
      }
    } catch (_) {}
    return 'dark'; // Tactical default is dark
  });

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, []);

  const resolvedTheme: ResolvedTheme =
    themeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : themeMode;

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.body.style.backgroundColor = darkColors.background;
        document.body.style.color = darkColors.text;
      } else {
        document.documentElement.classList.remove('dark');
        document.body.style.backgroundColor = lightColors.background;
        document.body.style.color = lightColors.text;
      }
    }
  }, [isDark]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('c5i_theme_mode', mode);
    } catch (_) {}
  };

  const toggleTheme = () => {
    const nextMode: ThemeMode = resolvedTheme === 'light' ? 'dark' : 'light';
    setThemeMode(nextMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        isDark,
        colors,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
