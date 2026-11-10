import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { AccountSettings } from '../../services/accountApi';
export const lightPalette = { background: '#f8fafc', card: '#ffffff', text: '#0f172a', secondary: '#475569', muted: '#64748b', border: '#e2e8f0', accent: '#691c32', soft: '#f8edf0', danger: '#ef254d', dangerSoft: '#fff1f2', input: '#f8fafc', control: '#691c32', shadow: '#0f172a' };
export type Palette = typeof lightPalette;
const darkPalette: Palette = { background: '#0c1422', card: '#172235', text: '#f1f5f9', secondary: '#cbd5e1', muted: '#94a3b8', border: '#2e3d53', accent: '#f1a1b9', soft: '#382334', danger: '#ff718c', dangerSoft: '#3a202d', input: '#111c2d', control: '#a83c61', shadow: '#000000' };
const Context = createContext({ palette: lightPalette, dark: false, setMode: (_mode: AccountSettings['theme']) => {} });
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AccountSettings['theme']>('system');
  const system = useColorScheme(); const dark = mode === 'dark' || mode === 'system' && system === 'dark';
  const value = useMemo(() => ({ palette: dark ? darkPalette : lightPalette, dark, setMode }), [dark]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAppTheme = () => useContext(Context);
export function useThemeStyles<T extends Record<string, any>>(base: T): T {
  const { palette: p, dark } = useAppTheme();
  return useMemo(() => {
    if (!dark) return base;
    const text: Record<string, string> = { '#0f172a': p.text, '#111827': p.text, '#1e293b': p.text, '#334155': p.secondary, '#475569': p.secondary, '#64748b': p.muted, '#691c32': p.accent, '#8a1a36': p.accent, '#9f1239': p.danger, '#be123c': p.danger, '#dc2626': p.danger };
    const surfaces: Record<string, string> = { '#fff': p.card, '#ffffff': p.card, '#f8fafc': p.background, '#f9fafb': p.background, '#f1f5f9': p.input, '#f3f4f6': p.input, '#f8edf0': p.soft, '#fdf2f4': p.soft, '#fff1f2': p.dangerSoft, '#fce7ef': p.soft, '#fef2f2': p.dangerSoft, '#ecfdf5': '#12332e' };
    const borders: Record<string, string> = { '#e2e8f0': p.border, '#cbd5e1': p.border, '#e5e7eb': p.border, '#f1f5f9': p.border };
    return Object.fromEntries(Object.entries(base).map(([key, style]) => [key, Object.fromEntries(Object.entries(style).map(([property, value]) => {
      const mapping = property === 'color' ? text : property === 'backgroundColor' ? surfaces : property.startsWith('border') && property.endsWith('Color') ? borders : {};
      return [property, typeof value === 'string' ? mapping[value.toLowerCase()] || value : value];
    }))])) as T;
  }, [base, p, dark]);
}
