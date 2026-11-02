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
            stopTransmission();
          } else if (!isReceiving) {
            startTransmission();
          }
        } else {
          if (!isTransmitting && !isReceiving) {
            startTransmission();
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
          stopTransmission();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isTransmitting, isReceiving, startTransmission, stopTransmission, settings.pttMode]);

  const handlePttClick = () => {
    if (settings.pttMode === 'toggle') {
      if (isTransmitting) {
        stopTransmission();
      } else if (!isReceiving) {
        startTransmission();
      }
    }
  };

  const handlePttMouseDown = () => {
    if (settings.pttMode === 'hold') {
      if (isReceiving) return;
      isMouseDownRef.current = true;
      startTransmission();
    }
  };

  const handlePttMouseUp = () => {
    if (settings.pttMode === 'hold') {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        stopTransmission();
      }
    }
  };

  const channelTitle =
    mode === 'channel'
      ? activeChannel?.name || (channels.length === 0 ? 'Sin canales (Toca para crear)' : 'Selecciona un canal')
      : activeContact?.alias || activeContact?.contact_user?.name || 'Contacto Directo';

  const memberCount = mode === 'channel' ? activeChannel?.member_count || (channels.length === 0 ? 0 : 1) : 1;

  return (
    <div className="flex-1 flex flex-col justify-between bg-slate-50 dark:bg-[#070c16] text-slate-800 dark:text-slate-100 h-full min-h-0 select-none relative overflow-hidden transition-colors duration-200">
      {/* TOP BAR: CANAL ACTUAL, SOS & MEMBER BADGE */}
      <div className="w-full px-5 pt-5 sm:px-10 sm:pt-8 flex items-start justify-between z-10 gap-3 shrink-0">
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

        {/* Action Pills: SOS Emergency and Member Count */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Emergency Call / SOS Button */}
          <button
            id="btn-header-sos"
            type="button"
            onClick={onOpenSosModal}
            className="w-9 h-9 sm:w-auto sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 dark:from-rose-950/90 dark:to-red-900/90 border border-rose-500/60 dark:border-rose-600/60 text-white dark:text-rose-200 text-xs font-bold hover:from-rose-500 hover:to-red-600 dark:hover:bg-rose-900 transition-all cursor-pointer shadow-md dark:shadow-lg shadow-rose-600/20 dark:shadow-rose-950/50 active:scale-95 animate-pulse flex items-center justify-center gap-1.5"
            title="Llamada de Emergencia / Transmitir Alerta SOS"
          >
            <AlertTriangle className="w-4 h-4 text-white dark:text-rose-400 fill-white/20 dark:fill-rose-500/20" />
            <span className="hidden sm:inline">SOS</span>
          </button>

          {/* Member count pill */}
          <button
            id="btn-header-members"
            type="button"
            onClick={() => setIsMembersModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:border-[#8a1a36] hover:text-[#8a1a36] dark:hover:border-[#eb527c] dark:hover:text-[#eb527c] transition-all cursor-pointer shadow-sm active:scale-95"
            title="Ver usuarios dentro del canal"
          >
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>{memberCount}</span>
          </button>
        </div>
      </div>

      {/* CENTER AREA: STATUS, PTT BUTTON & CONNECTED PILL */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto px-4 z-10">
        {/* Status prompt */}
        <div className="mb-6 flex items-center justify-center text-center px-2">
          {isTransmitting ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium text-rose-600 dark:text-rose-400 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50 shrink-0" />
              <span>
                Transmitiendo ({transmissionDuration.toString().padStart(2, '0')}s)...
              </span>
            </div>
          ) : isReceiving ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium text-amber-600 dark:text-amber-300 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
              <span>
                {receivingSender
                  ? `Recibiendo de [${receivingSender.callsign || receivingSender.name}]`
                  : 'Recibiendo audio...'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40 shrink-0" />
              <span>
                {settings.pttMode === 'toggle'
                  ? 'Toca el micrófono para hablar (Manos libres)'
                  : 'Mantén presionado para hablar'}
              </span>
            </div>
          )}
        </div>

        {/* PTT Concentric Circle Button */}
        <div className="relative flex items-center justify-center">
          {/* Animated glow rings during transmission */}
          {isTransmitting && (
            <>
              <div
                className={`absolute -inset-6 rounded-full bg-rose-500/15 pointer-events-none ${
                  settings.reduceAnimations ? '' : 'animate-ping'
                }`}
              />
              <div className="absolute -inset-3 rounded-full bg-rose-500/25 blur-lg pointer-events-none" />
            </>
          )}

          {isReceiving && (
            <div
              className={`absolute -inset-4 rounded-full bg-amber-500/20 blur-lg pointer-events-none ${
                settings.reduceAnimations ? '' : 'animate-pulse'
              }`}
            />
          )}

          {/* Outer Ring */}
          <div
            className={`w-60 h-60 sm:w-72 sm:h-72 rounded-full border flex items-center justify-center transition-all duration-200 shadow-xl dark:shadow-2xl ${
              isTransmitting
                ? 'bg-rose-50 dark:bg-[#1e1017] border-rose-500/40 shadow-rose-950/40 ring-2 ring-rose-500/30'
                : isReceiving
                ? 'bg-amber-50 dark:bg-[#1c1810] border-amber-500/40'
                : 'bg-white/80 dark:bg-[#111927] border-slate-300 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 shadow-slate-300/60 dark:shadow-black/60'
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
              className={`w-40 h-40 sm:w-48 sm:h-48 rounded-full border flex items-center justify-center transition-all duration-150 relative cursor-pointer shadow-inner active:scale-95 select-none ${
                isTransmitting
                  ? 'bg-gradient-to-b from-rose-600 to-rose-800 dark:from-rose-700 dark:to-rose-900 border-rose-400 text-white shadow-rose-950/80 scale-95'
                  : isReceiving
                  ? 'bg-slate-200 dark:bg-slate-800/90 border-amber-500/50 text-amber-600 dark:text-amber-300 opacity-80 cursor-not-allowed'
                  : 'bg-gradient-to-b from-slate-50 to-slate-200 dark:from-[#15233a] dark:to-[#0a1220] border-slate-300 dark:border-slate-600/50 hover:border-[#8a1a36] text-slate-700 dark:text-slate-300 hover:text-[#8a1a36] dark:hover:text-[#eb527c] shadow-md'
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
        <div className="mt-8">
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
