import type {ReplyPreview, SendContext} from '../native/chat/actions/messageTypes';
import type { MessageStatus } from '../native/chat/MessageReceipt';
import { peerId } from './peerIds';
import { chatInstant, type ChatDateFields } from '../native/chat/chatDates';
// Chat persistente por cuenta. La base de datos del servidor es la fuente de verdad.
// No guardar mensajes ni adjuntos de otros usuarios en una clave local compartida.
export interface ChatThreadDto {
  id: string;
  type: 'direct' | 'group';
  name: string;
  targetUserId?: string | null;
  callsign?: string | null;
  unit?: string | null;
  participantCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageAt?: string | null;
  hasMessages?: boolean;
  lastMessageStatus?: MessageStatus | null;
}

export interface ChatMessageDto extends ChatDateFields {
  id: string;
  sender_id: string;
  thread_id?: string;
  status?: MessageStatus;
  sender_name: string;
  sender_callsign?: string;
  text: string;
  timestamp: string;
  sentAt?: string | null;
  mediaType?: 'text' | 'image' | 'voice' | 'location' | 'document';
  mediaUrl?: string | null;
  fileName?: string | null;
  reply?: ReplyPreview | null;
  deleted?: boolean;
  editedAt?: string | null;
  forwarded?: boolean;
}

