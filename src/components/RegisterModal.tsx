import React, { useState } from 'react';
import { X, Shield, User, Phone, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface RegisterModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RegisterModal({ visible, onClose, onSuccess }: RegisterModalProps) {
  const { register } = useAuth();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callsign, setCallsign] = useState('');
  const [unit, setUnit] = useState('Sector Operativo Hidalgo');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Ingresa el nombre completo del oficial.');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('El teléfono celular debe contener exactamente 10 dígitos.');
      return;
    }

    if (!callsign.trim()) {
      setError('Ingresa el indicativo o clave de radio (Callsign).');
      return;
    }

    if (!password.trim() || password.length < 3) {
      setError('La contraseña debe tener al menos 3 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const ok = await register({
        name: name.trim(),
        phone_number: cleanPhone,
        callsign: callsign.trim().toUpperCase(),
        unit: unit.trim(),
        password: password.trim(),
      });

      if (ok) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError('No se pudo completar el registro.');
      }
    } catch (_) {
      setError('Error inesperado durante el registro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600/20 text-rose-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Alta de Oficial C5i</h3>
              <p className="text-xs text-slate-400">Registro operativo en la red de radiocomunicación</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleRegister} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-950/40 border border-rose-800 text-rose-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nombre Completo</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Oficial Carlos Santana"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Teléfono Móvil (10 dígitos)</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="tel"
                maxLength={10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Ej. 7712345678"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Indicativo (Callsign)</label>
              <input
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                placeholder="Ej. BRAVO-02"
                className="w-full px-3 py-2 text-sm uppercase rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Unidad / Sector Asignado</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-rose-500"
            >
              <option value="Fuerza Especial de Reacción C5i">Fuerza Especial de Reacción C5i</option>
              <option value="Sector Operativo Hidalgo">Sector Operativo Hidalgo</option>
              <option value="Sector Operativo Pachuca Sur">Sector Operativo Pachuca Sur</option>
              <option value="Sector Operativo Pachuca Norte">Sector Operativo Pachuca Norte</option>
              <option value="Vialidad y Tránsito Estatal">Vialidad y Tránsito Estatal</option>
              <option value="Despacho Central 911">Despacho Central 911</option>
            </select>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Registrando...' : 'Completar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterModal;
