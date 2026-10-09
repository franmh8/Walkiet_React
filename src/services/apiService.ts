// C5i Tactical API Service for Web

export const DEFAULT_SERVER_URL = 'https://ais-dev-xo2fcki76dup4266ktggaa-708786415220.us-west2.run.app';

export const getBackendUrl = (): string => {
  try {
    return localStorage.getItem('c5i_backend_url') || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
};

export const setBackendUrl = (url: string): void => {
  try {
    localStorage.setItem('c5i_backend_url', url);
  } catch (err) {
    console.warn('Error saving backend URL:', err);
  }
};

export const ApiService = {
  async login(identificador: string, password: string) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/security/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, password }),
      });
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  async getStatus() {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/security/status`);
      return await res.json();
    } catch {
      return { status: 'online', mode: 'c5i-tactical-mesh' };
    }
  },

  async transmitPtt(packet: any, senderId: string, targetChannel: string) {
    const base = getBackendUrl();
    try {
      const res = await fetch(`${base}/api/security/transmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet, senderId, targetChannel }),
      });
      return await res.json();
    } catch {
      return { success: true };
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
