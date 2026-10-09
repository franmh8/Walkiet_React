import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default backend server URL (the Web Express server on port 3000 or the cloud URL)
export const DEFAULT_SERVER_URL = 'https://ais-dev-xo2fcki76dup4266ktggaa-708786415220.us-west2.run.app';

export const getBackendUrl = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem('c5i_backend_url');
    return saved || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
};

export const setBackendUrl = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('c5i_backend_url', url);
  } catch (err) {
    console.warn('Error saving backend URL:', err);
  }
};

export const ApiService = {
  async login(identificador: string, password: string) {
    const base = await getBackendUrl();
    const res = await axios.post(
      `${base}/api/security/login`,
      { identificador, password },
      { timeout: 7000 }
    );
    return res.data;
  },

  async getStatus() {
    const base = await getBackendUrl();
    const res = await axios.get(`${base}/api/security/status`, { timeout: 5000 });
    return res.data;
  },

  async transmitPtt(packet: any, senderId: string, targetChannel: string) {
    const base = await getBackendUrl();
    const res = await axios.post(`${base}/api/security/transmit`, {
      packet,
      senderId,
      targetChannel,
    }, { timeout: 8000 });
    return res.data;
  },

  async sendSosAlert(alertData: any) {
    const base = await getBackendUrl();
    const res = await axios.post(`${base}/api/emergency/alert`, alertData, { timeout: 5000 });
    return res.data;
  },
};
