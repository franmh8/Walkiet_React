import React, { createContext, useContext, useState, useEffect } from 'react';
import { Channel, VoiceMessage, Contact } from '../types';
import { AudioService } from '../services/audioService';
import { ApiService } from '../services/apiService';
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

  // Load channels and voice bursts from the database
  const loadDatabaseData = async () => {
    try {
      // 1. Fetch channels from backend
      const remoteChannels = await ApiService.getChannels();
      if (remoteChannels && remoteChannels.length > 0) {
        setChannels(remoteChannels);
        setAvailableNetworkChannels(remoteChannels);
        setSelectedChannel((prev) => prev ? remoteChannels.find((c: Channel) => c.id === prev.id) || remoteChannels[0] : remoteChannels[0]);
        localStorage.setItem('c5i_channels', JSON.stringify(remoteChannels));
      }

      // 2. Fetch voice messages from backend
      const remoteVoice = await ApiService.getVoiceMessages(selectedChannel?.id);
      if (remoteVoice && remoteVoice.length > 0) {
        setVoiceHistory(remoteVoice);
      }
    } catch (err) {
      console.warn('Error fetching radio data from backend:', err);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, [user]);

  // Re-fetch voice messages when selected channel changes
  useEffect(() => {
    if (selectedChannel?.id) {
      ApiService.getVoiceMessages(selectedChannel.id).then((msgs) => {
        if (msgs && msgs.length > 0) {
          setVoiceHistory(msgs);
        }
      });
    }
  }, [selectedChannel?.id]);

  const refreshNetworkChannels = async () => {
    await loadDatabaseData();
  };

  const createChannel = async (
    name: string,
    isPrivate = false,
    category = 'tactico',
    accessCode?: string
  ): Promise<Channel> => {
    const generatedPin = accessCode?.trim() || String(Math.floor(1000 + Math.random() * 9000));

    try {
      const res = await ApiService.createChannel({
        name: name.trim().toUpperCase(),
        is_private: isPrivate,
        access_code: generatedPin,
        created_by: user?.id || 'usr-c5i-01',
        category,
      });

      if (res && res.success && res.channel) {
        const updated = [res.channel, ...channels];
        setChannels(updated);
        setSelectedChannel(res.channel);
        return res.channel;
      }
    } catch (_) {}

    // Fallback in-memory
    const newChan: Channel = {
      id: `chan-${Date.now()}`,
      name: name.trim().toUpperCase(),
      is_private: isPrivate,
      access_code: generatedPin,
      category,
      member_count: 1,
      active_transmitters_count: 0,
      is_encrypted: true,
      created_by: user?.id || 'usr-c5i-01',
      admin_id: user?.id || 'usr-c5i-01',
      admin_name: user?.name || user?.callsign || 'Administrador',
      role: 'admin',
      created_at: new Date().toISOString(),
    };

    const updated = [newChan, ...channels];
    setChannels(updated);
    setSelectedChannel(newChan);
    return newChan;
  };

  const joinChannel = async (
    channelId: string,
    pin?: string
  ): Promise<{ success: boolean; message?: string; channel?: Channel }> => {
    try {
      const res = await ApiService.joinChannel(channelId, user?.id || 'usr-c5i-01', pin);
      if (res && res.success && res.channel) {
        setSelectedChannel(res.channel);
        await loadDatabaseData();
        return { success: true, channel: res.channel };
      } else if (res && !res.success) {
        return { success: false, message: res.message || 'Código PIN incorrecto' };
      }
    } catch (_) {}

    const target = availableNetworkChannels.find((c) => c.id === channelId);
    if (!target) return { success: false, message: 'Canal no encontrado' };

    setSelectedChannel(target);
    return { success: true, channel: target };
  };

  const joinChannelByCode = async (
    code: string
  ): Promise<{ success: boolean; message?: string; channel?: Channel }> => {
    const clean = code.trim();
    if (!clean) return { success: false, message: 'Ingresa un código válido' };

    const found = availableNetworkChannels.find(
      (c) =>
        (c.access_code && c.access_code.trim() === clean) ||
        c.id.toLowerCase() === clean.toLowerCase()
    );

    if (!found) {
      return { success: false, message: 'No se encontró canal activo con ese código PIN' };
    }

    return await joinChannel(found.id, clean);
  };

  const deleteChannel = async (channelId: string): Promise<void> => {
    try {
      await ApiService.deleteChannel(channelId);
    } catch (_) {}

    const updated = channels.filter((c) => c.id !== channelId);
    setChannels(updated);
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(updated.length > 0 ? updated[0] : null);
    }
  };

  const leaveChannel = async (channelId: string): Promise<void> => {
    await deleteChannel(channelId);
  };

  const clearHistory = async () => {
    setVoiceHistory([]);
  };

  const startTransmitting = async () => {
    if (isTransmitting) return;
    setIsTransmitting(true);
    setTransmittingUser(user?.callsign || 'TÚ (TRANSMITIENDO)');

    if (user?.id) {
      ApiService.updateUserStatus(user.id, 'transmitting').catch(() => {});
    }

    await AudioService.startRecording();
  };

  const stopTransmitting = async () => {
    if (!isTransmitting) return;
    setIsTransmitting(false);
    setTransmittingUser(null);

    if (user?.id) {
      ApiService.updateUserStatus(user.id, 'online').catch(() => {});
    }

    const audioUri = await AudioService.stopRecording();

    if (audioUri && user) {
      const newBurstPayload = {
        sender_id: user.id,
        channel_id: selectedChannel?.id || null,
        receiver_id: selectedContact?.id || null,
        audio_url: audioUri,
        duration_seconds: 2,
        is_emergency: false,
      };

      try {
        const res = await ApiService.transmitVoiceMessage(newBurstPayload);
        if (res && res.success && res.voice_message) {
          setVoiceHistory((prev) => [res.voice_message, ...prev].slice(0, 50));
          return;
        }
      } catch (_) {}

      // Fallback local addition
      const localBurst: VoiceMessage = {
        id: `burst-${Date.now()}`,
        sender_id: user.id,
        sender_name: user.name,
        sender_callsign: user.callsign || 'OPERATIVO',
        channel_id: selectedChannel?.id || null,
        audio_url: audioUri,
        duration_seconds: 2,
        created_at: new Date().toISOString(),
      };
      setVoiceHistory((prev) => [localBurst, ...prev].slice(0, 50));
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
