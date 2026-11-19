/**
 * Walkiet Chat Controller
 * Estado, conversaciones, sincronización MySQL y envío de mensajes.
 * La pantalla principal conserva únicamente navegación e integración de adjuntos.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { serverMessageId } from './chatMessageId';
import { useChatOutbox } from './useChatOutbox';
import {chatForeground} from './useChatOutbox';
import {startChatPolling} from './chatPoller';
import {watchChatWake} from './chatWake';
import type {ChatPhoto} from './photos/photoTypes';
import type { OutboxEntry } from './chatOutbox';
import { chatTime } from './chatDates';
import type { AlertButton } from 'react-native';
import { ChatApiError, createChatSyncApi, type ChatThreadDto, type ChatMessageDto } from '../../services/chatSyncApi';
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
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  playMessageSound: () => void;
  onPhotoCaptured?: (photo: ChatPhoto) => void;
}

export function useChatController({ serverUrl, currentUser, showAlert, playMessageSound, onPhotoCaptured }: ChatControllerOptions) {
  const capturedPhoto = useRef(onPhotoCaptured); capturedPhoto.current = onPhotoCaptured;
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
    lastMessage: t.lastMessage || '', lastMessageTime: chatTime(t.lastMessageAt, t.lastMessageTime || ''),
    unreadCount: 0, hasMessages: t.hasMessages, lastMessageStatus: t.lastMessageStatus || undefined, messages: [],
  }), []);

  const fromServerMessage = useCallback((m: ChatMessageDto): ChatMessage => ({
    id: m.id, senderId: m.sender_id, senderName: m.sender_name || 'Oficial',
    senderCallsign: m.sender_callsign || undefined, text: m.text || '',
    timestamp: chatTime(m.sentAt, m.timestamp), sentAt: m.sentAt || null, isSelf: m.sender_id === currentUser?.id,
    status: m.status || 'sent', mediaType: m.mediaType || 'text',
    mediaUrl: m.mediaUrl || undefined, fileName: m.fileName || undefined,
  }), [currentUser?.id]);

  const outbox=useChatOutbox(serverUrl,currentUser?.id||'',chatApi,(entry,saved)=>{
    const user=currentUser;if(!user)return;
    if(entry.saveImage && entry.mediaUrl) capturedPhoto.current?.({id:saved.id,dataUrl:entry.mediaUrl});
    const message:ChatMessage={id:saved.id,senderId:user.id,senderName:user.name,text:entry.text,
      timestamp:chatTime(saved.sentAt||entry.queuedAt),sentAt:saved.sentAt||entry.queuedAt,isSelf:true,status:saved.status||'sent',
      mediaType:entry.mediaType,mediaUrl:entry.mediaUrl,fileName:entry.fileName};
    const append=(c:Conversation)=>({...c,hasMessages:true,messages:c.messages.some(m=>m.id===message.id)?c.messages:[...c.messages,message],lastMessage:message.text,lastMessageTime:message.timestamp,lastMessageStatus:message.status});
    setActiveConversation(c=>c?.id===entry.threadId?append(c):c);
    setConversations(old=>old.some(c=>c.id===entry.threadId) ? old.map(c=>c.id===entry.threadId?append(c):c) :
      [append({...entry.conversation,lastMessage:'',lastMessageTime:'',unreadCount:0,messages:[]}),...old]);
  });
  const pendingMessages=(threadId:string,known:ChatMessage[]):ChatMessage[]=>outbox.entries.filter(entry=>entry.threadId===threadId&&!known.some(message=>message.id===entry.serverId)).map(entry=>({
    id:'pending-'+entry.clientId,clientId:entry.clientId,senderId:currentUser?.id||'',senderName:currentUser?.name||'',
    text:entry.text,timestamp:chatTime(entry.queuedAt),sentAt:entry.queuedAt,isSelf:true,status:entry.failure?'failed':'pending',
    mediaType:entry.mediaType,mediaUrl:entry.mediaUrl,fileName:entry.fileName,
  }));
  const decorate=(conversation:Conversation):Conversation=>{
    const pending=pendingMessages(conversation.id,conversation.messages);const last=pending[pending.length-1];
    return {...conversation,messages:[...conversation.messages.filter(message=>!message.clientId),...pending],...(last?{lastMessage:last.text,lastMessageTime:last.timestamp,lastMessageStatus:last.status}:{})};
  };
  const allConversations=conversations.map(decorate).filter(conversation=>
    conversation.type==='group'||conversation.hasMessages||conversation.messages.length>0);
  for(const entry of outbox.entries)if(!allConversations.some(c=>c.id===entry.threadId))allConversations.push(decorate({...entry.conversation,lastMessage:'',lastMessageTime:'',unreadCount:0,messages:[]}));
  const displayedActive=activeConversation?decorate(activeConversation):null;

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
          if (found) return { ...fromServerThread(found), messages: prev.messages };
          // Abrir un contacto permite escribir el primer mensaje, pero el chat
          // vacío no pertenece aún a la lista sincronizada de conversaciones.
          return prev.type === 'direct' ? prev : null;
        });
      } catch (error: any) {
        if (!disposed) setChatSyncError(error?.message || 'No se pudieron cargar las conversaciones.');
        return false;
      }
    };
    const poller = startChatPolling(refresh, chatForeground, 3000);
    const unwatch = watchChatWake(poller.wake);
    return () => { disposed = true; poller.stop(); unwatch(); };
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
        const incoming = response.map(fromServerMessage);
        const merge = (c: Conversation): Conversation => {
          const known = new Map(c.messages.map(message => [message.id, message]));
          const messages = incoming.map(message => {
            const sentAt = message.sentAt || known.get(message.id)?.sentAt || null;
            const next={ ...message, sentAt, timestamp: chatTime(sentAt, message.timestamp) };
            const old=known.get(message.id);
            return old && Object.keys(next).every(key=>old[key as keyof ChatMessage]===next[key as keyof ChatMessage]) ? old : next;
          });
          if (messages.every(message => message.sentAt)) messages.sort((left, right) => Date.parse(left.sentAt!) - Date.parse(right.sentAt!));
          const last = messages[messages.length-1];
          if(messages.length===c.messages.length&&messages.every((message,i)=>message===c.messages[i]))return c;
          return { ...c, messages, hasMessages: messages.length>0 || c.hasMessages, ...(last ? { lastMessage: last.text, lastMessageTime: last.timestamp } : {}) };
        };
        setActiveConversation(prev => prev?.id === threadId ? merge(prev) : prev);
        setConversations(prev => prev.map(c => c.id === threadId ? merge(c) : c));
      } catch (error: any) {
        if (!disposed) {
          if (error instanceof ChatApiError && error.status===403) setActiveConversation(prev=>prev?.id===threadId?null:prev);
          setChatSyncError(error?.message || 'No se pudieron actualizar los mensajes.');
        }
        return false;
      }
    };
    const poller = startChatPolling(refresh, chatForeground, 1200);
    const unwatch = watchChatWake(poller.wake);
    return () => { disposed = true; poller.stop(); unwatch(); };
  }, [chatApi, activeConversation?.id, fromServerMessage]);

  const filteredConversations = useMemo(() => allConversations.filter(c => {
    if (selectedChatFilter === 'Grupos' && c.type !== 'group') return false;
    if (selectedChatFilter === 'Directos' && c.type !== 'direct') return false;
    const q = chatSearchQuery.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) ||
      Boolean(c.callsign?.toLowerCase().includes(q)) || c.lastMessage.toLowerCase().includes(q);
  }), [allConversations, selectedChatFilter, chatSearchQuery]);

  const totalChatCount = allConversations.length;
  const groupsChatCount = allConversations.filter(c => c.type === 'group').length;
  const directChatCount = allConversations.filter(c => c.type === 'direct').length;

  const handleStartDirectChat = async (officer: ContactOfficer): Promise<boolean> => {
    if (!officer.registered_user_id) {
      showAlert('Contacto sin cuenta', 'Este contacto aún no tiene cuenta en la app. Podrás enviarle mensajes cuando se registre.');
      return false;
    }
    if (!chatApi) {
      showAlert('Chat no disponible', 'Inicia sesión para sincronizar conversaciones.');
      return false;
    }
    const scope = chatSessionScopeRef.current;
    try {
      const id = await chatApi.startDirect(officer.registered_user_id);
      if (chatSessionScopeRef.current !== scope) return false;
      const existing = conversations.find(c => c.id === id);
      const conv: Conversation = existing ? { ...existing, name: officer.name, callsign: officer.callsign, unit: officer.unit } : {
        id, type: 'direct', name: officer.name, callsign: officer.callsign,
        unit: officer.unit, targetUserId: officer.registered_user_id,
        lastMessage: '', lastMessageTime: '', unreadCount: 0,
        messages: [],
      };
      setConversations(prev => [conv, ...prev.filter(c => c.id !== id)]);
      setActiveConversation(conv);
      setIsNewChatModalOpen(false);
      return true;
    } catch (error: any) {
      if (chatSessionScopeRef.current !== scope) return false;
      showAlert('No se pudo abrir el chat', error?.message || 'Comprueba la conexión al servidor.');
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
        messages: [],
      };
      setConversations(prev => [group, ...prev.filter(c => c.id !== id)]);
      setActiveConversation(group);
      setIsCreateGroupChatModalOpen(false);
      setIsNewChatModalOpen(false);
      setNewGroupName('');
      setSelectedGroupMembers([]);
    } catch (error: any) {
      if (chatSessionScopeRef.current !== scope) return;
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
    coords?: { latitude: number; longitude: number; address?: string }, saveImage=false
  ): Promise<boolean> => {
    const conv = activeConversation;
    const user = currentUser;
    if (!conv || !user || !chatApi) {
      showAlert('Chat no disponible', 'Inicia sesión antes de enviar mensajes.');
      return false;
    }
    const scope = chatSessionScopeRef.current;
    try {
      const clientId=randomUUID().toLowerCase();
      const serverId=await serverMessageId(user.id,clientId);
      const entry:OutboxEntry={clientId,serverId,threadId:conv.id,
        conversation:{id:conv.id,type:conv.type,name:conv.name,targetUserId:conv.targetUserId},
        mediaType,text:caption,mediaUrl,fileName,saveImage,queuedAt:new Date().toISOString()};
      await outbox.enqueue(entry);
      if(chatSessionScopeRef.current!==scope)return false;
      if(saveImage && mediaUrl) capturedPhoto.current?.({id:serverId,dataUrl:mediaUrl});
      setChatSyncError(null);
      try { playMessageSound(); } catch {}
      return true;
    } catch (error: any) {
      if (chatSessionScopeRef.current !== scope) return false;
      setChatSyncError(error?.message || 'Error guardando el mensaje.');
      showAlert('No se pudo guardar el envío pendiente', error?.message || 'Revisa la conexión y vuelve a intentar.');
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
    conversations:allConversations, setConversations, activeConversation:displayedActive, setActiveConversation,
    chatApi, retryPending:outbox.retry,
    chatSearchQuery, setChatSearchQuery, selectedChatFilter, setSelectedChatFilter,
    chatDraftMessage, setChatDraftMessage,
    isNewChatModalOpen, setIsNewChatModalOpen,
    isCreateGroupChatModalOpen, setIsCreateGroupChatModalOpen,
    newGroupName, setNewGroupName,
    selectedGroupMembers, setSelectedGroupMembers,
    createGroupError, setCreateGroupError,
    chatSyncError:outbox.error||chatSyncError, setChatSyncError,
    filteredConversations, totalChatCount, groupsChatCount, directChatCount,
    handleStartDirectChat, handleCreateGroupChatSubmit, handleContactUpdated,
    sendMediaMessage, handleSendChatMessage, toggleGroupMemberSelection,
  };
}
