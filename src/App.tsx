import React, { useState } from 'react';
import {
  Mic,
  Users,
  MessageSquare,
  BookOpen,
  User,
  Radio,
  Shield,
  Wifi,
  RadioTower,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RadioProvider, useRadio } from './context/RadioContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LoginScreen } from './screens/LoginScreen';
import { PttScreen } from './screens/PttScreen';
import { ChannelsScreen } from './screens/ChannelsScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { ProfileScreen } from './screens/ProfileScreen';

type TabType = 'PTT' | 'Grupos' | 'Chat' | 'Contactos' | 'Perfil';

function MainApp() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const [currentTab, setCurrentTab] = useState<TabType>('PTT');

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.background }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-700 animate-pulse flex items-center justify-center text-white">
            <Radio className="w-6 h-6" />
          </div>
          <span className="text-xs font-mono font-bold tracking-widest text-rose-500 uppercase">
            CONECTANDO CON MALLA C5i...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const tabs: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'PTT', label: 'PTT', icon: Mic },
    { id: 'Grupos', label: 'Grupos', icon: Users },
    { id: 'Chat', label: 'Chat', icon: MessageSquare },
    { id: 'Contactos', label: 'Contactos', icon: BookOpen },
    { id: 'Perfil', label: 'Perfil', icon: User },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start"
      style={{ backgroundColor: colors.background }}
    >
      {/* Container wrapper: full screen on mobile, elegant tactical app shell on desktop */}
      <div
        className="w-full max-w-xl h-screen flex flex-col shadow-2xl relative overflow-hidden border-x"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        {/* Tactical System Header Bar */}
        <header
          className="px-4 py-2 flex items-center justify-between border-b text-xs select-none shrink-0"
          style={{
            backgroundColor: colors.headerBackground,
            borderColor: colors.border,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-700 flex items-center justify-center text-white shadow-xs">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-[11px] tracking-wider uppercase text-rose-500">
                C5i Hidalgo
              </span>
              <span className="text-[9px] text-slate-400 font-mono leading-none">
                MALLA TÁCTICA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-1 text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>EN VIVO</span>
            </div>
            <span
              className="font-bold px-2 py-0.5 rounded-md border text-[10px]"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                color: colors.primary,
              }}
            >
              {user.callsign || 'OPERATIVO'}
            </span>
          </div>
        </header>

        {/* Dynamic Screen View */}
        <main className="flex-1 overflow-hidden relative">
          {currentTab === 'PTT' && <PttScreen onNavigateTab={(tab) => setCurrentTab(tab as TabType)} />}
          {currentTab === 'Grupos' && <ChannelsScreen onNavigateTab={(tab) => setCurrentTab(tab as TabType)} />}
          {currentTab === 'Chat' && <ChatScreen />}
          {currentTab === 'Contactos' && <ContactsScreen onNavigateTab={(tab) => setCurrentTab(tab as TabType)} />}
          {currentTab === 'Perfil' && <ProfileScreen />}
        </main>

        {/* 5-Tab Bottom Navigation Bar */}
        <nav
          className="border-t flex items-center justify-around py-2 px-1 select-none shrink-0 z-30"
          style={{
            backgroundColor: colors.tabBarBackground,
            borderColor: colors.tabBarBorder,
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition duration-150 active:scale-95 cursor-pointer ${
                  isActive ? 'text-rose-500 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1 rounded-xl transition ${
                    isActive ? 'bg-rose-950/40 border border-rose-800/60 text-rose-400' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-medium mt-0.5">{tab.label}</span>
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
        <RadioProvider>
          <ChatProvider>
            <MainApp />
          </ChatProvider>
        </RadioProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
