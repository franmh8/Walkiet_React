import React, { createContext, useContext, useState, useEffect } from 'react';
import { Channel, VoiceMessage, Contact } from '../types';
import { AudioService } from '../services/audioService';
import { useAuth } from './AuthContext';

export interface RadioContextType {
  channels: Channel[];
  selectedChannel: Channel | null;
  setSelectedChannel: (channel: Channel | null) => void;
  createChannel: (
    name: string,
    isPrivate?: boolean,
    category?: string,
    accessCode?: string
  ) => Promise<Channel>;
  joinChannel: (
    channelId: string,
    pin?: string
  ) => Promise<{ success: boolean; message?: string; channel?: Channel }>;
  joinChannelByCode: (
    code: string
  ) => Promise<{ success: boolean; message?: string; channel?: Channel }>;
  deleteChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;
  availableNetworkChannels: Channel[];
  refreshNetworkChannels: () => Promise<void>;
  voiceHistory: VoiceMessage[];
  clearHistory: () => Promise<void>;
  isTransmitting: boolean;
  transmittingUser: string | null;
  startTransmitting: () => Promise<void>;
  stopTransmitting: () => Promise<void>;
  selectedContact: Contact | null;
  setSelectedContact: (c: Contact | null) => void;
  playVoiceMessage: (msg: VoiceMessage) => void;
}

