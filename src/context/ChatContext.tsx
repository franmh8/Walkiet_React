import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChatMessage } from '../types';
import { useAuth } from './AuthContext';

interface ChatContextType {
  messages: ChatMessage[];
  sendMessage: (text: string, channelId?: string, type?: 'text' | 'audio' | 'location' | 'emergency') => Promise<void>;
  clearMessages: () => Promise<void>;
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-default-1',
    sender_id: 'usr-default-02',
    sender_name: 'Oficial Karla Mendoza',
    sender_callsign: 'PATRULLA-04',
    text: 'C5i Central, unidad reportando posición en Bulevar Felipe Ángeles. Sector despejado.',
    type: 'text',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    channel_id: 'chan-tactico-01',
  },
  {
    id: 'msg-default-2',
    sender_id: 'usr-central-01',
    sender_name: 'Despacho Central C5i',
    sender_callsign: 'CENTRAL-C5I',
    text: 'Recibido PATRULLA-04. Mantener patrullaje preventivo en cuadrante norte.',
    type: 'text',
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    channel_id: 'chan-tactico-01',
  },
];

const ChatContext = createContext<ChatContextType>({} as any);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('c5i_chat_messages');
      if (stored) {
        setMessages(JSON.parse(stored));
      } else {
        setMessages(DEFAULT_MESSAGES);
        localStorage.setItem('c5i_chat_messages', JSON.stringify(DEFAULT_MESSAGES));
      }
    } catch (err) {
      console.warn('Error reading chat messages:', err);
    }
  }, [user]);

  const sendMessage = async (
    text: string,
    channelId?: string,
    type: 'text' | 'audio' | 'location' | 'emergency' = 'text'
  ) => {
    if (!text.trim() || !user) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender_id: user.id,
      sender_name: user.name,
      sender_callsign: user.callsign,
      text: text.trim(),
      type,
      created_at: new Date().toISOString(),
      channel_id: channelId || null,
    };

    const updated = [...messages, newMsg];
    setMessages(updated);
    localStorage.setItem('c5i_chat_messages', JSON.stringify(updated));

    // Simulated automatic response from C5i dispatch for realism
    if (type === 'emergency' || text.toLowerCase().includes('emergencia') || text.toLowerCase().includes('auxilio')) {
      setTimeout(() => {
        const autoResp: ChatMessage = {
          id: `msg-auto-${Date.now()}`,
          sender_id: 'central-c5i',
          sender_name: 'Despacho Central C5i',
          sender_callsign: 'DESPACHO-911',
          text: `🚨 C5i Alerta recibida de ${user.callsign || user.name}. Unidades de apoyo en ruta hacia coordenadas reportadas.`,
          type: 'emergency',
          created_at: new Date().toISOString(),
          channel_id: channelId || null,
        };
        setMessages((prev) => {
          const withAuto = [...prev, autoResp];
          localStorage.setItem('c5i_chat_messages', JSON.stringify(withAuto));
          return withAuto;
        });
      }, 1500);
    }
  };

  const clearMessages = async () => {
    setMessages([]);
    localStorage.removeItem('c5i_chat_messages');
  };

  return (
    <ChatContext.Provider value={{ messages, sendMessage, clearMessages }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
