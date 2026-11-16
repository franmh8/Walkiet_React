import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { createPttApi } from '../../services/pttApi';

export function useRadioNotifications(server: string, token: string, userId: string, onOpen: (channelId: string) => void, allowed = false, sounds = true) {
  const [enabled, setEnabled] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = JSON.stringify([server, userId, token]);
  const active = useRef(scope); active.current = scope;
  const registered = useRef<{ token: string; api: ReturnType<typeof createPttApi> } | null>(null);
  const open = useRef(onOpen); open.current = onOpen; const sound = useRef(sounds); sound.current = sounds;
  const pending = useRef(false);
  const supported = Constants.executionEnvironment !== 'storeClient';
  useEffect(() => {
    pending.current = false; setEnabled(false); setError(null); setBusy(false);
    if (!token || !supported) return;
    let notifications: typeof import('expo-notifications');
    try { notifications = require('expo-notifications'); } catch { setError('Actualiza la compilación de la app para recibir avisos.'); return; }
    notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: sound.current, shouldSetBadge: false }) });
    let alive = true;
    const handle = (response: import('expo-notifications').NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (alive && active.current === scope && data?.type === 'ptt-live' && typeof data.channel_id === 'string') open.current(data.channel_id);
    };
    const subscription = notifications.addNotificationResponseReceivedListener(handle);
    void notifications.getLastNotificationResponseAsync().then(response => { if (response) { handle(response); void notifications.clearLastNotificationResponseAsync(); } }).catch(() => {});
    return () => {
      alive = false; subscription.remove();
      const previous = registered.current; registered.current = null;
      if (previous) void previous.api.unregisterDevice(previous.token).catch(() => {});
    };
  }, [scope, token, supported]);
  const enable = useCallback(async () => {
    if (registered.current) return true;
    if (pending.current) return false;
    pending.current = true;
    setBusy(true); setError(null);
    try {
      if (!supported) throw new Error('Para recibir avisos instala la compilación de pruebas. Expo Go no admite estas notificaciones.');
      const { isDevice } = require('expo-device') as typeof import('expo-device');
      if (!isDevice) throw new Error('Activa los avisos desde un teléfono físico.');
      const notifications = require('expo-notifications') as typeof import('expo-notifications');
      if (Platform.OS === 'android') {
        await notifications.setNotificationChannelAsync('ptt-radio', { name: 'Actividad de los grupos', importance: notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 120, 80, 120] });
        await notifications.setNotificationChannelAsync('ptt-radio-silent', { name: 'Actividad sin sonido', importance: notifications.AndroidImportance.HIGH, sound: null, enableVibrate: false });
      }
      let permissions = await notifications.getPermissionsAsync();
      if (!permissions.granted) permissions = await notifications.requestPermissionsAsync();
      if (!permissions.granted) throw new Error('Autoriza las notificaciones en los ajustes del teléfono.');
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) throw new Error('El administrador necesita configurar el proyecto de notificaciones de esta app.');
      const result = await notifications.getExpoPushTokenAsync({ projectId });
      if (active.current !== scope) return false;
      const api = createPttApi(server, token, '', '');
      await api.registerDevice(result.data, Platform.OS);
      if (active.current !== scope) { void api.unregisterDevice(result.data).catch(() => {}); return false; }
      registered.current = { token: result.data, api }; setEnabled(true); return true;
    } catch (cause) { if (active.current === scope) setError(cause instanceof Error ? cause.message : 'No se pudieron activar los avisos.'); return false; }
    finally { if (active.current === scope) { setBusy(false); pending.current = false; } }
  }, [server, token, scope, supported]);
  const disable = useCallback(async () => {
    const previous = registered.current;
    setError(null); setBusy(true);
    try { if (previous) await previous.api.unregisterDevice(previous.token); if (active.current !== scope) return false; registered.current = null; setEnabled(false); return true; }
    catch { if (active.current === scope) setError('No se pudieron desactivar los avisos en el servidor.'); return false; }
    finally { if (active.current === scope) setBusy(false); }
  }, [scope]);
  useEffect(() => {
    if (!allowed || !token || !supported) return;
    let alive = true;
    try { const n = require('expo-notifications') as typeof import('expo-notifications'); void n.getPermissionsAsync().then(p => { if (alive && p.granted) void enable(); }).catch(() => {}); } catch {}
    return () => { alive = false; };
  }, [allowed, token, supported, enable]);
  useEffect(() => { if (!allowed && registered.current) void disable(); }, [allowed, disable]);
  const notify = useCallback((_names: string[], _channelId: string) => {}, []);
  return { enabled: allowed && enabled, busy, error, available: supported, enable, disable, notify };
}