const DEFAULT_TACTICAL_CHANNELS: Channel[] = [
  {
    id: 'chan-tactico-01',
    name: 'OPERACIONES ESPECIALES TÁCTICAS',
    is_private: true,
    access_code: '1090',
    category: 'tactico',
    member_count: 8,
    active_transmitters_count: 0,
    is_encrypted: true,
    created_by: 'admin',
    admin_name: 'Mando Táctico C5i',
    role: 'admin',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'chan-emergencia-02',
    name: 'DESPACHO EMERGENCIAS 911',
    is_private: false,
    access_code: '9110',
    category: 'emergencia',
    member_count: 14,
    active_transmitters_count: 0,
    is_encrypted: true,
    created_by: 'admin',
    admin_name: 'Despacho Central 911',
    role: 'usuario',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'chan-monitoreo-03',
    name: 'CENTRAL DE MONITOREO C5I',
    is_private: true,
    access_code: '5001',
    category: 'inteligencia',
    member_count: 6,
    active_transmitters_count: 0,
    is_encrypted: true,
    created_by: 'admin',
    admin_name: 'Inteligencia Operativa',
    role: 'usuario',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'chan-vialidad-04',
    name: 'VIALIDAD Y TRÁNSITO PACHUCA',
    is_private: false,
    access_code: '4400',
    category: 'vialidad',
    member_count: 5,
    active_transmitters_count: 0,
    is_encrypted: true,
    created_by: 'admin',
    admin_name: 'Tránsito Estatal',
    role: 'usuario',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'chan-general-05',
    name: 'FRECUENCIA GENERAL ESTATAL',
    is_private: false,
    access_code: '1234',
    category: 'general',
    member_count: 22,
    active_transmitters_count: 0,
    is_encrypted: true,
    created_by: 'admin',
    admin_name: 'Coordinación C5i',
    role: 'usuario',
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
];

const INITIAL_VOICE_HISTORY: VoiceMessage[] = [
  {
    id: 'burst-init-1',
    sender_id: 'usr-default-02',
    sender_name: 'Oficial Karla Mendoza',
    sender_callsign: 'PATRULLA-04',
    channel_id: 'chan-tactico-01',
    audio_url: 'simulated-burst-1',
    duration_seconds: 3,
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'burst-init-2',
    sender_id: 'usr-default-03',
    sender_name: 'Mando Alfa',
    sender_callsign: 'MANDO-ALFA',
    channel_id: 'chan-tactico-01',
    audio_url: 'simulated-burst-2',
    duration_seconds: 2,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

const RadioContext = createContext<RadioContextType>({} as any);

export const RadioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [availableNetworkChannels, setAvailableNetworkChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [voiceHistory, setVoiceHistory] = useState<VoiceMessage[]>([]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmittingUser, setTransmittingUser] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const loadNetworkChannels = (): Channel[] => {
    try {
      const stored = localStorage.getItem('c5i_network_channels');
      if (stored) {
        const parsed = JSON.parse(stored);
        setAvailableNetworkChannels(parsed);
        return parsed;
      }
    } catch (_) {}
    setAvailableNetworkChannels(DEFAULT_TACTICAL_CHANNELS);
    localStorage.setItem('c5i_network_channels', JSON.stringify(DEFAULT_TACTICAL_CHANNELS));
    return DEFAULT_TACTICAL_CHANNELS;
  };

  const refreshNetworkChannels = async () => {
    loadNetworkChannels();
  };

  useEffect(() => {
    try {
      const netChannels = loadNetworkChannels();

      const storedChannels = localStorage.getItem('c5i_channels');
      if (storedChannels) {
        const parsed: Channel[] = JSON.parse(storedChannels);
        setChannels(parsed);
        if (parsed.length > 0) setSelectedChannel(parsed[0]);
      } else {
        // Default enrolled channels
        setChannels(netChannels);
        setSelectedChannel(netChannels[0]);
        localStorage.setItem('c5i_channels', JSON.stringify(netChannels));
      }

      const storedHistory = localStorage.getItem('c5i_voice_history');
      if (storedHistory) {
        setVoiceHistory(JSON.parse(storedHistory));
      } else {
        setVoiceHistory(INITIAL_VOICE_HISTORY);
        localStorage.setItem('c5i_voice_history', JSON.stringify(INITIAL_VOICE_HISTORY));
      }
    } catch (err) {
      console.warn('Error loading radio data:', err);
    }
  }, [user]);

  const createChannel = async (
    name: string,
    isPrivate = false,
    category = 'tactico',
    accessCode?: string
  ): Promise<Channel> => {
    const generatedPin = accessCode?.trim() || String(Math.floor(1000 + Math.random() * 9000));
    const newChan: Channel = {
      id: `chan-${Date.now()}`,
      name: name.trim().toUpperCase(),
      is_private: isPrivate,
      access_code: generatedPin,
      category,
      member_count: 1,
      active_transmitters_count: 0,
      is_encrypted: true,
      created_by: user?.id || 'admin',
      admin_id: user?.id || 'admin',
      admin_name: user?.name || user?.callsign || 'Administrador',
      role: 'admin',
      created_at: new Date().toISOString(),
    };

    const updated = [...channels, newChan];
    setChannels(updated);
    setSelectedChannel(newChan);
    localStorage.setItem('c5i_channels', JSON.stringify(updated));

    // Update network channels
    try {
      const netChannels = loadNetworkChannels();
      const updatedNet = [newChan, ...netChannels.filter((c) => c.id !== newChan.id)];
      setAvailableNetworkChannels(updatedNet);
      localStorage.setItem('c5i_network_channels', JSON.stringify(updatedNet));
    } catch (e) {
      console.warn('Error updating network channels:', e);
    }

    return newChan;
  };

  const joinChannel = async (
    channelId: string,
    pin?: string
  ): Promise<{ success: boolean; message?: string; channel?: Channel }> => {
    const netChannels = availableNetworkChannels.length > 0
      ? availableNetworkChannels
      : loadNetworkChannels();

    const target = netChannels.find((c) => c.id === channelId);
    if (!target) {
      return { success: false, message: 'Canal no encontrado en la red táctica C5i.' };
    }

    if (target.is_private && target.access_code) {
      if (!pin || pin.trim() !== target.access_code.trim()) {
        return { success: false, message: 'Código PIN o clave táctica incorrecta.' };
      }
    }

    const isUserAdmin = Boolean(
      user?.role === 'admin' ||
      (user?.id && target.created_by === user.id) ||
      (user?.id && target.admin_id === user.id)
    );

    if (!channels.some((c) => c.id === target.id)) {
      const updatedTarget: Channel = {
        ...target,
        member_count: (target.member_count || 1) + 1,
        role: isUserAdmin ? 'admin' : 'usuario',
      };
      const updatedChannels = [...channels, updatedTarget];
      setChannels(updatedChannels);
      setSelectedChannel(updatedTarget);
      localStorage.setItem('c5i_channels', JSON.stringify(updatedChannels));
      return { success: true, channel: updatedTarget };
    }

    setSelectedChannel(target);
    return { success: true, channel: target };
  };

  const joinChannelByCode = async (
    code: string
  ): Promise<{ success: boolean; message?: string; channel?: Channel }> => {
    const clean = code.trim();
    if (!clean || clean.length < 4) {
      return { success: false, message: 'Ingresa un código válido de 4 a 6 dígitos.' };
    }

    const netChannels = availableNetworkChannels.length > 0
      ? availableNetworkChannels
      : loadNetworkChannels();

    const found = netChannels.find(
      (c) =>
        (c.access_code && c.access_code.trim() === clean) ||
        c.id.toLowerCase() === clean.toLowerCase() ||
        c.id.toLowerCase().endsWith(clean.toLowerCase())
    );

    if (!found) {
      return {
        success: false,
        message: 'No se encontró ningún canal activo con el código ingresado.',
      };
    }

    return await joinChannel(found.id, clean);
  };

  const deleteChannel = async (channelId: string): Promise<void> => {
    const updated = channels.filter((c) => c.id !== channelId);
    setChannels(updated);
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(updated.length > 0 ? updated[0] : null);
    }
    localStorage.setItem('c5i_channels', JSON.stringify(updated));
  };

  const leaveChannel = async (channelId: string): Promise<void> => {
    const updated = channels.filter((c) => c.id !== channelId);
    setChannels(updated);
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(updated.length > 0 ? updated[0] : null);
    }
    localStorage.setItem('c5i_channels', JSON.stringify(updated));
  };

  const clearHistory = async () => {
    setVoiceHistory([]);
    localStorage.removeItem('c5i_voice_history');
  };

  const startTransmitting = async () => {
    if (isTransmitting) return;
    setIsTransmitting(true);
    setTransmittingUser(user?.callsign || 'TÚ (TRANSMITIENDO)');
    await AudioService.startRecording();
  };

  const stopTransmitting = async () => {
    if (!isTransmitting) return;
    setIsTransmitting(false);
    setTransmittingUser(null);
    const audioUri = await AudioService.stopRecording();

    if (audioUri && user) {
      const newBurst: VoiceMessage = {
        id: `burst-${Date.now()}`,
        sender_id: user.id,
        sender_name: user.name,
        sender_callsign: user.callsign || 'OPERATIVO',
        channel_id: selectedChannel?.id || null,
        audio_url: audioUri,
        duration_seconds: 2,
        created_at: new Date().toISOString(),
      };
      const updatedHistory = [newBurst, ...voiceHistory].slice(0, 30);
      setVoiceHistory(updatedHistory);
      localStorage.setItem('c5i_voice_history', JSON.stringify(updatedHistory));
    }
  };

  const playVoiceMessage = (msg: VoiceMessage) => {
    AudioService.playAudio(msg.audio_url);
  };

  return (
    <RadioContext.Provider
      value={{
        channels,
        selectedChannel,
        setSelectedChannel,
        createChannel,
        joinChannel,
        joinChannelByCode,
        deleteChannel,
        leaveChannel,
        availableNetworkChannels,
        refreshNetworkChannels,
        voiceHistory,
        clearHistory,
        isTransmitting,
        transmittingUser,
        startTransmitting,
        stopTransmitting,
        selectedContact,
        setSelectedContact,
        playVoiceMessage,
      }}
    >
      {children}
    </RadioContext.Provider>
  );
};

export const useRadio = () => useContext(RadioContext);
