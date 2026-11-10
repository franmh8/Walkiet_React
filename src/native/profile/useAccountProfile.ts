import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountApiError, createAccountApi, defaultAccountSettings, type AccountSettings, type AccountSnapshot, type AccountUser } from '../../services/accountApi';

export function useAccountProfile(server: string, id: string, token: string, onUpdated: (user: AccountUser) => void, onExpired: () => void) {
  const scope = JSON.stringify([server, id, token]); const active = useRef(scope); active.current = scope;
  const revision = useRef(0); const mutation = useRef(false); const update = useRef(onUpdated); update.current = onUpdated; const expire = useRef(onExpired); expire.current = onExpired;
  const [snapshot, setSnapshot] = useState<{ scope: string; value: AccountSnapshot } | null>(null);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => createAccountApi(server, token), [server, token]);
  const apply = useCallback((value: AccountSnapshot) => { setSnapshot({ scope, value }); update.current(value.user); }, [scope]);
  const refresh = useCallback(async () => {
    if (!id || !token || mutation.current) return;
    const version = ++revision.current; setLoading(true); setError(null);
    try { const value = await api.get(); if (active.current === scope && version === revision.current) apply(value); }
    catch (cause) { if (active.current === scope && version === revision.current) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar el perfil.'); if (cause instanceof AccountApiError && cause.status === 401) expire.current(); } }
    finally { if (active.current === scope && version === revision.current) setLoading(false); }
  }, [scope, id, token, api, apply]);
  useEffect(() => { active.current = scope; setSnapshot(null); mutation.current = false; setBusy(false); setLoading(false); setError(null); void refresh(); return () => { ++revision.current; if (active.current === scope) active.current = ''; }; }, [refresh]);
  const change = useCallback(async (operation: () => Promise<AccountSnapshot>) => {
    if (active.current !== scope) throw new Error('La sesión cambió.');
    if (mutation.current) throw new Error('Espera a que termine el cambio anterior.');
    mutation.current = true; ++revision.current; setLoading(false); setBusy(true); setError(null);
    try { const value = await operation(); if (active.current !== scope) throw new Error('La sesión cambió.'); apply(value); return value; }
    catch (cause) { if (active.current === scope) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); if (cause instanceof AccountApiError && cause.status === 401) expire.current(); } throw cause; }
    finally { if (active.current === scope) { mutation.current = false; setBusy(false); } }
  }, [scope, apply]);
  const value = snapshot?.scope === scope ? snapshot.value : null;
  return { user: value?.user || null, settings: value?.settings || defaultAccountSettings, loaded: !!value, loading, busy, error, refresh,
    clearError: () => setError(null), update: (fields: Parameters<typeof api.update>[0]) => change(() => api.update(fields)),
    saveSettings: (settings: Partial<AccountSettings>) => change(() => api.settings(settings)), avatar: (image: string | null) => change(() => api.avatar(image)),
    deleteAccount: async (password: string) => { if (active.current !== scope) throw new Error('La sesión cambió.');
    if (mutation.current) throw new Error('Espera a que termine el cambio anterior.'); mutation.current = true; ++revision.current; setBusy(true); try { await api.delete(password); if (active.current !== scope) throw new Error('La sesión cambió.'); } finally { if (active.current === scope) { mutation.current = false; setBusy(false); } } },
  };
}
export type AccountProfile = ReturnType<typeof useAccountProfile>;
