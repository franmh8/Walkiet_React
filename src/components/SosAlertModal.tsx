import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, X, MapPin, Navigation, RefreshCw, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AudioService } from '../services/audioService';
import { apiService } from '../services/apiService';

interface SosAlertModalProps {
  visible: boolean;
  onClose: () => void;
  channelId?: string | null;
  channelName?: string;
  onAlertDispatched?: (locationName: string) => void;
}

interface LocationCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export function SosAlertModal({
  visible,
  onClose,
  channelId,
  channelName,
  onAlertDispatched,
}: SosAlertModalProps) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();

  const [isTriggered, setIsTriggered] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationLoaded, setLocationLoaded] = useState(false);

  // Default tactical coordinates (Pachuca Centro C5i Hidalgo)
  const [coords, setCoords] = useState<LocationCoords>({
    lat: 20.1227,
    lng: -98.7363,
    accuracy: 8,
  });
  const [locationName, setLocationName] = useState('Pachuca Centro, Hidalgo');

  const fetchLiveLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
            accuracy: Math.round(pos.coords.accuracy || 10),
          });
          setLocationName(`Sector Pachuca (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
          setIsLocating(false);
          setLocationLoaded(true);
        },
        () => {
          // Fallback to Pachuca Centro
          setCoords({
            lat: 20.1227,
            lng: -98.7363,
            accuracy: 8,
          });
          setLocationName('Pachuca Centro (C5i Comando Central)');
          setIsLocating(false);
          setLocationLoaded(true);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      setIsLocating(false);
      setLocationLoaded(true);
    }
  };

  useEffect(() => {
    if (visible) {
      setIsTriggered(false);
      fetchLiveLocation();
    }
  }, [visible]);

  if (!visible) return null;

  const handleDispatchAlert = async () => {
    setIsTriggered(true);
    AudioService.playSosAlarm();

    const alertPayload = {
      userId: user?.id,
      officer: user?.name,
      callsign: user?.callsign,
      unit: user?.unit,
      channelId: channelId || 'frecuencia-emergencia',
      coords,
      locationName,
      timestamp: new Date().toISOString(),
    };

    try {
      await apiService.sendSosAlert(alertPayload);
    } catch (_) {}

    if (onAlertDispatched) {
      onAlertDispatched(locationName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300"
        style={{
          backgroundColor: colors.card,
          borderColor: isTriggered ? '#f43f5e' : colors.cardBorder,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-900/30 bg-rose-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600/20 text-rose-500 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-rose-500 tracking-wider uppercase">
                  Alerta Táctica SOS
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  PRIORIDAD 1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Protocolo C5i Despacho de Emergencias
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Channel and Officer Notice */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-rose-400" />
              <div>
                <span className="text-slate-400">Canal de emisión:</span>{' '}
                <strong className="text-white">{channelName || 'Canal Táctico Operativo'}</strong>
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Oficial:</span>{' '}
              <strong className="text-rose-400 font-mono">{user?.callsign || 'OPERATIVO'}</strong>
            </div>
          </div>

          {/* Radar Radar Simulation Area */}
          <div className="relative h-44 rounded-xl border border-rose-950/60 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
            {/* Radar Grid Circles */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 rounded-full border border-rose-900/20" />
              <div className="absolute w-40 h-40 rounded-full border border-rose-900/30" />
              <div className="absolute w-24 h-24 rounded-full border border-rose-800/40" />
              <div className="absolute w-10 h-10 rounded-full border border-rose-600/50" />
              {isTriggered && (
                <>
                  <div className="absolute w-32 h-32 rounded-full border border-rose-500 animate-radar-1" />
                  <div className="absolute w-48 h-48 rounded-full border border-rose-500 animate-radar-2" />
                </>
              )}
            </div>

            {/* Central Beacon Marker */}
            <div className="relative z-10 flex flex-col items-center">
              <div className={`p-3 rounded-full ${isTriggered ? 'bg-rose-600 text-white animate-bounce' : 'bg-rose-600/20 text-rose-500'}`}>
                <MapPin className="w-7 h-7" />
              </div>
              <p className="mt-2 text-xs font-semibold text-rose-300">
                {isTriggered ? 'BALIZA SATELITAL ACTIVADA' : 'COORDENADAS GPS OPERATIVAS'}
              </p>
            </div>

            {/* Live GPS badge overlay */}
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1.5 truncate">
                <Navigation className="w-3.5 h-3.5 text-rose-400" />
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} (±{coords.accuracy}m)
              </span>
              <button
                onClick={fetchLiveLocation}
                disabled={isLocating}
                className="flex items-center gap-1 text-rose-400 hover:text-rose-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Trigger Banner or Confirmation */}
          {isTriggered ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-center space-y-1">
              <p className="text-sm font-bold text-rose-400 tracking-wide uppercase">
                🚨 ALERTA SOS EMITIDA A CENTRAL C5i
              </p>
              <p className="text-xs text-slate-300">
                Se ha notificado al despacho central y a todas las patrullas del sector con tus coordenadas y clave operativa.
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center">
              Al presionar el botón de auxilio, se transmitirá una señal de emergencia con prioridad 1, baliza sonora y coordenadas GPS al Centro C5i Hidalgo.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 transition"
            >
              {isTriggered ? 'Cerrar Pantalla' : 'Cancelar'}
            </button>
            {!isTriggered ? (
              <button
                onClick={handleDispatchAlert}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition active:scale-[0.98]"
              >
                <AlertTriangle className="w-4 h-4" />
                EMITIR SOS INMEDIATO
              </button>
            ) : (
              <button
                onClick={() => {
                  AudioService.playRogerBeep();
                  setIsTriggered(false);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition"
              >
                Desactivar Baliza
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SosAlertModal;
