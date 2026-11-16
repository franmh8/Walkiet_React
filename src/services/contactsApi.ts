export class ContactsApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'ContactsApiError'; }
}

export interface DirectoryContact {
  id: string;
  name: string;
  phone_number: string;
  callsign: string;
  email: string;
  unit: string;
  status: 'online' | 'offline';
  role?: string;
  registered_user_id?: string | null;
}

export type ContactInput = Pick<DirectoryContact, 'name' | 'phone_number' | 'email'> &
  Partial<Pick<DirectoryContact, 'callsign' | 'unit'>>;

export function validateContact(input: ContactInput): ContactInput {
  const value = { ...input, name: input.name.trim(), phone_number: input.phone_number.replace(/\D/g, ''), email: input.email.trim() };
  if (!value.name || value.name.length > 120) throw new Error('Ingresa un nombre de hasta 120 caracteres.');
  if (!/^\d{10,15}$/.test(value.phone_number)) throw new Error('Ingresa un teléfono de 10 a 15 dígitos.');
  if (value.email.length > 120 || (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) {
    throw new Error('Ingresa un correo electrónico válido.');
  }
  if ((value.callsign?.length || 0) > 50) throw new Error('El indicativo admite hasta 50 caracteres.');
  if ((value.unit?.length || 0) > 100) throw new Error('La unidad admite hasta 100 caracteres.');
  return value;
}

function parseContact(value: any): DirectoryContact {
  if (!value || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' ||
      typeof value.phone_number !== 'string') throw new Error('El servidor devolvió un contacto inválido.');
  return {
    id: value.id, name: value.name, phone_number: value.phone_number,
    callsign: value.callsign || `RADIO-${value.phone_number.slice(-4)}`,
    email: value.email ?? value.correo ?? '', unit: value.unit || 'Sector Operativo Hidalgo C5i',
    status: value.status === 'online' ? 'online' : 'offline', role: value.role || 'Contacto personal',
    registered_user_id: typeof value.registered_user_id === 'string' ? value.registered_user_id : null,
  };
}

export function createContactsApi(baseUrl: string, token: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const isPhp = /alwaysdata\.net|\.php(?:$|\/)/i.test(base);
  const endpoint = /\.php$/i.test(base) ? base : `${base}${isPhp ? '/contacts.php' : '/api/contacts'}`;
  async function request(action?: string, payload: Record<string, unknown> = {}, params?: Record<string, string>) {
    if (!base) throw new Error('Configura el servidor antes de gestionar contactos.');
    if (!token) throw new ContactsApiError('Inicia sesión de nuevo para consultar tu agenda privada.', 401);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      // Una sola escritura; POST con acción funciona también en hosts que restringen PUT/DELETE.
      const response = await fetcher(endpoint + (params ? '?' + Object.entries(params).map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&') : ''), action ? {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payload, action }), signal: controller.signal,
      } : { credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        throw new ContactsApiError(data?.message || `No se pudo completar la operación de contactos (HTTP ${response.status}).`, response.status);
      }
      return data;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError' && error.name !== 'TypeError') throw error;
      throw new Error('No se pudo contactar al servidor. Revisa la conexión y vuelve a consultar antes de reintentar.');
    } finally { clearTimeout(timer); }
  }
  return {
    async list(query = '', cursor: string | null = null): Promise<{ contacts: DirectoryContact[]; hasMore: boolean; nextCursor: string | null }> {
      const data = await request(undefined, {}, { limit: '50', q: query, ...(cursor ? { cursor } : {}) });
      if (!Array.isArray(data.contacts)) throw new Error('El servidor devolvió una lista de contactos inválida.');
      if (typeof data.has_more !== 'boolean' || (data.has_more && (typeof data.next_cursor !== 'string' || !data.next_cursor))) throw new Error('El servidor devolvió una página de contactos inválida.');
      return { contacts: data.contacts.map(parseContact), hasMore: data.has_more, nextCursor: data.next_cursor || null };
    },
    async create(input: ContactInput): Promise<DirectoryContact> {
      return parseContact((await request('create', validateContact(input))).contact);
    },
    async update(id: string, input: ContactInput): Promise<DirectoryContact> {
      return parseContact((await request('update', { ...validateContact(input), id })).contact);
    },
    async remove(id: string): Promise<void> {
      const data = await request('delete', { id });
      if (data.id !== id) throw new Error('El servidor no confirmó el contacto eliminado.');
    },
  };
}

export async function logoutContactSession(baseUrl: string, token?: string) {
  if (!token) return;
  const base = baseUrl.trim().replace(/\/+$/, '');
  const endpoint = base.includes('alwaysdata.net') ? '/logout.php' : '/api/auth/logout';
  await fetch(base + endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
}
