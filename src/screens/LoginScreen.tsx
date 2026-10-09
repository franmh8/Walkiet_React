import React, { useState } from 'react';
import {
  Shield,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  Radio,
  AlertTriangle,
  UserPlus,
  KeyRound,
  CheckCircle2,
  Phone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { RegisterModal } from '../components/RegisterModal';

export function LoginScreen() {
  const { login } = useAuth();
  const { colors, isDark } = useTheme();

  const [identifier, setIdentifier] = useState('7711234567');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registerVisible, setRegisterVisible] = useState(false);
  const [recoverVisible, setRecoverVisible] = useState(false);
  const [recoverSuccess, setRecoverSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId) {
      setErrorMessage('Ingresa tu teléfono o correo institucional.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(cleanId, cleanPass);
      if (!res.success) {
        setErrorMessage(res.message || 'Error al validar credenciales tácticas.');
      }
    } catch (_) {
      setErrorMessage('Error de conexión con el sistema C5i.');
    } finally {
      setLoading(false);
    }
  };

  const handleFastDemoLogin = async (demoId: string) => {
    setIdentifier(demoId);
    setPassword('123');
    setLoading(true);
    await login(demoId, '123');
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: colors.background }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden p-6 md:p-8 space-y-6"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        }}
      >
        {/* LOGO & BRANDING */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-800 to-rose-600 mx-auto flex items-center justify-center text-white shadow-lg shadow-rose-950/40">
            <Radio className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-wider uppercase" style={{ color: colors.text }}>
              C5i Hidalgo WalkieT
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Red Táctica Push-to-Talk y Despacho Operativo
            </p>
          </div>
        </div>

        {/* ERROR NOTICE */}
        {errorMessage && (
          <div className="p-3 text-xs rounded-xl bg-rose-950/40 border border-rose-800 text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Teléfono (10 dígitos), Correo o Callsign
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Ej. 7711234567 o HALCON-01"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Contraseña Táctica
              </label>
              <button
                type="button"
                onClick={() => setRecoverVisible(true)}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                ¿Olvidaste tu clave?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-rose-950/40 transition active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Validando con Central C5i...' : 'Iniciar Sesión Táctica'}
          </button>
        </form>

        {/* FAST DEMO ACCESS */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block text-center">
            ACCESO RÁPIDO PARA PRUEBAS (DEMO)
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleFastDemoLogin('7711234567')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-700 text-left transition"
            >
              <div className="font-bold text-rose-400 font-mono">HALCON-01</div>
              <div className="text-[11px] text-slate-400 truncate">Comandante Morales</div>
            </button>
            <button
              onClick={() => handleFastDemoLogin('7719876543')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-700 text-left transition"
            >
              <div className="font-bold text-rose-400 font-mono">PATRULLA-04</div>
              <div className="text-[11px] text-slate-400 truncate">Oficial Mendoza</div>
            </button>
          </div>
        </div>

        {/* REGISTER BUTTON */}
        <div className="text-center">
          <button
            onClick={() => setRegisterVisible(true)}
            className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition"
          >
            <UserPlus className="w-3.5 h-3.5 text-rose-400" />
            <span>¿Nuevo oficial? Dar de alta en la red</span>
          </button>
        </div>
      </div>

      {/* REGISTER MODAL */}
      <RegisterModal
        visible={registerVisible}
        onClose={() => setRegisterVisible(false)}
      />

      {/* RECOVER MODAL */}
      {recoverVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl p-6 space-y-4"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            }}
          >
            <h3 className="text-sm font-bold text-white">Recuperar Acceso Operativo</h3>
            <p className="text-xs text-slate-400">
              Ingresa tu número telefónico registrado para reestablecer tu clave con la central de despacho C5i.
            </p>
            {recoverSuccess ? (
              <div className="p-3 text-xs rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-400">
                Se envió un PIN temporal de 4 dígitos a tu terminal operativa (Clave demo: 123).
              </div>
            ) : (
              <input
                type="tel"
                placeholder="Teléfono (10 dígitos)"
                className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRecoverVisible(false);
                  setRecoverSuccess(false);
                }}
                className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
              >
                Cerrar
              </button>
              {!recoverSuccess && (
                <button
                  onClick={() => setRecoverSuccess(true)}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                >
                  Solicitar PIN
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginScreen;
