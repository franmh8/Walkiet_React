import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AccountApiError, createAccountApi } from '../../services/accountApi';

type Cache = Record<string, { revision: string | null; image: string | null }>;
export function usePeerAvatars(server: string, token: string, ids: string[], enabled: boolean) {
  const scope = JSON.stringify([server, token]);
  const key = JSON.stringify([...new Set(ids.filter(Boolean))].sort());
  const cache = useRef<{ scope: string; entries: Cache }>({ scope, entries: Object.create(null) });
  const [state, setState] = useState<{ scope: string; images: Record<string, string | null> }>({ scope, images: {} });
  useEffect(() => {
    if (cache.current.scope !== scope) {
      cache.current = { scope, entries: Object.create(null) };
      setState({ scope, images: {} });
    }
    if (!enabled || !token || !server) return;
    let cancelled = false, running = false;
    const requested: string[] = JSON.parse(key);
    const api = createAccountApi(server, token);
    const refresh = async () => {
      if (running || cancelled || AppState.currentState && AppState.currentState !== 'active' ||
          Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return;
      running = true;
      try {
        for (let offset = 0; offset < requested.length; offset += 20) {
          if (cancelled) break;
          const batch = requested.slice(offset, offset + 20);
          const known = Object.fromEntries(batch.flatMap(id => cache.current.entries[id]?.revision ? [[id, cache.current.entries[id].revision!]] : []));
          const entries = await api.avatars(batch, known);
          if (cancelled) break;
          for (const entry of entries) {
            cache.current.entries[entry.id] = { revision: entry.revision,
              image: entry.revision === null ? null : entry.image === undefined ? cache.current.entries[entry.id]?.image || null : entry.image };
          }
          setState({ scope, images: Object.fromEntries(requested.map(id => [id, cache.current.entries[id]?.image || null])) });
        }
      } catch (error) {
        if (!cancelled && error instanceof AccountApiError && [401, 403].includes(error.status)) {
          cache.current.entries = Object.create(null); setState({ scope, images: {} });
        }
        // Un fallo de red conserva las iniciales o la última imagen válida.
      } finally { running = false; }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void refresh(); });
    const resume = () => { void refresh(); };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    }
    return () => {
      cancelled = true; clearInterval(timer); subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume);
      }
    };
  }, [scope, server, token, key, enabled]);
  return state.scope === scope ? state.images : {};
}
