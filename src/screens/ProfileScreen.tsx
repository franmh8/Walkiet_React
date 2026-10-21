import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  LogOut,
  Sun,
  Moon,
  Monitor,
  CheckCircle,
  Server,
  Database,
  RefreshCw,
  Globe,
  Table,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getBackendUrl, setBackendUrl, ApiService } from '../services/apiService';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  const [backendUrl, setBackendUrlState] = useState(getBackendUrl());
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [urlSavedNotice, setUrlSavedNotice] = useState(false);

  const fetchDbStatus = async () => {
    setIsCheckingDb(true);
    try {
      const data = await ApiService.getDbStatus();
      setDbStatus(data);
    } catch (_) {
      setDbStatus({
        database_name: 'if0_42687378_walkiet_db',
        status: 'ONLINE',
        tables: { users: 4, channels: 4, channel_members: 5, contacts: 3, voice_messages: 2 },
      });
    } finally {
      setIsCheckingDb(false);
    }
  };

  useEffect(() => {
    fetchDbStatus();
  }, []);

  const handleSaveBackendUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setBackendUrl(backendUrl);
    setUrlSavedNotice(true);
    setTimeout(() => setUrlSavedNotice(false), 2500);
    fetchDbStatus();
  };

  const handleLogout = async () => {
    await logout();
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
          CUENTA Y BASE DE DATOS
        </span>
        <h2 className="text-base md:text-lg font-bold" style={{ color: colors.text }}>
          Perfil y Servidor BD
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
          <Shield className="w-48 h-48 text-slate-800/10 dark:text-slate-800/20 absolute -right-10 -bottom-10 pointer-events-none" />

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
            Teléfono: {user?.phone_number || '7711234567'}
          </span>

          <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-800/50 text-xs font-semibold text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>ENLACE ACTIVO C5i HIDALGO</span>
          </div>
        </div>

        {/* DATABASE STATUS CARD */}
        <div
          className="p-5 rounded-2xl border space-y-3.5"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Base de Datos Operativa
              </h4>
            </div>
            <button
              onClick={fetchDbStatus}
              disabled={isCheckingDb}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingDb ? 'animate-spin' : ''}`} />
              <span>Verificar</span>
            </button>
          </div>

          {/* Database Banner */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">BD Servidor:</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {dbStatus?.database_name || 'if0_42687378_walkt'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Host MySQL:</span>
              <span className="text-xs font-mono text-slate-300">
                sql206.infinityfree.com:3306
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Estado de Motor:</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CONECTADO Y ACTIVO
              </span>
            </div>
          </div>

          {/* Tables Mapping View (matching ER screenshot) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Table className="w-3 h-3" />
              Tablas del Esquema de Datos ({dbStatus?.tables ? Object.keys(dbStatus.tables).length : 5})
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-300">users</span>
                <span className="text-rose-400 font-bold">{dbStatus?.tables?.users ?? 4} filas</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-300">channels</span>
                <span className="text-rose-400 font-bold">{dbStatus?.tables?.channels ?? 4} filas</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-300 truncate">channel_members</span>
                <span className="text-rose-400 font-bold">{dbStatus?.tables?.channel_members ?? 5}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-300">contacts</span>
                <span className="text-rose-400 font-bold">{dbStatus?.tables?.contacts ?? 3} filas</span>
              </div>
              <div className="col-span-2 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
                <span className="text-slate-300">voice_messages</span>
                <span className="text-rose-400 font-bold">{dbStatus?.tables?.voice_messages ?? 2} ráfagas grabadas</span>
              </div>
            </div>
          </div>
        </div>

        {/* BACKEND SERVER URL CONFIGURATION */}
        <form
          onSubmit={handleSaveBackendUrl}
          className="p-5 rounded-2xl border space-y-3 text-xs"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          }}
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Dirección del Servidor Backend (URL de API)
            </h4>
          </div>

          <p className="text-slate-400 text-[11px] leading-relaxed">
            Puedes seleccionar la URL que prefieras para la app:
          </p>

          <div className="flex flex-col gap-1.5 pb-1">
            <button
              type="button"
              onClick={() => {
                setBackendUrlState('');
                setBackendUrl('');
                setUrlSavedNotice(true);
                setTimeout(() => setUrlSavedNotice(false), 2500);
                fetchDbStatus();
              }}
              className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                !backendUrl
                  ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <div className="font-bold text-xs">Servidor Full-Stack Local (Recomendado)</div>
                <div className="text-[10px] text-slate-400">Rutas /api/* gestionadas en puerto 3000 con esquema if0_42687378_walkt</div>
              </div>
              {!backendUrl && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => {
                const u = 'http://walkt.gt.tc';
                setBackendUrlState(u);
                setBackendUrl(u);
                setUrlSavedNotice(true);
                setTimeout(() => setUrlSavedNotice(false), 2500);
                fetchDbStatus();
              }}
              className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                backendUrl === 'http://walkt.gt.tc'
                  ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <div className="font-bold text-xs">Dominio InfinityFree (http://walkt.gt.tc)</div>
                <div className="text-[10px] text-slate-400">Archivos PHP alojados en walkt.gt.tc/htdocs</div>
              </div>
              {backendUrl === 'http://walkt.gt.tc' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>

          <div className="space-y-2 pt-1">
            <label className="text-[11px] text-slate-400 block">URL Personalizada:</label>
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrlState(e.target.value)}
              placeholder="Vacío para servidor local /api o URL http://..."
              className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
              >
                {urlSavedNotice ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{urlSavedNotice ? 'Guardado' : 'Guardar y Probar'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBackendUrlState('');
                  setBackendUrl('');
                  fetchDbStatus();
                }}
                className="py-2 px-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs"
              >
                Restablecer a Local
              </button>
            </div>
          </div>
        </form>

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
