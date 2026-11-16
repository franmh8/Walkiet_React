export interface AccountSettings {
  theme: 'light' | 'dark' | 'system';
  pttMode: 'hold' | 'toggle';
  messageSounds: boolean;
  rogerBeep: boolean;
  backgroundNotifications: boolean;
}
export const defaultAccountSettings: AccountSettings = { theme: 'system', pttMode: 'hold', messageSounds: true, rogerBeep: true, backgroundNotifications: false };
export interface AccountUser {
  id: string; name: string; phone_number: string; correo: string | null; unit: string; role: string; callsign: string; avatar_url: string | null;
}
export interface AccountSnapshot { user: AccountUser; settings: AccountSettings; }
export class AccountApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export function createAccountApi(baseUrl: string, token: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const endpoint = base + (/alwaysdata\.net|\.php(?:$|\/)/i.test(base) ? '/account.php' : '/api/account');
  async function request(action: string, payload: object = {}, authenticated = true) {
    if (authenticated && !token) throw new AccountApiError('Inicia sesión para consultar tu perfil.', 401);
    const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 10000);
    try {
      const res = await fetcher(endpoint, { method: 'POST', credentials: 'omit', signal: abort.signal,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8', Accept: 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action, ...payload }) });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.success !== true) throw new AccountApiError(body?.message || (res.status === 404 ? 'Publica account.php y account-handler.php en el servidor.' : `No se pudo consultar la cuenta (HTTP ${res.status}).`), res.status);
      return body;
    } catch (cause) {
      if (cause instanceof AccountApiError) throw cause;
      throw new Error('No se pudo contactar al servidor. Tus cambios todavía no se han guardado.');
    } finally { clearTimeout(timer); }
  }
  async function snapshot(action: string, payload: object = {}): Promise<AccountSnapshot> {
    const data = await request(action, payload);
    if (!data.user?.id || typeof data.user.name !== 'string' || !['light','dark','system'].includes(data.settings?.theme) || !['hold','toggle'].includes(data.settings?.pttMode)) throw new Error('El servidor devolvió un perfil no válido.');
    return data;
  }
  return { get: () => snapshot('get'), update: (fields: Partial<Pick<AccountUser, 'name'|'unit'>>) => snapshot('update', { fields }),
    settings: (settings: Partial<AccountSettings>) => snapshot('settings', { settings }), avatar: (image: string | null) => snapshot('avatar', { image }),
    delete: (password: string) => request('delete', { password, confirmation: 'ELIMINAR' }),
    async health() { const start = Date.now(); const data = await request('health', {}, false); if (data.service !== 'walkiet-account' || data.database !== true) throw new Error('El servidor no confirmó la conexión con la BD.'); return Date.now() - start; },
  };
}
