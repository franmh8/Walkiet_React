import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  User,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { C5iLogo } from '../components/C5iLogo';
import { RegisterModal } from '../components/RegisterModal';

interface LoginScreenProps {
  onOpenRegister?: () => void;
  onOpenForgotPassword?: () => void;
  onOpenApiSettings?: () => void;
  prefilledIdentifier?: string;
  prefilledSuccessMessage?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onOpenRegister,
  onOpenForgotPassword,
  onOpenApiSettings,
  prefilledIdentifier = '',
  prefilledSuccessMessage = null,
}) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState(prefilledIdentifier || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field-specific validation states
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Warning banner (matches user screenshot exactly)
  const [inlineWarning, setInlineWarning] = useState<string | null>(null);

  // Top banner success message
  const [successMessage, setSuccessMessage] = useState<string | null>(prefilledSuccessMessage);

  // Internal modals for register & password recovery if not handled by props
  const [internalRegisterOpen, setInternalRegisterOpen] = useState(false);
  const [internalRecoverOpen, setInternalRecoverOpen] = useState(false);
  const [recoverPhone, setRecoverPhone] = useState('');
  const [recoverSuccess, setRecoverSuccess] = useState(false);

  // Input refs
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefilledIdentifier) {
      setIdentifier(prefilledIdentifier);
      setIdentifierError(null);
    }
  }, [prefilledIdentifier]);

  useEffect(() => {
    if (prefilledSuccessMessage) {
      setSuccessMessage(prefilledSuccessMessage);
      const timer = setTimeout(() => setSuccessMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [prefilledSuccessMessage]);

  // Helper to validate identifier format (10 digits or email or callsign)
  const isValidIdentifierFormat = (id: string): boolean => {
    const clean = id.trim();
    if (clean.includes('@')) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return emailRegex.test(clean);
    }
    return clean.length >= 3;
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setIdentifierError(null);
    setPasswordError(null);
    setInlineWarning(null);
    setSuccessMessage(null);

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    // 1. Validar campos vacíos
    if (!cleanIdentifier && !cleanPassword) {
      setIdentifierError('Campo requerido');
      setPasswordError('Campo requerido');
      setInlineWarning('Por favor ingresa tu teléfono o correo y tu contraseña.');
      identifierInputRef.current?.focus();
      return;
    }

    if (!cleanIdentifier) {
      setIdentifierError('Campo requerido');
      setInlineWarning('Por favor ingresa tu teléfono celular o correo institucional.');
      identifierInputRef.current?.focus();
      return;
    }

    if (!cleanPassword) {
      setPasswordError('Campo requerido');
      setInlineWarning('Por favor ingresa tu contraseña de acceso.');
      passwordInputRef.current?.focus();
      return;
    }

    // 2. Validar formato previo si no cumple longitud básica
    if (!isValidIdentifierFormat(cleanIdentifier)) {
      setIdentifierError('Formato inválido');
      setInlineWarning('El formato del teléfono o correo no es válido (10 dígitos o correo).');
      identifierInputRef.current?.focus();
      return;
    }

    // 3. Ejecutar autenticación
    setIsSubmitting(true);
    try {
      const res = await login(cleanIdentifier, cleanPassword);

      if (!res.success) {
        const errorCode = res.code || '';
        const msg = res.message || '';

        // CASO A: Usuario no registrado o no encontrado
        if (
          errorCode === 'USER_NOT_FOUND' ||
          msg.toLowerCase().includes('no se encuentra registrado') ||
          msg.toLowerCase().includes('no encontrado') ||
          msg.toLowerCase().includes('inexistente')
        ) {
          setIdentifierError('Usuario no registrado');
          setInlineWarning(`El usuario «${cleanIdentifier}» no se encuentra registrado en el sistema.`);
          identifierInputRef.current?.focus();
          return;
        }

        // CASO B: Contraseña incorrecta
        if (
          errorCode === 'INVALID_PASSWORD' ||
          msg.toLowerCase().includes('contraseña incorrecta') ||
          msg.toLowerCase().includes('contraseña errónea')
        ) {
          setPasswordError('Contraseña incorrecta');
          setInlineWarning('Contraseña incorrecta. Verifica tu contraseña o solicítala nuevamente.');
          setPassword('');
          passwordInputRef.current?.focus();
          return;
        }

        // CASO C: Límite de intentos excedido
        if (
          errorCode === 'RATE_LIMITED' ||
          msg.toLowerCase().includes('bloqueado') ||
          msg.toLowerCase().includes('intentos')
        ) {
          setInlineWarning('Acceso temporalmente suspendido por múltiples intentos fallidos.');
          return;
        }

        // CASO D: Error genérico
        setInlineWarning(msg || 'Error al validar credenciales en el sistema.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setInlineWarning('Error de conexión al servidor de autenticación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterClick = () => {
    if (onOpenRegister) {
      onOpenRegister();
    } else {
      setInternalRegisterOpen(true);
    }
  };

  const handleForgotPasswordClick = () => {
    if (onOpenForgotPassword) {
      onOpenForgotPassword();
    } else {
      setInternalRecoverOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0c0f17] text-slate-800 dark:text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative select-none transition-colors duration-200">
      {/* Subtle radial ambient background glow in C5i burgundy */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#691c32]/10 dark:bg-[#691c32]/20 rounded-full blur-3xl pointer-events-none" />

      {/* Minimalist Card */}
      <div className="w-full max-w-sm bg-white/95 dark:bg-[#121622]/95 border border-slate-200 dark:border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl backdrop-blur-xl relative z-10 transition-colors duration-200">
        {/* Logo & Branding - C5i Hidalgo Emblem */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="mb-2 transition-transform duration-200 hover:scale-105">
            <C5iLogo className="w-36 h-28" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center justify-center">
            C5i Walkiet
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sistema de Radiocomunicación Táctica
          </p>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-700/60 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="flex-1 leading-tight">{successMessage}</span>
          </div>
        )}

        {/* Inline Warning Banner */}
        {inlineWarning && (
          <div
            id="login-inline-warning-alert"
            role="alert"
            className="mb-4 p-3 bg-rose-50 dark:bg-[#2a0e17]/95 border border-rose-200 dark:border-rose-900/70 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5 animate-fadeIn shadow-sm dark:shadow-lg dark:shadow-rose-950/30"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="flex-1 leading-snug text-xs">{inlineWarning}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} noValidate className="space-y-4">
          {/* Email or Phone field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Teléfono o Correo
              </label>
              {identifierError && (
                <span className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                  {identifierError}
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <div
                className={`absolute left-3.5 pointer-events-none transition-colors ${
                  identifierError ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <User className="w-4 h-4" />
              </div>
              <input
                ref={identifierInputRef}
                id="input-identifier"
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (identifierError) setIdentifierError(null);
                  if (inlineWarning) setInlineWarning(null);
                }}
                placeholder="Ingresa tu teléfono o correo"
                className={`w-full bg-slate-50 dark:bg-[#0b0f19] border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all font-sans ${
                  identifierError
                    ? 'border-rose-500/80 bg-rose-50/50 dark:bg-rose-950/15 ring-2 ring-rose-500/20 text-rose-900 dark:text-rose-100'
                    : 'border-slate-300 dark:border-slate-700/70 focus:border-[#8a1a36] dark:focus:border-[#a62846] focus:ring-1 focus:ring-[#8a1a36]/25 dark:focus:ring-[#a62846]/30'
                }`}
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Contraseña
              </label>
              {passwordError && (
                <span className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                  {passwordError}
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <div
                className={`absolute left-3.5 pointer-events-none transition-colors ${
                  passwordError ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <Lock className="w-4 h-4" />
              </div>
              <input
                ref={passwordInputRef}
                id="input-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                  if (inlineWarning) setInlineWarning(null);
                }}
                placeholder="Ingresa tu contraseña"
                className={`w-full bg-slate-50 dark:bg-[#0b0f19] border rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all ${
                  passwordError
                    ? 'border-rose-500/80 bg-rose-50/50 dark:bg-rose-950/15 ring-2 ring-rose-500/20 text-rose-900 dark:text-rose-100'
                    : 'border-slate-300 dark:border-slate-700/70 focus:border-[#8a1a36] dark:focus:border-[#a62846] focus:ring-1 focus:ring-[#8a1a36]/25 dark:focus:ring-[#a62846]/30'
                }`}
              />
              <button
                id="btn-toggle-password"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 cursor-pointer transition-colors"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Login Button in Official C5i Hidalgo Burgundy */}
          <button
            id="btn-submit-login"
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-gradient-to-r from-[#691c32] via-[#8a1a36] to-[#691c32] hover:from-[#7a1834] hover:via-[#9f2241] hover:to-[#7a1834] active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-[#691c32]/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 text-sm"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>

        {/* Minimalist Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <button
            id="btn-open-forgot-pass-footer"
            type="button"
            onClick={handleForgotPasswordClick}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-[#8a1a36] dark:hover:text-[#eb527c] transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Recuperar acceso</span>
          </button>

          <button
            id="btn-open-register"
            type="button"
            onClick={handleRegisterClick}
            className="flex items-center gap-1.5 text-[#8a1a36] dark:text-[#eb527c] hover:text-[#9f2241] dark:hover:text-[#ff6b93] font-semibold transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrarse</span>
          </button>
        </div>
      </div>

      {/* Internal Register Modal */}
      <RegisterModal
        visible={internalRegisterOpen}
        onClose={() => setInternalRegisterOpen(false)}
        onSuccess={() => {
          setSuccessMessage('Oficial registrado exitosamente. Ya puedes iniciar sesión.');
          setInternalRegisterOpen(false);
        }}
      />

      {/* Internal Recover Access Modal */}
      {internalRecoverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121622] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-[#8a1a36] dark:text-rose-400">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recuperar Acceso Operativo</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ingresa tu número telefónico registrado para reestablecer tu clave con la central de mando C5i.
            </p>
            {recoverSuccess ? (
              <div className="p-3 text-xs rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                Se envió un PIN temporal de 4 dígitos a tu terminal operativa (Clave demo: 123).
              </div>
            ) : (
              <input
                type="tel"
                value={recoverPhone}
                onChange={(e) => setRecoverPhone(e.target.value)}
                placeholder="Teléfono (10 dígitos)"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#8a1a36]"
              />
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setInternalRecoverOpen(false);
                  setRecoverSuccess(false);
                  setRecoverPhone('');
                }}
                className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Cerrar
              </button>
              {!recoverSuccess && (
                <button
                  type="button"
                  onClick={() => {
                    if (recoverPhone.replace(/\D/g, '').length >= 7) {
                      setRecoverSuccess(true);
                    } else {
                      setRecoverPhone('7711234567');
                      setRecoverSuccess(true);
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#691c32] to-[#8a1a36] hover:opacity-95 text-white text-xs font-bold"
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
};

export default LoginScreen;
