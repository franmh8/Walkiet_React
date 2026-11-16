export interface RadioCredentials { url: string; token: string; room: string; identity: string; }
export class PttApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'PttApiError'; }
}
export function createPttApi(baseUrl: string, token: string, channelId: string, deviceId: string, fetcher: typeof fetch = fetch) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const endpoint = base + (/alwaysdata\.net|\.php(?:$|\/)/i.test(base) ? '/ptt.php' : '/api/ptt');
  async function request(action: string, payload: Record<string, unknown> = {}) {
    if (!token) throw new PttApiError('Inicia sesión de nuevo para usar la radio.', 401);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      // Una operación y una ruta: nunca repetir una transmisión en otra URL.
      const response = await fetcher(endpoint, { method: 'POST', credentials: 'omit', signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'text/plain;charset=UTF-8', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, channel_id: channelId, device_id: deviceId, ...payload }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        throw new PttApiError(data?.message || (response.status === 404 ? 'El servidor necesita el archivo ptt.php. Solicita su actualización.' : `No se pudo usar la radio (HTTP ${response.status}).`), response.status);
      }
      return data;
    } catch (cause) {
      if (cause instanceof PttApiError) throw cause;
      throw new Error('No se pudo acceder al servidor de radio. Comprueba que ptt.php esté publicado en la URL del servidor y permita OPTIONS/CORS.');
    } finally { clearTimeout(timer); }
  }
  return {
    async connect(): Promise<RadioCredentials> {
      const data = await request('connect');
      if (typeof data.url !== 'string' || typeof data.token !== 'string' || typeof data.identity !== 'string' || typeof data.room !== 'string') throw new Error('La configuración de radio recibida no es válida.');
      return data;
    },
    start: (id: string) => request('start', { transmission_id: id }),
    heartbeat: (id: string) => request('heartbeat', { transmission_id: id }),
    stop: (id: string) => request('stop', { transmission_id: id }),
    disconnect: () => request('disconnect'),
    notify: (id: string) => request('notify', { transmission_id: id }),
    registerDevice: (pushToken: string, platform: string) => request('register_device', { push_token: pushToken, platform }),
    unregisterDevice: (pushToken: string) => request('unregister_device', { push_token: pushToken }),
  };
}
export type PttApi = ReturnType<typeof createPttApi>;
