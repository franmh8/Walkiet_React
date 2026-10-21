import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore: Record<string, string> = {};

export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
        const val = await AsyncStorage.getItem(key);
        if (val !== undefined && val !== null) return val;
      }
    } catch (e) {
      console.warn(`[safeStorage] Warning reading ${key}:`, e);
    }
    return memoryStore[key] || null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memoryStore[key] = value;
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[safeStorage] Warning writing ${key}:`, e);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    delete memoryStore[key];
    try {
      if (AsyncStorage && typeof AsyncStorage.removeItem === 'function') {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[safeStorage] Warning removing ${key}:`, e);
    }
  },
};
