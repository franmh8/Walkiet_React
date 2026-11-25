import {createRegistrationApi} from './registrationApi';
// C5i Tactical API Service for Web - Conectado a Alwaysdata MySQL (walkiet_c5i en mysql-walkiet.alwaysdata.net)

// URL base del servidor backend remoto en Alwaysdata:
export const ALWAYSDATA_SERVER_URL = 'https://walkiet.alwaysdata.net';
export const DEFAULT_SERVER_URL = ALWAYSDATA_SERVER_URL; 

export const resolveBackendUrl = (saved: string | null): string => {
  if (saved === null) return DEFAULT_SERVER_URL;
  const url = saved.trim();
  try {
    // Trasladar las instalaciones que conservaron la dirección retirada.
    if (new URL(url).hostname === 'walkt.gt.tc') return DEFAULT_SERVER_URL;
  } catch { /* Una URL relativa puede usar el servidor Node local. */ }
  return url;
};

export const getBackendUrl = (): string => {
  try {
    const saved = localStorage.getItem('c5i_backend_url');
    const resolved = resolveBackendUrl(saved);
    if (saved !== null && resolved !== saved) localStorage.setItem('c5i_backend_url', resolved);
    return resolved;
  } catch {
    return DEFAULT_SERVER_URL;
  }
};

export const setBackendUrl = (url: string): void => {
  try {
    localStorage.setItem('c5i_backend_url', url.trim());
  } catch (err) {
    console.warn('Error saving backend URL:', err);
  }
};

export const ApiService = {
  async getDbStatus() {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/status.php`);
      if (res.ok) {
        return await res.json();
      }
      const resApi = await fetch(`${base}/api/database/status`);
      if (!resApi.ok) throw new Error('Estado del servidor no disponible.');
      return await resApi.json();
    } catch {
      throw new Error('No se pudo consultar el estado del servidor.');
    }
  },

  async login(identificador: string, password: string) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, password }),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: 'Error al contactar con la base de datos' };
    }
  },

  async register(userData: {
    name: string; phone_number: string; callsign: string; correo?: string;
    unit?: string; password?: string; challenge_id?: string; code?: string;
  }) {
    try {
      const user=await createRegistrationApi(getBackendUrl()).complete({name:userData.name,phone_number:userData.phone_number,correo:userData.correo||'',password:userData.password||'',challenge_id:userData.challenge_id||'',code:userData.code||''});
      return {success:true,user};
    } catch(error) {return {success:false,message:error instanceof Error?error.message:'No se pudo completar el registro.'};}
  },

  async getChannels() {
    const base = getBackendUrl();
    try {
      let res = await fetch(`${base}/channels.php`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`${base}/api/channels`).catch(() => null);
      }
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        return data?.channels || [];
      }
      return [];
    } catch {
      return [];
    }
  },

  async createChannel(channelData: {
    name: string;
    is_private: boolean;
    access_code?: string;
    created_by?: string;
    category?: string;
  }) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelData),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  async joinChannel(channelId: string, userId: string, pin?: string) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/channels/${channelId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, pin }),
      });
      return await res.json();
    } catch {
      return { success: false, message: 'Error al unirse al canal' };
    }
  },

  async deleteChannel(channelId: string) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/channels/${channelId}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  async getContacts(userId?: string) {
    const base = getBackendUrl();
    try {
      const url = userId ? `${base}/api/contacts?user_id=${encodeURIComponent(userId)}` : `${base}/api/contacts`;
      const res = await fetch(url).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        return data?.contacts || [];
      }
      return [];
    } catch {
      return [];
    }
  },

  async addContact(contactData: {
    user_id?: string;
    contact_user_id?: string;
    name: string;
    phone_number: string;
    alias?: string;
    callsign?: string;
    unit?: string;
  }) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  async getVoiceMessages(channelId?: string) {
    const base = getBackendUrl();
    try {
      const q = channelId ? `?channel_id=${encodeURIComponent(channelId)}` : '';
      let res = await fetch(`${base}/voice-messages.php${q}`).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`${base}/api/voice-messages${q}`).catch(() => null);
      }
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        return data?.voice_messages || [];
      }
      return [];
    } catch {
      return [];
    }
  },

  async transmitVoiceMessage(messageData: {
    sender_id: string;
    channel_id?: string | null;
    receiver_id?: string | null;
    audio_url: string;
    duration_seconds: number;
    text?: string;
    is_emergency?: boolean;
  }) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/voice-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  async updateUserStatus(userId: string, status: 'online' | 'offline' | 'transmitting') {
    const base = getBackendUrl();
    try {
      const endpoint = base.includes('alwaysdata')
        ? `${base}/user-status.php`
        : `${base}/api/users/${userId}/status`;
      const res = await fetch(endpoint, {
        method: base.includes('alwaysdata') ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, status }),
      }).catch(() => null);
      if (res && res.ok) {
        return await res.json().catch(() => ({ success: true }));
      }
      return { success: true };
    } catch {
      return { success: true };
    }
  },
};

export const apiService = ApiService;
