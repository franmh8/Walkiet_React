import { useCallback, useEffect, useRef, useState } from 'react';
export function useRadioNotifications(_server: string, _token: string, _userId: string, onOpen: (channelId: string) => void, allowed = false, sounds = true) {
  const available = typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
  const [permission, setPermission] = useState<NotificationPermission>(available ? Notification.permission : 'default');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const open = useRef(onOpen); open.current = onOpen;
  const enable = useCallback(async () => {
    if (!available) { setError('Este navegador no admite avisos. Usa HTTPS o la app instalada.'); return false; }
    setBusy(true); setError(null);
    try { const value = await Notification.requestPermission(); setPermission(value); if (value !== 'granted') { setError('Autoriza las notificaciones en los permisos del navegador.'); return false; } return true; }
    catch { setError('No se pudo solicitar permiso de notificaciones.'); return false; }
    finally { setBusy(false); }
  }, [available]);
  const disable = useCallback(async () => { setError(null); return true; }, []);
  useEffect(() => { const check = () => { if (available) setPermission(Notification.permission); }; window.addEventListener('focus', check); return () => window.removeEventListener('focus', check); }, [available]);
  const notify = useCallback((names: string[], channelId: string) => {
    if (!available || !allowed || permission !== 'granted' || !names.length || document.visibilityState !== 'hidden') return;
    const notification = new Notification('Actividad de radio', { body: `${names.join(', ')} está hablando en tu grupo`, tag: 'walkiet-'+channelId, silent: !sounds });
    notification.onclick = () => { window.focus(); open.current(channelId); notification.close(); };
    setTimeout(() => notification.close(), 8000);
  }, [available, allowed, permission, sounds]);
  return { enabled: allowed && permission === 'granted', busy, available, error, enable, disable, notify };
}
export type RadioNotifications = ReturnType<typeof useRadioNotifications>;
