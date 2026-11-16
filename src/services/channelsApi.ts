export interface Channel {
  id: string; name: string; code: string; frequency: string; category: string;
  isEncrypted: boolean; memberCount: number; pin: string; isOwner: boolean;
}
export interface ChannelMember { id: string; name: string; callsign?: string; unit?: string; }
export class ChannelsApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ChannelsApiError'; }
}
function parseChannel(value: any): Channel {
  if (!value || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' ||
      !Number.isInteger(value.member_count) || value.member_count < 0 || typeof value.pin !== 'string' || typeof value.is_owner !== 'boolean') {
    throw new Error('El servidor devolvió un grupo inválido. Actualiza channels.php y channels-handler.php.');
  }
  return { id: value.id, name: value.name, code: value.id, frequency: value.frequency || '', category: 'Táctico',
    isEncrypted: true, memberCount: value.member_count, pin: value.pin, isOwner: value.is_owner === true };
}
export function createChannelsApi(baseUrl: string, token: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const endpoint = base + (/alwaysdata\.net|\.php(?:$|\/)/i.test(base) ? '/channels.php' : '/api/channels');
  async function request(action?: string, payload: Record<string, unknown> = {}, params?: Record<string, string>) {
    if (!base) throw new Error('Configura el servidor antes de gestionar grupos.');
    if (!token) throw new ChannelsApiError('Inicia sesión de nuevo para consultar tus grupos.', 401);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const query = params ? '?' + Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
      const response = await fetcher(endpoint + query, {
        method: action ? 'POST' : 'GET', credentials: 'omit', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(action ? { 'Content-Type': 'text/plain;charset=UTF-8' } : {}) },
        ...(action ? { body: JSON.stringify({ ...payload, action }) } : { cache: 'no-store' as const }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) throw new ChannelsApiError(data?.message || `No se pudo completar la operación del grupo (HTTP ${response.status}).`, response.status);
      return data;
    } catch (error) {
      if (error instanceof Error && !['AbortError', 'TypeError'].includes(error.name)) throw error;
      throw new Error('No se pudo contactar al servidor. Consulta tus grupos antes de reintentar.');
    } finally { clearTimeout(timer); }
  }
  return {
    async list(): Promise<Channel[]> {
      const data = await request();
      if (!Array.isArray(data.channels)) throw new Error('El servidor devolvió una lista de grupos inválida.');
      return data.channels.map(parseChannel);
    },
    async create(name: string, pin: string): Promise<Channel> { return parseChannel((await request('create', { name: name.trim(), pin })).channel); },
    async join(pin: string, id?: string): Promise<Channel> { return parseChannel((await request('join', { pin, ...(id ? { id } : {}) })).channel); },
    async leave(id: string) { await request('leave', { id }); },
    async remove(id: string) { await request('delete', { id }); },
    async members(id: string): Promise<{ members: ChannelMember[]; memberCount: number }> {
      const data = await request(undefined, {}, { action: 'members', id });
      if (!Array.isArray(data.members) || !Number.isInteger(data.member_count)) throw new Error('No se pudo leer la lista de miembros.');
      return { members: data.members, memberCount: data.member_count };
    },
  };
}
export type ChannelsApi = ReturnType<typeof createChannelsApi>;
