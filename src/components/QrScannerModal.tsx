import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Check, AlertTriangle, KeyRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
}

export function QrScannerModal({ visible, onClose, onScanned }: QrScannerModalProps) {
  const { colors } = useTheme();
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (visible) {
      setCameraError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { facingMode: 'environment' } })
          .then((s) => {
            stream = s;
            setCameraActive(true);
            if (videoRef.current) {
              videoRef.current.srcObject = s;
            }
          })
          .catch(() => {
            setCameraActive(false);
            setCameraError('Cámara no disponible en este dispositivo. Ingresa el código PIN táctico manualmente.');
          });
      } else {
        setCameraActive(false);
        setCameraError('Dispositivo sin acceso a cámara web. Usa el código numérico.');
      }
    } else {
      if (stream) {
        (stream as MediaStream).getTracks().forEach((t) => t.stop());
      }
      setCameraActive(false);
    }

    return () => {
      if (stream) {
        (stream as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [visible]);

  if (!visible) return null;

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onScanned(manualCode.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
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
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Escanear Código QR Táctico</h3>
              <p className="text-xs text-slate-400">Enfoca el código QR de frecuencia o canal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {cameraActive ? (
            <div className="relative h-60 rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Tactical reticle */}
              <div className="absolute inset-8 border-2 border-dashed border-rose-500/80 rounded-xl pointer-events-none animate-pulse flex items-center justify-center">
                <span className="text-[11px] font-mono text-rose-400 bg-black/60 px-2 py-1 rounded">
                  ESCANER ACTIVO C5i
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <KeyRound className="w-10 h-10 text-rose-400 mx-auto opacity-80" />
              <p className="text-sm font-semibold text-white">Ingreso Táctico por Código</p>
              <p className="text-xs text-slate-400">
                {cameraError || 'Ingresa el código o PIN táctico del canal directamente.'}
              </p>
            </div>
          )}

          {/* Manual input */}
          <form onSubmit={handleSubmitManual} className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">
              Código de Canal o PIN Táctico
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ej. 1090 o chan-tactico-01"
                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm disabled:opacity-40 transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Unirse
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition"
          >
            Cerrar Escáner
          </button>
        </div>
      </div>
    </div>
  );
}

export default QrScannerModal;
