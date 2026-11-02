import React, { useState } from 'react';
import {
  Mic,
  Users,
  MessageSquare,
  BookOpen,
  User,
  Radio,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RadioProvider } from './context/RadioContext';
import { ChatProvider } from './context/ChatContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { LoginScreen } from './screens/LoginScreen';
import { PttScreen } from './screens/PttScreen';
import { ChannelsScreen } from './screens/ChannelsScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { ProfileScreen } from './screens/ProfileScreen';

type TabType = 'PTT' | 'Grupos' | 'Chat' | 'Contactos' | 'Perfil';

function MainApp() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const [currentTab, setCurrentTab] = useState<TabType>('PTT');

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070c16]"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#8a1a36] animate-pulse flex items-center justify-center text-white shadow-lg">
            <Radio className="w-6 h-6" />
          </div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#8a1a36] dark:text-[#eb527c] uppercase">
            CONECTANDO CON MALLA C5i...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const tabs: { id: TabType; label: string; icon: React.FC<{ className?: string; strokeWidth?: number }> }[] = [
    { id: 'PTT', label: 'PTT', icon: Mic },
    { id: 'Grupos', label: 'Grupos', icon: Users },
    { id: 'Chat', label: 'Chat', icon: MessageSquare },
    { id: 'Contactos', label: 'Contactos', icon: BookOpen },
    { id: 'Perfil', label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-slate-50 dark:bg-[#070c16] text-slate-800 dark:text-slate-100 select-none">
      {/* Container wrapper matching Image 2 */}
      <div className="w-full h-screen flex flex-col overflow-hidden relative">
        {/* Dynamic Screen View */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {currentTab === 'PTT' && <PttScreen onNavigateTab={(tab) => setCurrentTab(tab as TabType)} />}
          {currentTab === 'Grupos' && <ChannelsScreen onNavigateTab={(tab) => setCurrentTab(tab as TabType)} />}
          {currentTab === 'Chat' && <ChatScreen />}
          {currentTab === 'Contactos' && <ContactsScreen onNavigateTab={(tab) => setCurrentTab(tab as TabType)} />}
          {currentTab === 'Perfil' && <ProfileScreen />}
        </main>

        {/* 5-Tab Bottom Navigation Bar matching Image 2 */}
        <nav className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1527] flex items-center justify-around py-2.5 px-2 select-none shrink-0 z-30 transition-colors">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-1 transition duration-150 active:scale-95 cursor-pointer ${
                  isActive
                    ? 'text-[#8a1a36] dark:text-[#eb527c] font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 transition-transform" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="text-[11px] font-medium mt-1 tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <RadioProvider>
            <ChatProvider>
              <MainApp />
            </ChatProvider>
          </RadioProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
