import React from 'react';
import {
  User,
  Shield,
  Phone,
  LogOut,
  Sun,
  Moon,
  Monitor,
  CheckCircle,
  Radio,
  Server,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getBackendUrl } from '../services/apiService';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  const handleLogout = async () => {
    if (window.confirm('¿Deseas cerrar tu sesión activa de C5i?')) {
      await logout();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* HEADER */}
      <div
        className="px-5 py-4 border-b"
        style={{
          backgroundColor: colors.headerBackground,
          borderColor: colors.border,
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          CUENTA OPERATIVA
        </span>
        <h2 className="text-base md:text-lg font-bold" style={{ color: colors.text }}>
          Perfil y Ajustes C5i
        </h2>
      </div>

      <div className="p-5 space-y-5 max-w-lg mx-auto w-full">
        {/* OFFICER CREDENTIAL CARD */}
        <div
          className="p-6 rounded-2xl border shadow-lg flex flex-col items-center text-center relative overflow-hidden"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          }}
        >
          {/* Background decorative watermark */}
          <Shield className="w-48 h-48 text-slate-800/10 dark:text-slate-800/20 absolute -right-10 -bottom-10 pointer-events-none" />

          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center border-2 mb-3.5 shadow-md"
            style={{
              backgroundColor: isDark ? 'rgba(235, 82, 124, 0.15)' : '#fff1f2',
              borderColor: colors.primary,
              color: colors.primary,
            }}
          >
            <User className="w-10 h-10" />
          </div>

          <h3 className="text-lg font-bold" style={{ color: colors.text }}>
            {user?.name || 'Oficial Operativo'}
          </h3>
          <span className="text-sm font-mono font-bold tracking-widest text-rose-500 uppercase mt-0.5">
            {user?.callsign || 'PATRULLA'}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            {user?.unit || 'Sector Operativo Hidalgo'}
          </span>
          <span className="text-[11px] font-mono text-slate-500 mt-0.5">
            {user?.role || 'Oficial de Radiocomunicación'}
          </span>

          {/* Active Link Badge */}
          <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-800/50 text-xs font-semibold text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>ENLACE ACTIVO C5i HIDALGO</span>
          </div>
        </div>

        {/* THEME SELECTOR */}
        <div
          className="p-5 rounded-2xl border space-y-3"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          }}
        >
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Tema y Apariencia
            </h4>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
            <button
              onClick={() => setThemeMode('light')}
              className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                themeMode === 'light'
                  ? 'border-rose-500 bg-rose-950/20 text-rose-400 font-bold'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Claro</span>
            </button>

            <button
              onClick={() => setThemeMode('dark')}
              className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                themeMode === 'dark'
                  ? 'border-rose-500 bg-rose-950/20 text-rose-400 font-bold'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Oscuro</span>
            </button>

            <button
              onClick={() => setThemeMode('system')}
              className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition ${
                themeMode === 'system'
                  ? 'border-rose-500 bg-rose-950/20 text-rose-400 font-bold'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Sistema</span>
            </button>
          </div>
        </div>

        {/* SYSTEM & PROTOCOLS INFO */}
        <div
          className="p-5 rounded-2xl border space-y-3 text-xs"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          }}
        >
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Protocolos de Radiocomunicación
            </h4>
          </div>

          <div className="space-y-2 text-slate-400">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span>Servidor Malla C5i:</span>
              <span className="font-mono text-emerald-400">En línea (3000)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span>Cifrado de Voz:</span>
              <span className="font-mono text-slate-300">AES-256 GCM</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span>Códec PTT:</span>
              <span className="font-mono text-slate-300">Opus WebAudio 48kHz</span>
            </div>
            <div className="flex justify-between py-1">
              <span>ID Dispositivo:</span>
              <span className="font-mono text-slate-300">c5i-terminal-{user?.id?.slice(-5) || 'web'}</span>
            </div>
          </div>
        </div>

        {/* LOGOUT BUTTON */}
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 rounded-xl border border-rose-900/50 hover:bg-rose-950/30 text-rose-400 font-semibold text-xs flex items-center justify-center gap-2 transition active:scale-98"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión Táctica</span>
        </button>
      </div>
    </div>
  );
}

export default ProfileScreen;
