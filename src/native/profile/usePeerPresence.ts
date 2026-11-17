import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { createAccountApi } from '../../services/accountApi';
import type { PeerPresence } from '../../services/presence';

// La presencia pertenece a la cuenta y a esta ventana, no a una conversación
// guardada. Nunca se deriva del valor histórico users.status ni de mensajes.
export function usePeerPresence(server: string, token: string, ids: string[]) {
  const scope = JSON.stringify([server, token]);
  const key = JSON.stringify([...new Set(ids.filter(Boolean))].sort());
  const refresh = useRef<() => void>(() => {});
  const requested = useRef(ids); requested.current = [...new Set(ids.filter(Boolean))];
  const [state, setState] = useState<{ scope: string; peers: Record<string, PeerPresence> }>({ scope, peers: {} });
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    setState({ scope, peers: {} });
    if (!server || !token) return;
    const api = createAccountApi(server, token); const clientId = randomUUID();
    let closing = false, running = false, pending = false, version = 0;
    const foreground = () => (!AppState.currentState || AppState.currentState === 'active') &&
      (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden);
    let active = foreground();
    const flush = async () => {
      pending = true;
      if (running) return;
      running = true;
      try {
        while (pending) {
          pending = false; const current = version; const isActive = active && !closing;
          try {
            const ids = isActive ? requested.current : [];
            const peers: Record<string, PeerPresence> = {};
            for (let offset = 0; offset < Math.max(ids.length, 1); offset += 50) {
              if (current !== version) break;
              const started = Date.now();
              const snapshot = await api.presence(ids.slice(offset, offset + 50), offset === 0 ? { clientId, active: isActive } : undefined);
              for (const peer of snapshot.peers) peers[peer.id] = { ...peer,
                // Reloj del servidor y comienzo de la petición: la latencia
                // no extiende artificialmente el estado en línea.
                onlineUntil: peer.onlineUntil === null ? null : started + Math.max(0, peer.onlineUntil - snapshot.now) * 1000 };
            }
            if (!closing && current === version) { setClock(Date.now()); setState({ scope, peers }); }
          } catch {
            // Sin respuesta no se conserva un indicador verde antiguo.
            if (!closing && current === version) setState({ scope, peers: {} });
          }
        }
      } finally { running = false; }
    };
    const change = () => {
      const next = foreground(); if (next === active) return;
      active = next; ++version;
      if (!next) setState({ scope, peers: {} });
      void flush();
    };
    refresh.current = () => { ++version; void flush(); };
    void flush();
    const pulse = setInterval(() => { if (active) void flush(); }, 15000);
    const clockTick = setInterval(() => { if (active) setClock(Date.now()); }, 1000);
    const subscription = AppState.addEventListener('change', change);
    const hide = () => { active = false; ++version; void flush(); };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', change); window.addEventListener('pagehide', hide);
      window.addEventListener('pageshow', change);
    }
    return () => {
      refresh.current = () => {};
      closing = true; active = false; ++version; clearInterval(pulse); clearInterval(clockTick); subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', change); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', change);
      }
      // Serializar el cierre detrás del pulso en curso evita reactivar una
      // ventana que acaba de salir. Otra ventana conserva su propia conexión.
      void flush();
    };
  }, [scope, server, token]);
  useEffect(() => { refresh.current(); }, [scope, key]);
  const peers = state.scope === scope ? state.peers : {};
  return { peers, now: clock };
}
