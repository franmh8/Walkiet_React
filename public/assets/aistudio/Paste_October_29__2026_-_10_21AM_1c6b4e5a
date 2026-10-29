import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User as UserIcon,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  RotateCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { findUserByIdentifier, sendPhoneOtpApi, verifyPhoneOtpApi } from '../api/authApi';
import {
  evaluatePassword,
  isPasswordStrong,
  PasswordStrengthChecklist,
} from './PasswordStrengthChecklist';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisteredSuccess?: (phone: string) => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onRegisteredSuccess,
}) => {
  const { register } = useAuth();

  // Step state: 'form' | 'sms_verification' | 'success'
  const [step, setStep] = useState<'form' | 'sms_verification' | 'success'>('form');

  // Form Fields
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 6-digit SMS verification state
  const [generatedCode, setGeneratedCode] = useState('');
  const [smsDigits, setSmsDigits] = useState(['', '', '', '', '', '']);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendTimer, setResendTimer] = useState(0);

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset modal on open
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setName('');
      setPhoneNumber('');
      setCorreo('');
      setPassword('');
      setConfirmPassword('');
      setGeneratedCode('');
      setSmsDigits(['', '', '', '', '', '']);
      setResendTimer(0);
      setErrors({});
      setGeneralError(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Timer countdown for resending SMS
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  if (!isOpen) return null;

  // Validation function
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    const cleanName = name.trim();
    if (!cleanName) {
      newErrors.name = 'El nombre es obligatorio.';
    } else if (/\d/.test(cleanName)) {
      newErrors.name = 'El nombre no admite números.';
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/.test(cleanName)) {
      newErrors.name = 'El nombre solo admite letras y espacios.';
    } else if (cleanName.length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres.';
    }

    const cleanPhone = phoneNumber.trim();
    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phone_number = 'El número de teléfono es obligatorio.';
    } else if (phoneDigits.length !== 10) {
      newErrors.phone_number = 'El número debe contener exactamente 10 dígitos.';
    } else {
      const existing = findUserByIdentifier(phoneDigits);
      if (existing) {
        newErrors.phone_number = `Este número ya está registrado (${existing.name}).`;
      }
    }

    const cleanEmail = correo.trim();
    if (!cleanEmail) {
      newErrors.correo = 'El correo es obligatorio.';
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        newErrors.correo = 'Ingresa un correo con un formato válido.';
      } else {
        const existingEmail = findUserByIdentifier(cleanEmail);
        if (existingEmail) {
          newErrors.correo = `Este correo ya está registrado (${existingEmail.name}).`;
        }
      }
    }

    const pwdCriteria = evaluatePassword(password, confirmPassword);
    if (!password) {
      newErrors.password = 'La contraseña es obligatoria.';
    } else if (!isPasswordStrong(pwdCriteria)) {
      newErrors.password = 'La contraseña debe cumplir con todos los requisitos de seguridad.';
    }

    if (!confirmPassword) {
      newErrors.confirm_password = 'Confirma tu contraseña.';
    } else if (!pwdCriteria.matchesConfirm) {
      newErrors.confirm_password = 'Las contraseñas no coinciden.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Enviar SMS de verificación
  const handleProceedToVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) return;

    setLoading(true);

    const cleanPhone = phoneNumber.replace(/\D/g, '').trim();
    const res = await sendPhoneOtpApi(cleanPhone);

    setLoading(false);

    if (res.success && res.code) {
      setGeneratedCode(res.code);
      setSmsDigits(['', '', '', '', '', '']);
      setResendTimer(30);
      setStep('sms_verification');
    } else {
      setGeneralError(res.message || 'Error al conectar con el servicio SMS.');
    }
  };

  // Reenviar SMS
  const handleResendSms = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    const cleanPhone = phoneNumber.replace(/\D/g, '').trim();
    const res = await sendPhoneOtpApi(cleanPhone);
    setLoading(false);

    if (res.success && res.code) {
      setGeneratedCode(res.code);
      setSmsDigits(['', '', '', '', '', '']);
      setResendTimer(30);
      setErrors({});
    }
  };

  // Handle digit input for 6-box OTP
  const handleDigitChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const newArr = [...smsDigits];
    newArr[index] = clean;
    setSmsDigits(newArr);
    if (errors.sms) setErrors({});

    if (clean && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !smsDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handlePasteOtp = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newArr = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        newArr[i] = pasted[i];
      }
      setSmsDigits(newArr);
      const nextFocus = Math.min(5, pasted.length);
      digitRefs.current[nextFocus]?.focus();
    }
  };

  // Execute verification logic with real backend validation
  const executeVerification = async (codeToVerify: string) => {
    setGeneralError(null);

    const cleanInput = codeToVerify.trim();
    if (!cleanInput || cleanInput.length < 6) {
      setErrors({ sms: 'Ingresa los 6 dígitos del código.' });
      return;
    }

    setLoading(true);

    const cleanPhone = phoneNumber.replace(/\D/g, '').trim();
    const verifyRes = await verifyPhoneOtpApi(cleanPhone, cleanInput);

    if (!verifyRes.success) {
      setLoading(false);
      setErrors({ sms: verifyRes.message || 'Código incorrecto. Verifica los 6 dígitos.' });
      return;
    }

    // Código validado: dar de alta el usuario
    const cleanEmail = correo.trim();
    const cleanName = name.trim();
    const cleanPass = password;

    const autoDigits = cleanPhone.slice(-4) || 'TAC';
    const autoCallsign = `RADIO-${autoDigits}`;

    const regResult = await register({
      name: cleanName,
      phone_number: cleanPhone,
      correo: cleanEmail,
      password: cleanPass,
      callsign: autoCallsign,
      unit: 'Sector Operativo Hidalgo',
      role: 'Oficial de Radio',
    });

    setLoading(false);

    if (regResult.success) {
      setStep('success');
      setTimeout(() => {
        if (onRegisteredSuccess) {
          onRegisteredSuccess(cleanPhone);
        }
        onClose();
      }, 1200);
    } else {
      setGeneralError(regResult.message || 'Error al completar el registro.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/85 backdrop-blur-md select-none animate-fadeIn transition-colors duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-[#111726]/95 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl relative z-10 animate-scaleUp text-slate-800 dark:text-slate-100 transition-colors duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#691c32]/10 border border-[#691c32]/25 flex items-center justify-center text-[#8a1a36] dark:text-[#eb527c]">
              {step === 'sms_verification' ? (
                <Phone className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {step === 'sms_verification' ? 'Verificar Celular' : 'Registro'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* General Error Alert */}
        {generalError && (
          <div className="mb-4 p-2.5 bg-rose-50 dark:bg-[#2a0e17]/95 border border-rose-200 dark:border-rose-900/70 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <div className="flex-1 text-xs">{generalError}</div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 1: FORM */}
        {/* ========================================================= */}
        {step === 'form' && (
          <form onSubmit={handleProceedToVerification} className="space-y-3.5">
            {/* 1. Nombre */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nombre completo
                </label>
                {errors.name && (
                  <span className="text-[10px] text-rose-500 dark:text-rose-400">{errors.name}</span>
                )}
              </div>
              <div className="relative flex items-center">
                <UserIcon className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  id="reg-input-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!/\d/.test(val)) {
                      setName(val);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                    } else {
                      setErrors((prev) => ({ ...prev, name: 'Sin números' }));
                    }
                  }}
                  placeholder="Roberto Morales"
                  className={`w-full bg-slate-50 dark:bg-[#0b0f19] border rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors ${
                    errors.name
                      ? 'border-rose-500 ring-1 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-700/80 focus:border-sky-500 dark:focus:border-sky-400'
                  }`}
                />
              </div>
            </div>

            {/* 2. Teléfono */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Teléfono (10 dígitos)
                </label>
                {errors.phone_number && (
                  <span className="text-[10px] text-rose-500 dark:text-rose-400">{errors.phone_number}</span>
                )}
              </div>
              <div className="relative flex items-center">
                <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  id="reg-input-phone"
                  type="tel"
                  required
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhoneNumber(val);
                    if (errors.phone_number) setErrors((prev) => ({ ...prev, phone_number: '' }));
                  }}
                  placeholder="7712345678"
                  className={`w-full bg-slate-50 dark:bg-[#0b0f19] border rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors font-mono ${
                    errors.phone_number
                      ? 'border-rose-500 ring-1 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-700/80 focus:border-sky-500 dark:focus:border-sky-400'
                  }`}
                />
              </div>
            </div>

            {/* 3. Correo */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Correo electrónico
                </label>
                {errors.correo && (
                  <span className="text-[10px] text-rose-500 dark:text-rose-400">{errors.correo}</span>
                )}
              </div>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input
                  id="reg-input-email"
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => {
                    setCorreo(e.target.value);
                    if (errors.correo) setErrors((prev) => ({ ...prev, correo: '' }));
                  }}
                  placeholder="usuario@dominio.com"
                  className={`w-full bg-slate-50 dark:bg-[#0b0f19] border rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors ${
                    errors.correo
                      ? 'border-rose-500 ring-1 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-700/80 focus:border-sky-500 dark:focus:border-sky-400'
                  }`}
                />
              </div>
            </div>

            {/* 4. Contraseñas */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <input
                    id="reg-input-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    placeholder="Contraseña"
                    className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700/80 focus:border-sky-500 dark:focus:border-sky-400 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirmar
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <input
                    id="reg-input-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirm_password) setErrors((prev) => ({ ...prev, confirm_password: '' }));
                    }}
                    placeholder="Repite"
                    className="w-full bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700/80 focus:border-sky-500 dark:focus:border-sky-400 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Checklist de Requisitos de Contraseña en Vivo */}
            {(password.length > 0 || confirmPassword.length > 0) && (
              <div className="animate-fadeIn">
                <PasswordStrengthChecklist
                  criteria={evaluatePassword(password, confirmPassword)}
                  showConfirmCheck={true}
                  hasTypedConfirm={confirmPassword.length > 0}
                />
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-submit-register"
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-[#691c32] via-[#8a1a36] to-[#691c32] hover:from-[#7a1834] hover:via-[#9f2241] active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-md shadow-[#691c32]/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Continuar</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* STEP 2: VERIFICAR CELULAR */}
        {/* ========================================================= */}
        {step === 'sms_verification' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeVerification(smsDigits.join(''));
            }}
            className="space-y-4 animate-fadeIn"
          >
            {/* Top row: Volver and Auto-fill code link */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setErrors({});
                  setGeneralError(null);
                }}
                className="text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>

              {generatedCode && (
                <button
                  type="button"
                  onClick={() => {
                    setSmsDigits(generatedCode.split(''));
                    setErrors({});
                  }}
                  className="text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Código: {generatedCode}
                </button>
              )}
            </div>

            {/* Error banner if code fails */}
            {errors.sms && (
              <div className="p-2.5 bg-rose-50 dark:bg-[#2a0e17]/95 border border-rose-200 dark:border-rose-900/70 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="flex-1 text-xs">{errors.sms}</span>
              </div>
            )}

            {/* 6-digit OTP Inputs */}
            <div className="text-center">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-3">
                Código de verificación (6 dígitos)
              </label>

              <div
                className="flex items-center justify-center gap-2 my-2"
                onPaste={handlePasteOtp}
              >
                {smsDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (digitRefs.current[idx] = el)}
                    id={`input-sms-digit-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                    className="w-10 h-12 bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700/80 focus:border-sky-500 dark:focus:border-sky-400 text-slate-900 dark:text-white font-mono font-bold text-center text-lg rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500/30 dark:focus:ring-sky-400/30 transition-all"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
            </div>

            {/* Resend Link */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleResendSms}
                disabled={resendTimer > 0}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 disabled:text-slate-300 dark:disabled:text-slate-600 inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                <span>
                  {resendTimer > 0 ? `Reenviar en ${resendTimer}s` : 'Reenviar código'}
                </span>
              </button>
            </div>

            {/* Action Buttons: Cancelar & Validar */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-sms-register"
                type="submit"
                disabled={loading || smsDigits.join('').trim().length !== 6}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-[#691c32] via-[#8a1a36] to-[#691c32] hover:from-[#7a1834] hover:via-[#9f2241] active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-md shadow-[#691c32]/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Validar</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* STEP 3: SUCCESS */}
        {/* ========================================================= */}
        {step === 'success' && (
          <div className="py-4 text-center space-y-3 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">¡Registro completado!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Número validado. Redirigiendo al inicio de sesión...
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
