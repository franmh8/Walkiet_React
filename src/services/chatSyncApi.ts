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
  isOnline?: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
}

export interface ChatMessageDto {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_callsign?: string;
  text: string;
  timestamp: string;
  mediaType?: 'text' | 'image' | 'voice' | 'location' | 'document';
  mediaUrl?: string | null;
  fileName?: string | null;
}

export function createChatSyncApi(baseUrl: string, token: string) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const endpoint = `${base}/chat-sync.php`;
  async function request<T>(action: string, fields: Record<string, unknown> = {}, method: 'GET' | 'POST' = 'GET'): Promise<T> {
    if (!base || !/^https:\/\//.test(base)) throw new Error('El chat requiere un servidor HTTPS configurado.');
    if (!token) throw new Error('Inicia sesión nuevamente para sincronizar tus chats.');
    const params = new URLSearchParams({ action });
    const body = method === 'POST' ? JSON.stringify({ ...fields, action }) : undefined;
    if (method === 'GET') {
      for (const [key, value] of Object.entries(fields)) params.set(key, String(value));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), action === 'send' ? 30000 : 12000);
    try {
      const response = await fetch(endpoint + (method === 'GET' ? `?${params}` : ''), {
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
        if (response.status === 404) throw new Error('Falta subir chat-sync.php al servidor Alwaysdata.');
        if (response.status === 401) throw new Error('Tu sesión venció. Cierra sesión y vuelve a entrar.');
        throw new Error(data?.message || `No se pudo sincronizar el chat (HTTP ${response.status}).`);
      }
      return data as T;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('El servidor tardó demasiado. Revisa la conexión antes de reintentar.');
      if (error instanceof TypeError) throw new Error('No fue posible contactar el servidor de chats.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    async listThreads(): Promise<ChatThreadDto[]> {
      const data = await request<{ threads: ChatThreadDto[] }>('threads');
      if (!Array.isArray(data.threads)) throw new Error('El servidor devolvió una lista de chats inválida.');
      return data.threads;
    },
    async listMessages(threadId: string): Promise<ChatMessageDto[]> {
      const data = await request<{ messages: ChatMessageDto[] }>('messages', { thread_id: threadId });
      if (!Array.isArray(data.messages)) throw new Error('El servidor devolvió mensajes inválidos.');
      return data.messages;
    },
    async startDirect(targetUserId: string): Promise<string> {
      const data = await request<{ thread_id: string }>('direct', { target_user_id: targetUserId }, 'POST');
      return data.thread_id;
    },
    async createGroup(name: string, memberIds: string[]): Promise<string> {
      const data = await request<{ thread_id: string }>('group', { name, member_ids: memberIds }, 'POST');
      return data.thread_id;
    },
    async sendMessage(threadId: string, mediaType: string, text: string, mediaUrl?: string, fileName?: string): Promise<{ id: string; timestamp: string }> {
      return await request<{ id: string; timestamp: string }>('send', {
        thread_id: threadId, mediaType, text, mediaUrl: mediaUrl ?? null, fileName: fileName ?? null,
      }, 'POST');
    },
  };
}
