import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useRadio } from '../context/RadioContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { NetworkStatusPill } from './NetworkStatusPill';
import { ChannelMembersModal } from './ChannelMembersModal';
import { soundEngine } from '../services/soundEngine';

interface RadioMainScreenProps {
  onOpenChannels: () => void;
  onOpenContacts: () => void;
  onOpenChat: () => void;
  onOpenProfile: () => void;
  onOpenSosModal: () => void;
}

export const RadioMainScreen: React.FC<RadioMainScreenProps> = ({
  onOpenChannels,
  onOpenContacts,
  onOpenChat,
  onOpenProfile,
  onOpenSosModal,
}) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const {
    mode,
    channels,
    contacts,
    activeChannel,
    activeContact,
    isTransmitting,
    isReceiving,
    receivingSender,
    startTransmission,
    stopTransmission,
    transmissionDuration,
  } = useRadio();

  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const isMouseDownRef = useRef(false);

  // Play tactical sounds when transmission starts/stops
  const handleStartTx = () => {
    if (isReceiving) return;
    soundEngine.playPttStart();
    startTransmission();
  };

  const handleStopTx = () => {
    if (isTransmitting) {
      soundEngine.playRogerBeep();
      stopTransmission();
    }
  };

  // Keyboard Spacebar for Push To Talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        if (settings.pttMode === 'toggle') {
          if (isTransmitting) {
            handleStopTx();
          } else if (!isReceiving) {
            handleStartTx();
          }
        } else {
          if (!isTransmitting && !isReceiving) {
            handleStartTx();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        if (settings.pttMode === 'hold' && isTransmitting) {
          handleStopTx();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isTransmitting, isReceiving, settings.pttMode]);

  const handlePttClick = () => {
    if (settings.pttMode === 'toggle') {
      if (isTransmitting) {
        handleStopTx();
      } else if (!isReceiving) {
        handleStartTx();
      }
    }
  };

  const handlePttMouseDown = () => {
    if (settings.pttMode === 'hold') {
      if (isReceiving) return;
      isMouseDownRef.current = true;
      handleStartTx();
    }
  };

  const handlePttMouseUp = () => {
    if (settings.pttMode === 'hold') {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        handleStopTx();
      }
    }
  };

  const handleSosClick = () => {
    soundEngine.playEmergencyAlert();
    onOpenSosModal();
  };

  const channelTitle =
    mode === 'channel'
      ? activeChannel?.name || (channels.length === 0 ? 'Sin canales (Toca para crear)' : 'Selecciona un canal')
      : activeContact?.alias || activeContact?.contact_user?.name || 'Contacto Directo';

  const memberCount = mode === 'channel' ? activeChannel?.member_count || (channels.length === 0 ? 0 : 1) : 1;

  return (
    <div className="flex-1 flex flex-col justify-between bg-slate-50 dark:bg-[#070c16] text-slate-800 dark:text-slate-100 h-full min-h-0 select-none relative overflow-hidden transition-colors duration-200">
      {/* TOP BAR: CANAL ACTUAL, SOS ICON & MEMBER BADGE (Matching Image 4) */}
      <div className="w-full px-6 pt-6 sm:px-10 sm:pt-8 flex items-start justify-between z-10 gap-3 shrink-0">
        <div
          onClick={onOpenChannels}
          className="cursor-pointer group text-left flex-1 min-w-0"
          title="Cambiar canal o grupo"
        >
          <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase font-mono block">
            CANAL ACTUAL
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5 group-hover:text-[#8a1a36] dark:group-hover:text-[#eb527c] transition-colors truncate">
            {channelTitle}
          </h1>
        </div>

        {/* Action Pills: SOS Emergency (Icon-Only matching Image 4) and Member Count */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Emergency Call / SOS Button (ICON-ONLY rounded square matching Image 4) */}
          <button
            id="btn-header-sos"
            type="button"
            onClick={handleSosClick}
            className="w-10 h-10 rounded-2xl bg-[#e11d48] text-white flex items-center justify-center shadow-lg shadow-rose-600/35 hover:bg-rose-700 active:scale-95 transition-all cursor-pointer"
            title="Llamada de Emergencia / Transmitir Alerta SOS"
          >
            <AlertTriangle className="w-5 h-5 text-white fill-white/20" />
          </button>

          {/* Member count pill */}
          <button
            id="btn-header-members"
            type="button"
            onClick={() => setIsMembersModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:border-[#8a1a36] hover:text-[#8a1a36] dark:hover:border-[#eb527c] dark:hover:text-[#eb527c] transition-all cursor-pointer shadow-xs active:scale-95"
            title="Ver usuarios dentro del canal"
          >
            <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="font-mono">{memberCount}</span>
          </button>
        </div>
      </div>

      {/* CENTER AREA: STATUS, PTT BUTTON & CONNECTED PILL (Matching Image 4) */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto px-4 z-10">
        {/* Status prompt */}
        <div className="mb-8 flex items-center justify-center text-center px-2">
          {isTransmitting ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-semibold text-rose-600 dark:text-rose-400 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50 shrink-0" />
              <span>
                Transmitiendo ({transmissionDuration.toString().padStart(2, '0')}s)...
              </span>
            </div>
          ) : isReceiving ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-semibold text-amber-600 dark:text-amber-300 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
              <span>
                {receivingSender
                  ? `Recibiendo de [${receivingSender.callsign || receivingSender.name}]`
                  : 'Recibiendo audio...'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40 shrink-0" />
              <span>
                {settings.pttMode === 'toggle'
                  ? 'Toca el micrófono para hablar (Manos libres)'
                  : 'Mantén presionado para hablar'}
              </span>
            </div>
          )}
        </div>

        {/* PTT Concentric Circle Button with Soundwave Ripple Animations */}
        <div className="relative flex items-center justify-center">
          {/* Animated concentric soundwave ripple rings during transmission */}
          {isTransmitting && (
            <>
              <div className="absolute w-72 h-72 sm:w-84 sm:h-84 rounded-full bg-rose-500/15 animate-ping pointer-events-none" />
              <div className="absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full border border-rose-500/20 animate-pulse pointer-events-none" />
            </>
          )}

          {isReceiving && (
            <div className="absolute w-72 h-72 rounded-full bg-amber-500/20 blur-md pointer-events-none animate-pulse" />
          )}

          {/* Outer Ring */}
          <div
            className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full border flex items-center justify-center transition-all duration-200 shadow-xl dark:shadow-2xl ${
              isTransmitting
                ? 'bg-rose-50 dark:bg-[#1e1017] border-rose-500/40 shadow-rose-950/40 ring-4 ring-rose-500/20'
                : isReceiving
                ? 'bg-amber-50 dark:bg-[#1c1810] border-amber-500/40'
                : 'bg-white/80 dark:bg-[#111927] border-slate-200/90 dark:border-slate-800 shadow-slate-200/60 dark:shadow-black/60'
            }`}
          >
            {/* Inner PTT Button */}
            <button
              id="btn-ptt-main"
              type="button"
              onClick={handlePttClick}
              onMouseDown={handlePttMouseDown}
              onMouseUp={handlePttMouseUp}
              onTouchStart={(e) => {
                if (settings.pttMode === 'hold') {
                  e.preventDefault();
                  handlePttMouseDown();
                }
              }}
              onTouchEnd={(e) => {
                if (settings.pttMode === 'hold') {
                  e.preventDefault();
                  handlePttMouseUp();
                }
              }}
              disabled={isReceiving}
              className={`w-40 h-40 sm:w-44 sm:h-44 rounded-full border flex items-center justify-center transition-all duration-150 relative cursor-pointer shadow-inner active:scale-95 select-none ${
                isTransmitting
                  ? 'bg-gradient-to-b from-rose-600 to-rose-800 dark:from-rose-700 dark:to-rose-900 border-rose-400 text-white shadow-rose-950/80 scale-95'
                  : isReceiving
                  ? 'bg-slate-200 dark:bg-slate-800/90 border-amber-500/50 text-amber-600 dark:text-amber-300 opacity-80 cursor-not-allowed'
                  : 'bg-[#f1f5f9] dark:bg-[#15233a] border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-[#8a1a36] dark:hover:text-[#eb527c] shadow-sm'
              }`}
              title="Presiona y mantén presionado para hablar"
            >
              <Mic
                className={`w-12 h-12 sm:w-14 sm:h-14 transition-transform ${
                  isTransmitting
                    ? 'text-white scale-110'
                    : isReceiving
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
                strokeWidth={1.8}
              />
            </button>
          </div>
        </div>

        {/* Connected Dynamic Status Pill */}
        <div className="mt-10">
          <NetworkStatusPill />
        </div>
      </div>

      {/* Floating Channel Members Window */}
      <ChannelMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        channel={activeChannel}
        currentUser={user}
        contacts={contacts}
        onOpenChannels={onOpenChannels}
        onOpenContacts={onOpenContacts}
      />
    </div>
  );
};

export default RadioMainScreen;
