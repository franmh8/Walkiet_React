import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserSettings {
  pttMode: 'hold' | 'toggle';
  reduceAnimations: boolean;
  soundEffects: boolean;
  vibration: boolean;
  theme: 'dark' | 'light' | 'system';
  autoConnectAlwaysdata: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  pttMode: 'hold',
  reduceAnimations: false,
  soundEffects: true,
  vibration: true,
  theme: 'dark',
  autoConnectAlwaysdata: true,
};

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  setPttMode: (mode: 'hold' | 'toggle') => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  setPttMode: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('c5i_user_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('c5i_user_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const setPttMode = (mode: 'hold' | 'toggle') => {
    updateSettings({ pttMode: mode });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, setPttMode }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
