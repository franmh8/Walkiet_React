import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../types';
import { useAuth } from './AuthContext';

interface ChatContextType {
  messages: ChatMessage[];
  sendMessage: (text: string, channelId?: string) => Promise<void>;
  clearMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType>({} as any);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('c5i_chat_messages');
        if (stored) {
          setMessages(JSON.parse(stored));
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.warn('Error leyendo mensajes de chat:', err);
      }
    })();
  }, [user]);

  const sendMessage = async (text: string, channelId?: string) => {
    if (!text.trim() || !user) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender_id: user.id,
      sender_name: user.name,
      sender_callsign: user.callsign,
      text: text.trim(),
      type: 'text',
      created_at: new Date().toISOString(),
      channel_id: channelId || null,
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    await AsyncStorage.setItem('c5i_chat_messages', JSON.stringify(updated));
  };

  const clearMessages = async () => {
    setMessages([]);
    await AsyncStorage.removeItem('c5i_chat_messages');
  };

  return (
    <ChatContext.Provider value={{ messages, sendMessage, clearMessages }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
