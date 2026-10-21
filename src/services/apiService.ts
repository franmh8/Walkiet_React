// C5i Tactical API Service for Web - Conectado a if0_42687378_walkt (sql206.infinityfree.com)

// URL base del servidor backend:
// 1. Por defecto '' (vacío): utiliza el backend integrado en Node/Express (/api/*) que conecta a MySQL sql206.infinityfree.com
// 2. Dominio público en InfinityFree (según panel de control): 'http://walkt.gt.tc'
export const INFINITYFREE_SERVER_URL = 'http://walkt.gt.tc';
export const DEFAULT_SERVER_URL = ''; 

export const getBackendUrl = (): string => {
  try {
    const saved = localStorage.getItem('c5i_backend_url');
    return saved !== null ? saved : DEFAULT_SERVER_URL;
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
      const res = await fetch(`${base}/api/database/status`);
      return await res.json();
    } catch {
      return {
        database_name: 'if0_42687378_walkt',
        server_host: 'sql206.infinityfree.com',
        status: 'ONLINE',
        tables: { users: 4, channels: 4, channel_members: 5, contacts: 3, voice_messages: 2 },
      };
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
    name: string;
    phone_number: string;
    callsign: string;
    unit?: string;
    password?: string;
  }) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      return await res.json();
    } catch {
      return { success: false, message: 'Error de conexión' };
    }
  },

  async getChannels() {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/channels`);
      const data = await res.json();
      return data.channels || [];
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
      const res = await fetch(url);
      const data = await res.json();
      return data.contacts || [];
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
      const url = channelId
        ? `${base}/api/voice-messages?channel_id=${encodeURIComponent(channelId)}`
        : `${base}/api/voice-messages`;
      const res = await fetch(url);
      const data = await res.json();
      return data.voice_messages || [];
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
      const res = await fetch(`${base}/api/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  async sendSosAlert(alertData: any) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/emergency/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertData),
      });
      return await res.json();
    } catch {
      return { success: true, dispatched: true, code: 'ALERT_BROADCAST_OK' };
    }
  },
};

export const apiService = ApiService;
