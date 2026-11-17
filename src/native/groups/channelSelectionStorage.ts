import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Channel } from '../../services/channelsApi';

export interface ChannelIdentity { id: string; phone_number?: string; email?: string; loginIdentifier?: string; }
const normalizeServer = (server: string) => server.trim().replace(/\/+$/, '');
export const channelSelectionKey = (server: string, id: string) =>
  `c5i_radio_channel:${encodeURIComponent(normalizeServer(server))}:${encodeURIComponent(id)}`;
const queues = new Map<string, Promise<void>>();
const storage = {
  get: (key: string) => Platform.OS === 'web' ? Promise.resolve(window.localStorage.getItem(key)) : AsyncStorage.getItem(key),
  set: (key: string, value: string) => Platform.OS === 'web' ? Promise.resolve(window.localStorage.setItem(key, value)) : AsyncStorage.setItem(key, value),
  remove: (key: string) => Platform.OS === 'web' ? Promise.resolve(window.localStorage.removeItem(key)) : AsyncStorage.removeItem(key),
};
function legacyKeys(user: ChannelIdentity) {
  const keys = [`c5i_last_selected_channel_${encodeURIComponent(user.id)}`];
  const phone = (user.phone_number || '').replace(/\D/g, '');
  if (phone.length >= 10) keys.push(`c5i_last_channel_phone_${phone}`);
  for (const value of [user.email, user.loginIdentifier]) {
    const identifier = (value || '').trim().toLowerCase();
    if (identifier.includes('@')) keys.push(`c5i_last_channel_email_${encodeURIComponent(identifier)}`);
    else if (/^\d{10,}$/.test(identifier.replace(/\D/g, ''))) keys.push(`c5i_last_channel_phone_${identifier.replace(/\D/g, '')}`);
  }
  return [...new Set(keys)];
}
function parseId(value: string | null): string | null {
  try { const parsed = JSON.parse(value || 'null'); return typeof parsed?.id === 'string' && parsed.id ? parsed.id : null; }
  catch { return null; }
}
export async function readChannelSelection(server: string, user: ChannelIdentity): Promise<string | null> {
  const key = channelSelectionKey(server, user.id);
  await queues.get(key)?.catch(() => {});
  const current = await storage.get(key);
  // Un null explícito impide resucitar preferencias anteriores al abandonar un grupo.
  if (current !== null) return parseId(current);
  for (const legacy of legacyKeys(user)) {
    const id = parseId(await storage.get(legacy));
    if (id) return id;
  }
  return null;
}
export function writeChannelSelection(server: string, user: ChannelIdentity, channel: Channel | null, forgetLegacy = false) {
  const key = channelSelectionKey(server, user.id);
  const value = JSON.stringify(channel ? { id: channel.id, name: channel.name } : null);
  // Serializar escrituras nativas: un guardado lento anterior no debe ganar al último toque.
  const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    await storage.set(key, value);
    if (forgetLegacy) for (const legacy of legacyKeys(user)) await storage.remove(legacy);
  });
  queues.set(key, task);
  void task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => {});
  return task;
}