export class ChatApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export function createChatSyncApi(baseUrl: string, token: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const endpoint = `${base}/chat-sync.php`;
  // Compatibilidad con el PHP original de este despliegue: created_at es
  // hora de París sin zona. El contrato nuevo sent_at/metadata tiene prioridad.
  let supportsReceipts = false;
  let supportsIdempotentSend = false;
  let supportsMessageActions = false;
  let legacyZone: string | undefined;
  // Por instancia autenticada: no compartir adjuntos entre cuentas/servidores.
  const mediaCache = new Map<string, string>();
  let cachedChars = 0;
  const rememberMedia = (id: string, url: string) => {
    cachedChars -= mediaCache.get(id)?.length || 0;
    mediaCache.delete(id); mediaCache.set(id,url); cachedChars += url.length;
    while(mediaCache.size>100 || cachedChars>8000000) {
      const oldest=mediaCache.keys().next().value!;
      cachedChars-=mediaCache.get(oldest)!.length; mediaCache.delete(oldest);
    }
  };
  try { if (new URL(base).hostname === 'walkiet.alwaysdata.net') legacyZone = 'Europe/Paris'; } catch {}
  async function request<T>(action: string, fields: Record<string, unknown> = {}, method: 'GET' | 'POST' = 'GET'): Promise<T> {
    let server: URL;
    try { server = new URL(base); } catch { throw new Error('Configura una dirección válida para el servidor de chat.'); }
    const local = /^(localhost|127\.0\.0\.1|10\.[\d.]+|192\.168\.[\d.]+|172\.(1[6-9]|2\d|3[01])\.[\d.]+)$/.test(server.hostname);
    if (server.username || server.password || server.search || server.hash || server.protocol !== 'https:' && !(server.protocol === 'http:' && local)) throw new Error('El chat requiere HTTPS. HTTP solo está permitido en la red local.');
    if (!token) throw new Error('Inicia sesión nuevamente para sincronizar tus chats.');
    const params = new URLSearchParams({ action });
    const body = method === 'POST' ? JSON.stringify({ ...fields, action }) : undefined;
    if (method === 'GET') {
      for (const [key, value] of Object.entries(fields)) params.set(key, String(value));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), action === 'send' ? 30000 : 12000);
    try {
      const response = await fetcher(endpoint + (method === 'GET' ? `?${params}` : ''), {
        method,
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(method === 'POST' ? { 'Content-Type': 'text/plain;charset=UTF-8' } : {}),
        },
        ...(body ? { body } : {}),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        if (response.status === 404) throw new ChatApiError('Falta subir chat-sync.php al servidor Alwaysdata.',404);
        if (response.status === 401) throw new ChatApiError('Tu sesión venció. Cierra sesión y vuelve a entrar.',401);
        throw new ChatApiError(data?.message || `No se pudo sincronizar el chat (HTTP ${response.status}).`,response.status);
      }
      return data as T;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new ChatApiError('El servidor tardó demasiado. Revisa la conexión antes de reintentar.',0);
      if (error instanceof TypeError) throw new ChatApiError('No fue posible contactar el servidor de chats.',0);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  const messages = (data: any, known = mediaCache): ChatMessageDto[] => {
    if (!Array.isArray(data.messages)) throw new Error('El servidor devolvió mensajes inválidos.');
    return data.messages.map((message: any) => {
      const id=peerId(message?.id), sender=peerId(message?.sender_id);
      if(!id||!sender)throw new Error('El servidor devolvió un mensaje inválido.');
      const status = ['sent','delivered','read'].includes(message.status) ? message.status : 'sent';
      const mediaUrl = message.deleted ? null : message.media_unchanged ? known.get(id) : message.mediaUrl;
      if(message.deleted){cachedChars-=mediaCache.get(id)?.length||0;mediaCache.delete(id);}
      if(!message.deleted && message.media_unchanged && !mediaUrl)throw new Error('No se pudo recuperar el archivo del mensaje.');
      if(typeof mediaUrl==='string' && mediaUrl && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
        rememberMedia(id,mediaUrl);
      }
      return {...message,mediaUrl,id,sender_id:sender,status,sentAt:chatInstant(message,data.time_zone||data.timezone||data.server_timezone||legacyZone)};
    });
  };
  return {
    get supportsMessageActions() { return supportsMessageActions; },
    async requireMessageActions() {if(!supportsMessageActions)await this.listThreads();if(!supportsMessageActions)throw new ChatApiError('Actualiza el servicio de chats para usar las opciones de mensajes.',503);},
    async editMessage(threadId: string, id: string, text: string): Promise<{id:string;editedAt?:string}> {await this.requireMessageActions();return request('edit',{thread_id:threadId,message_id:id,text},'POST');},
    async deleteMessage(threadId: string, id: string, scope: 'me'|'everyone'): Promise<{id:string}> {await this.requireMessageActions();return request('delete',{thread_id:threadId,message_id:id,scope},'POST');},
    get supportsReceipts() { return supportsReceipts; },
    get supportsIdempotentSend() { return supportsIdempotentSend; },
    async inbox(): Promise<ChatMessageDto[]> {
      const known=new Map(mediaCache);
      return messages(await request('inbox',known.size?{known_media:[...known.keys()].join(',')}:{}),known);
    },
    acknowledge(threadId: string, ids: string[], read=false): Promise<{read_recorded:boolean}> {
      return request('receipts',{thread_id:threadId,message_ids:ids,read},'POST');
    },
    async listThreads(): Promise<ChatThreadDto[]> {
      const data = await request<{ threads: ChatThreadDto[] }>('threads');
      supportsReceipts=Array.isArray((data as any).features)&&(data as any).features.includes('receipts');
      supportsMessageActions=Array.isArray((data as any).features)&&(data as any).features.includes('messageActions');
      supportsIdempotentSend=Array.isArray((data as any).features)&&(data as any).features.includes('idempotentSend');
      if (!Array.isArray(data.threads)) throw new Error('El servidor devolvió una lista de chats inválida.');
      return data.threads.map((thread: any) => {
        const id = peerId(thread?.id); if (!id || !['direct','group'].includes(thread.type)) throw new Error('El servidor devolvió una conversación inválida.');
        return { ...thread, id, targetUserId: peerId(thread.targetUserId),
          // Compatibilidad con el PHP anterior: un adjunto sin texto también
          // tiene fecha/hora. No usar el guion de presentación como prueba.
          hasMessages: typeof thread.hasMessages === 'boolean' ? thread.hasMessages : Boolean(thread.lastMessageAt || thread.last_message_at || thread.lastMessageTime || thread.lastMessage),
          lastMessageAt: chatInstant({ sentAt: thread.lastMessageAt, created_at: thread.last_message_at, timestamp: thread.lastMessageTime, time_zone: thread.time_zone }, (data as any).time_zone || (data as any).timezone || legacyZone) };
      });
    },
    async listMessages(threadId: string): Promise<ChatMessageDto[]> {
      const known=new Map(mediaCache);
      const data = await request<{ messages: ChatMessageDto[] }>('messages', { thread_id: threadId, ...(known.size?{known_media:[...known.keys()].join(',')}:{}) });
      return messages(data,known);
    },
    async startDirect(targetUserId: string): Promise<string> {
      const data = await request<{ thread_id: string }>('direct', { target_user_id: targetUserId }, 'POST');
      const id = peerId(data.thread_id); if (!id) throw new Error('El servidor no confirmó la conversación.'); return id;
    },
    async createGroup(name: string, memberIds: string[]): Promise<string> {
      const data = await request<{ thread_id: string }>('group', { name, member_ids: memberIds }, 'POST');
      const id = peerId(data.thread_id); if (!id) throw new Error('El servidor no confirmó la conversación.'); return id;
    },
    async sendMessage(threadId: string, mediaType: string, text: string, mediaUrl?: string, fileName?: string, clientId?: string, context: SendContext = {}): Promise<{ id: string; timestamp: string; sentAt: string | null; status?: MessageStatus; deleted?: boolean; editedAt?: string | null; text?: string; reply?: ReplyPreview | null; forwarded?: boolean }> {
      if(context.replyToId||context.sourceMessageId)await this.requireMessageActions();
      const data = await request<{ id: string; timestamp: string; deleted?: boolean } & ChatDateFields>('send', {
        thread_id: threadId, ...(context.sourceMessageId?{source_message_id:context.sourceMessageId}:{mediaType, text, mediaUrl: mediaUrl ?? null, fileName: fileName ?? null}), ...(context.replyToId?{reply_to_id:context.replyToId}:{}), ...(clientId ? {client_message_id:clientId} : {}),
      }, 'POST');
      const id = peerId(data.id); if (!id) throw new Error('El servidor no confirmó el mensaje.');
      if(!data.deleted){const file=mediaUrl||(context.sourceMessageId?mediaCache.get(context.sourceMessageId):undefined);if(file)rememberMedia(id,file);}else{cachedChars-=mediaCache.get(id)?.length||0;mediaCache.delete(id);}
      return { ...data, id, sentAt: chatInstant(data) };
    },
  };
}
