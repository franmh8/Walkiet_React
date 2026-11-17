/**
 * Walkiet Chat Controller
 * Estado, conversaciones, sincronización MySQL y envío de mensajes.
 * La pantalla principal conserva únicamente navegación e integración de adjuntos.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { createChatSyncApi, type ChatThreadDto, type ChatMessageDto } from '../../services/chatSyncApi';
import type { DirectoryContact as ContactOfficer } from '../../services/contactsApi';
import type { ChatMessage, Conversation } from '../NativeApp';

interface ChatUser {
  id: string;
  name: string;
  authToken?: string;
  callsign?: string;
  badge?: string;
}
interface ChatControllerOptions {
  serverUrl: string;
  currentUser: ChatUser | null;
  notify: (message: string, type: 'info') => void;
  playMessageSound: () => void;
}

export function useChatController({ serverUrl, currentUser, notify, playMessageSound }: ChatControllerOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedChatFilter, setSelectedChatFilter] = useState<'Todos' | 'Grupos' | 'Directos'>('Todos');
  const [chatDraftMessage, setChatDraftMessage] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isCreateGroupChatModalOpen, setIsCreateGroupChatModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [chatSyncError, setChatSyncError] = useState<string | null>(null);

  const chatApi = useMemo(() => currentUser?.id && currentUser?.authToken
    ? createChatSyncApi(serverUrl, currentUser.authToken)
    : null, [serverUrl, currentUser?.id, currentUser?.authToken]);

  // Evita incorporar mensajes tardíos de una sesión anterior después de cambiar de usuario.
  const chatSessionScopeRef = useRef('');
  chatSessionScopeRef.current = JSON.stringify([serverUrl, currentUser?.id, currentUser?.authToken]);

  const fromServerThread = useCallback((t: ChatThreadDto): Conversation => ({
    id: t.id, type: t.type, name: t.name,
    callsign: t.callsign || undefined, unit: t.unit || undefined,
    targetUserId: t.targetUserId || undefined,
    participantCount: t.participantCount || 0,
    lastMessage: t.lastMessage || '', lastMessageTime: t.lastMessageTime || '',
    isOnline: Boolean(t.isOnline), unreadCount: 0, messages: [],
  }), []);

  const fromServerMessage = useCallback((m: ChatMessageDto): ChatMessage => ({
    id: m.id, senderId: m.sender_id, senderName: m.sender_name || 'Oficial',
    senderCallsign: m.sender_callsign || undefined, text: m.text || '',
    timestamp: m.timestamp || 'Ahora', isSelf: m.sender_id === currentUser?.id,
    status: 'sent', mediaType: m.mediaType || 'text',
    mediaUrl: m.mediaUrl || undefined, fileName: m.fileName || undefined,
  }), [currentUser?.id]);

  // Lista persistente de conversaciones por cuenta; también descubre chats entrantes.
  useEffect(() => {
    let disposed = false;
    if (!currentUser?.id || !chatApi) {
      setConversations([]);
      setActiveConversation(null);
      setChatSyncError(null);
      return;
    }
    setConversations([]);
    setActiveConversation(null);
    const refresh = async () => {
      try {
        const remote = await chatApi.listThreads();
        if (disposed) return;
        setChatSyncError(null);
        setConversations(prev => remote.map(t => {
          const old = prev.find(c => c.id === t.id);
          return { ...fromServerThread(t), messages: old?.messages || [] };
        }));
        setActiveConversation(prev => {
          if (!prev) return prev;
          const found = remote.find(t => t.id === prev.id);
          return found ? { ...fromServerThread(found), messages: prev.messages } : null;
        });
      } catch (error: any) {
        if (!disposed) setChatSyncError(error?.message || 'No se pudieron cargar las conversaciones.');
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 6000);
    return () => { disposed = true; clearInterval(timer); };
  }, [chatApi, currentUser?.id, fromServerThread]);

  // Actualiza el chat abierto también cuando otro dispositivo envía mensajes.
  useEffect(() => {
    if (!chatApi || !activeConversation?.id) return;
    let disposed = false;
    const threadId = activeConversation.id;
    const refresh = async () => {
      try {
        const response = await chatApi.listMessages(threadId);
        if (disposed) return;
        const messages = response.map(fromServerMessage);
        const last = messages[messages.length - 1];
        const merge = (c: Conversation): Conversation => ({
          ...c, messages,
          ...(last ? { lastMessage: last.text, lastMessageTime: last.timestamp } : {}),
        });
        setActiveConversation(prev => prev?.id === threadId ? merge(prev) : prev);
        setConversations(prev => prev.map(c => c.id === threadId ? merge(c) : c));
      } catch (error: any) {
        if (!disposed) setChatSyncError(error?.message || 'No se pudieron actualizar los mensajes.');
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 4000);
    return () => { disposed = true; clearInterval(timer); };
  }, [chatApi, activeConversation?.id, fromServerMessage]);

  const filteredConversations = useMemo(() => conversations.filter(c => {
    if (selectedChatFilter === 'Grupos' && c.type !== 'group') return false;
    if (selectedChatFilter === 'Directos' && c.type !== 'direct') return false;
    const q = chatSearchQuery.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) ||
      Boolean(c.callsign?.toLowerCase().includes(q)) || c.lastMessage.toLowerCase().includes(q);
  }), [conversations, selectedChatFilter, chatSearchQuery]);

  const totalChatCount = conversations.length;
  const groupsChatCount = conversations.filter(c => c.type === 'group').length;
  const directChatCount = conversations.filter(c => c.type === 'direct').length;

  const handleStartDirectChat = async (officer: ContactOfficer): Promise<boolean> => {
    if (!officer.registered_user_id) {
      notify('Este contacto no tiene cuenta registrada en Walkiet.', 'info');
      return false;
    }
    if (!chatApi) {
      Alert.alert('Chat no disponible', 'Inicia sesión para sincronizar conversaciones.');
      return false;
    }
    const scope = chatSessionScopeRef.current;
    try {
      const id = await chatApi.startDirect(officer.registered_user_id);
      if (chatSessionScopeRef.current !== scope) return false;
      const existing = conversations.find(c => c.id === id);
      const conv: Conversation = existing || {
        id, type: 'direct', name: officer.name, callsign: officer.callsign,
        unit: officer.unit, targetUserId: officer.registered_user_id,
        lastMessage: '', lastMessageTime: '', unreadCount: 0,
        isOnline: officer.status === 'online', messages: [],
      };
      setConversations(prev => [conv, ...prev.filter(c => c.id !== id)]);
      setActiveConversation(conv);
      setIsNewChatModalOpen(false);
      return true;
    } catch (error: any) {
      Alert.alert('No se pudo abrir el chat', error?.message || 'Comprueba la conexión al servidor.');
      return false;
    }
  };

  const handleCreateGroupChatSubmit = async (): Promise<void> => {
    const cleanName = newGroupName.trim();
    if (!cleanName) { setCreateGroupError('Ingresa un nombre para el grupo de conversación.'); return; }
    if (!chatApi) { setCreateGroupError('Inicia sesión para guardar tu grupo.'); return; }
    const scope = chatSessionScopeRef.current;
    try {
      setCreateGroupError(null);
      const id = await chatApi.createGroup(cleanName, selectedGroupMembers);
      if (chatSessionScopeRef.current !== scope) return;
      const group: Conversation = {
        id, type: 'group', name: cleanName,
        participantCount: selectedGroupMembers.length + 1,
        lastMessage: '', lastMessageTime: '', unreadCount: 0,
        isOnline: true, messages: [],
      };
      setConversations(prev => [group, ...prev.filter(c => c.id !== id)]);
      setActiveConversation(group);
      setIsCreateGroupChatModalOpen(false);
      setIsNewChatModalOpen(false);
      setNewGroupName('');
      setSelectedGroupMembers([]);
    } catch (error: any) {
      setCreateGroupError(error?.message || 'No se pudo guardar el grupo en MySQL.');
    }
  };

  const handleContactUpdated = (contact: ContactOfficer) => {
    setConversations(prev => prev.map(c => c.type === 'direct' && c.targetUserId === contact.registered_user_id
      ? { ...c, name: contact.name, callsign: contact.callsign } : c));
    setActiveConversation(prev => prev?.type === 'direct' && prev.targetUserId === contact.registered_user_id
      ? { ...prev, name: contact.name, callsign: contact.callsign } : prev);
  };

  const sendMediaMessage = async (
    mediaType: 'text' | 'image' | 'voice' | 'location' | 'document',
    caption: string, mediaUrl?: string, fileName?: string,
    coords?: { latitude: number; longitude: number; address?: string }
  ): Promise<boolean> => {
    const conv = activeConversation;
    const user = currentUser;
    if (!conv || !user || !chatApi) {
      Alert.alert('Chat no disponible', 'Inicia sesión antes de enviar mensajes.');
      return false;
    }
    const scope = chatSessionScopeRef.current;
    try {
      const saved = await chatApi.sendMessage(conv.id, mediaType, caption, mediaUrl, fileName);
      if (chatSessionScopeRef.current !== scope) return true;
      const newMsg: ChatMessage = {
        id: saved.id, senderId: user.id, senderName: user.name,
        senderCallsign: user.callsign || user.badge, text: caption,
        timestamp: saved.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: true, status: 'sent', mediaType, mediaUrl, fileName, locationCoords: coords,
      };
      const append = (c: Conversation): Conversation => ({
        ...c, lastMessage: caption, lastMessageTime: newMsg.timestamp,
        messages: c.messages.some(m => m.id === newMsg.id) ? c.messages : [...c.messages, newMsg],
      });
      setActiveConversation(prev => prev?.id === conv.id ? append(prev) : prev);
      setConversations(prev => prev.map(c => c.id === conv.id ? append(c) : c));
      setChatSyncError(null);
      try { playMessageSound(); } catch {}
      return true;
    } catch (error: any) {
      setChatSyncError(error?.message || 'Error guardando el mensaje.');
      Alert.alert('No se guardó el mensaje', error?.message || 'Revisa la conexión y vuelve a intentar.');
      return false;
    }
  };

  const handleSendChatMessage = async (): Promise<void> => {
    if (!chatDraftMessage.trim() || !activeConversation) return;
    const text = chatDraftMessage.trim();
    const saved = await sendMediaMessage('text', text);
    if (saved) setChatDraftMessage(prev => prev.trim() === text ? '' : prev);
  };

  const toggleGroupMemberSelection = (id: string) => setSelectedGroupMembers(prev =>
    prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]);

  return {
    conversations, setConversations, activeConversation, setActiveConversation,
    chatSearchQuery, setChatSearchQuery, selectedChatFilter, setSelectedChatFilter,
    chatDraftMessage, setChatDraftMessage,
    isNewChatModalOpen, setIsNewChatModalOpen,
    isCreateGroupChatModalOpen, setIsCreateGroupChatModalOpen,
    newGroupName, setNewGroupName,
    selectedGroupMembers, setSelectedGroupMembers,
    createGroupError, setCreateGroupError,
    chatSyncError, setChatSyncError,
    filteredConversations, totalChatCount, groupsChatCount, directChatCount,
    handleStartDirectChat, handleCreateGroupChatSubmit, handleContactUpdated,
    sendMediaMessage, handleSendChatMessage, toggleGroupMemberSelection,
  };
}
