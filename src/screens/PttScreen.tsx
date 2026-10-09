import React, { useState, useEffect } from 'react';
import {
  Mic,
  AlertTriangle,
  Users,
  Radio,
  Play,
  Volume2,
  Clock,
  Shield,
  Wifi,
  X,
  User,
  RadioTower,
} from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SosAlertModal } from '../components/SosAlertModal';
import { Contact, VoiceMessage } from '../types';

interface PttScreenProps {
  onNavigateTab: (tab: string) => void;
}

export function PttScreen({ onNavigateTab }: PttScreenProps) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const {
    selectedChannel,
    isTransmitting,
    startTransmitting,
    stopTransmitting,
    channels,
    voiceHistory,
    playVoiceMessage,
  } = useRadio();

  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [txSeconds, setTxSeconds] = useState(0);

  // Transmission timer
  useEffect(() => {
    let timer: any;
    if (isTransmitting) {
      setTxSeconds(0);
      timer = setInterval(() => {
        setTxSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTxSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTransmitting]);

  // Keyboard shortcut: Spacebar hold for PTT
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        startTransmitting();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        stopTransmitting();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startTransmitting, stopTransmitting]);

  const channelTitle = selectedChannel
    ? selectedChannel.name
    : channels.length === 0
    ? 'Sin canales (Toca para agregar)'
    : 'Selecciona un canal';

  const memberCount = selectedChannel?.member_count || (channels.length === 0 ? 0 : 1);

  // Simulated members for the selected channel
  const channelMembers = [
    { id: '1', name: user?.name || 'Tú', callsign: user?.callsign || 'OPERATIVO', status: 'online' as const, isMe: true },
    { id: '2', name: 'Oficial Karla Mendoza', callsign: 'PATRULLA-04', status: 'online' as const, isMe: false },
    { id: '3', name: 'Comandante R. Morales', callsign: 'HALCON-01', status: 'online' as const, isMe: false },
    { id: '4', name: 'Despacho Central 911', callsign: 'CENTRAL-C5I', status: 'online' as const, isMe: false },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* TOP BAR */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b backdrop-blur-md sticky top-0 z-20"
        style={{
          backgroundColor: colors.headerBackground,
          borderColor: colors.border,
        }}
      >
        <button
          onClick={() => onNavigateTab('Grupos')}
          className="flex flex-col text-left group transition max-w-[65%]"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-rose-400">
            CANAL ACTUAL
          </span>
          <span
            className="text-sm md:text-base font-bold truncate transition group-hover:text-rose-400"
            style={{ color: colors.text }}
          >
            {channelTitle}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* SOS button */}
          <button
            onClick={() => setSosModalVisible(true)}
            title="Emitir Alerta Táctica SOS"
            className="p-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white shadow-md shadow-rose-950/40 transition active:scale-95 animate-pulse"
          >
            <AlertTriangle className="w-4 h-4 fill-white/20" />
          </button>

          {/* Members count pill */}
          <button
            onClick={() => setMembersModalVisible(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition hover:bg-slate-800/40"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              color: colors.text,
            }}
          >
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>{memberCount}</span>
          </button>
        </div>
      </div>

      {/* CENTER PTT AREA */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Status Prompt & Timer */}
        <div className="mb-8 text-center min-h-[3rem] flex flex-col items-center justify-center">
          {isTransmitting ? (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-950/60 border border-rose-800/80 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
              <span className="text-sm font-mono font-bold text-rose-300">
                TRANSMITIENDO ({txSeconds.toString().padStart(2, '0')}s)...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Listo para transmitir</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Mantén presionado el botón o la barra <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono border border-slate-700 text-slate-300">Espacio</kbd>
              </p>
            </div>
          )}
        </div>

        {/* Big PTT Circle Button with Radar concentric waves */}
        <div className="relative flex items-center justify-center my-2">
          {/* Animated radar rings when transmitting */}
          {isTransmitting && (
            <>
              <div className="absolute w-64 h-64 md:w-72 md:h-72 rounded-full border border-rose-500/60 animate-radar-1 pointer-events-none" />
              <div className="absolute w-80 h-80 md:w-96 md:h-96 rounded-full border border-rose-400/40 animate-radar-2 pointer-events-none" />
            </>
          )}

          {/* Outer ring */}
          <div
            className={`w-56 h-56 md:w-64 md:h-64 rounded-full p-3.5 flex items-center justify-center border transition-all duration-300 ${
              isTransmitting
                ? 'bg-rose-950/40 border-rose-500 shadow-2xl shadow-rose-900/50 scale-105'
                : 'shadow-xl'
            }`}
            style={{
              backgroundColor: isTransmitting
                ? isDark ? '#1e1017' : '#fff1f2'
                : colors.pttOuterBg,
              borderColor: isTransmitting ? '#f43f5e' : colors.pttOuterBorder,
            }}
          >
            {/* Main Interactive Button */}
            <button
              onMouseDown={startTransmitting}
              onMouseUp={stopTransmitting}
              onMouseLeave={stopTransmitting}
              onTouchStart={(e) => {
                e.preventDefault();
                startTransmitting();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                stopTransmitting();
              }}
              className={`w-full h-full rounded-full flex flex-col items-center justify-center transition-all duration-150 cursor-pointer outline-none border-2 active:scale-95 ${
                isTransmitting
                  ? 'bg-gradient-to-b from-rose-700 to-rose-900 border-rose-400 text-white shadow-inner'
                  : 'hover:brightness-105 text-slate-300'
              }`}
              style={{
                backgroundColor: isTransmitting ? '#be123c' : colors.pttInnerBg,
                borderColor: isTransmitting ? '#f43f5e' : colors.pttInnerBorder,
              }}
            >
              <Mic
                className={`w-14 h-14 md:w-16 md:h-16 transition-transform duration-200 ${
                  isTransmitting ? 'scale-110 text-white' : 'text-slate-300'
                }`}
              />
              <span className={`text-xs font-bold tracking-widest uppercase mt-2 ${
                isTransmitting ? 'text-white' : 'text-slate-400'
              }`}>
                {isTransmitting ? 'PTT ACTIVO' : 'PRESIONA PTT'}
              </span>
            </button>
          </div>
        </div>

        {/* Network & Encryption status pill */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/50 text-[11px] font-medium text-emerald-400">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>MALLA CIFRADA AES-256</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/40 border border-slate-700/60 text-[11px] text-slate-400">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>RED C5I OPERATIVA</span>
          </div>
        </div>
      </div>

      {/* RECENT VOICE BURSTS LOG */}
      <div
        className="px-5 py-3 border-t max-h-48 overflow-y-auto"
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            ÚLTIMAS TRANSMISIONES DE VOZ ({voiceHistory.length})
          </span>
          <span className="text-[10px] text-slate-400">Canal: {channelTitle}</span>
        </div>

        {voiceHistory.length === 0 ? (
          <div className="text-center py-3 text-xs text-slate-400">
            No hay transmisiones grabadas. Presiona el botón PTT para hablar.
          </div>
        ) : (
          <div className="space-y-1.5">
            {voiceHistory.slice(0, 4).map((burst) => (
              <div
                key={burst.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="p-1 rounded bg-rose-600/20 text-rose-400">
                    <RadioTower className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-white font-mono">
                      {burst.sender_callsign || burst.sender_name || 'OFICIAL'}
                    </span>
                    <span className="text-slate-400 ml-2 text-[11px]">
                      {new Date(burst.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => playVoiceMessage(burst)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 font-semibold text-[11px] transition active:scale-95"
                >
                  <Play className="w-3 h-3 fill-rose-300" />
                  <span>Escuchar</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOS Modal */}
      <SosAlertModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        channelId={selectedChannel?.id}
        channelName={selectedChannel?.name}
      />

      {/* Channel Members Modal */}
      {membersModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">
                  Miembros en Frecuencia ({channelMembers.length})
                </h3>
              </div>
              <button
                onClick={() => setMembersModalVisible(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {channelMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {m.name} {m.isMe && <span className="text-rose-400 font-mono">(Tú)</span>}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {m.callsign}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>En línea</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-800 text-center">
              <button
                onClick={() => setMembersModalVisible(false)}
                className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PttScreen;
