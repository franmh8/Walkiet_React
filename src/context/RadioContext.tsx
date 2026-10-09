import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Channel, VoiceMessage, Contact } from '../types';
import { AudioService } from '../services/audioService';
import { useAuth } from './AuthContext';

interface RadioContextType {
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
}

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

  const loadNetworkChannels = async (): Promise<Channel[]> => {
    try {
      const stored = await AsyncStorage.getItem('c5i_network_channels');
      if (stored) {
        const parsed = JSON.parse(stored);
        setAvailableNetworkChannels(parsed);
        return parsed;
      } else {
        setAvailableNetworkChannels([]);
        return [];
      }
    } catch {
      setAvailableNetworkChannels([]);
      return [];
    }
  };

  const refreshNetworkChannels = async () => {
    await loadNetworkChannels();
  };

  // Cargar canales e historial sincronizados desde AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        await AudioService.init();
        await loadNetworkChannels();

        const storedChannels = await AsyncStorage.getItem('c5i_channels');
        if (storedChannels) {
          const parsed = JSON.parse(storedChannels);
          setChannels(parsed);
          if (parsed.length > 0) setSelectedChannel(parsed[0]);
        } else {
          // Inicializa limpio y vacío
          setChannels([]);
          setSelectedChannel(null);
        }

        const storedHistory = await AsyncStorage.getItem('c5i_voice_history');
        if (storedHistory) {
          setVoiceHistory(JSON.parse(storedHistory));
        } else {
          setVoiceHistory([]);
        }
      } catch (err) {
        console.warn('Error cargando datos de radio:', err);
      }
    })();
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
    await AsyncStorage.setItem('c5i_channels', JSON.stringify(updated));

    // Also register in available network channels
    try {
      const netChannels = await loadNetworkChannels();
      const updatedNet = [newChan, ...netChannels.filter((c) => c.id !== newChan.id)];
      setAvailableNetworkChannels(updatedNet);
      await AsyncStorage.setItem('c5i_network_channels', JSON.stringify(updatedNet));
    } catch (e) {
      console.warn('Error actualizando canales de red:', e);
    }

    return newChan;
  };

  const joinChannel = async (
    channelId: string,
    pin?: string
  ): Promise<{ success: boolean; message?: string; channel?: Channel }> => {
    const netChannels = availableNetworkChannels.length > 0
      ? availableNetworkChannels
      : await loadNetworkChannels();

    const target = netChannels.find((c) => c.id === channelId);
    if (!target) {
      return { success: false, message: 'Canal no encontrado en la red táctica.' };
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

    // Check if already in channels
    if (!channels.some((c) => c.id === target.id)) {
      const updatedTarget: Channel = {
        ...target,
        member_count: (target.member_count || 1) + 1,
        role: isUserAdmin ? 'admin' : 'usuario',
      };
      const updatedChannels = [...channels, updatedTarget];
      setChannels(updatedChannels);
      setSelectedChannel(updatedTarget);
      await AsyncStorage.setItem('c5i_channels', JSON.stringify(updatedChannels));
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
      : await loadNetworkChannels();

    // Match by access_code or id
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
    await AsyncStorage.setItem('c5i_channels', JSON.stringify(updated));
  };

  const leaveChannel = async (channelId: string): Promise<void> => {
    const updated = channels.filter((c) => c.id !== channelId);
    setChannels(updated);
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(updated.length > 0 ? updated[0] : null);
    }
    await AsyncStorage.setItem('c5i_channels', JSON.stringify(updated));
  };

  const clearHistory = async () => {
    setVoiceHistory([]);
    await AsyncStorage.removeItem('c5i_voice_history');
  };

  const startTransmitting = async () => {
    setIsTransmitting(true);
    setTransmittingUser(user?.callsign || 'Tú (Transmitiendo)');
    await AudioService.startRecording();
  };

  const stopTransmitting = async () => {
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
      await AsyncStorage.setItem('c5i_voice_history', JSON.stringify(updatedHistory));
    }
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
      }}
    >
      {children}
    </RadioContext.Provider>
  );
};

export const useRadio = () => useContext(RadioContext);
