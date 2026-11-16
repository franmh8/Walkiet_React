import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChannelsApi, ChannelsApiError, type Channel } from '../../services/channelsApi';

// Estado acotado al servidor y a la sesión; nunca se muestran grupos de otra cuenta.
export function useChannelsDirectory(serverUrl: string, userId: string, token: string) {
  const scope = JSON.stringify([serverUrl, userId, token]);
  const api = useMemo(() => createChannelsApi(serverUrl, token), [serverUrl, token]);
  const [state, setState] = useState<{ scope: string; channels: Channel[]; synced: boolean }>({ scope, channels: [], synced: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); const [writing, setWriting] = useState(false);
  const active = useRef(scope); active.current = scope;
  const revision = useRef(0); const sequence = useRef(0);
  const mutationScope = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refresh = useCallback(async (_baseUrl?: string) => {
    if (!userId || mutationScope.current === scope) return;
    const version = revision.current; const request = ++sequence.current;
    setLoading(true);
    try {
      const channels = await api.list();
      if (mounted.current && active.current === scope && version === revision.current && request === sequence.current) {
        setState({ scope, channels, synced: true }); setError(null);
      }
    } catch (cause) {
      if (mounted.current && active.current === scope && version === revision.current && request === sequence.current) {
        if (cause instanceof ChannelsApiError && cause.status === 401) setState({ scope, channels: [], synced: false });
        setError(cause instanceof Error ? cause.message : 'No se pudieron consultar tus grupos.');
      }
    } finally {
      if (mounted.current && active.current === scope && request === sequence.current) setLoading(false);
    }
  }, [api, scope, userId]);
  const latestRefresh = useRef(refresh); latestRefresh.current = refresh;
  useEffect(() => {
    ++revision.current; ++sequence.current;
    setState({ scope, channels: [], synced: false }); setError(null); setLoading(false); setWriting(false);
    if (!userId) return;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 4000);
    return () => { clearInterval(timer); ++revision.current; };
  }, [scope, userId, refresh]);
  const mutate = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (!userId || active.current !== scope) throw new Error('Inicia sesión para gestionar tus grupos.');
    if (mutationScope.current === scope) throw new Error('Espera a que termine la operación del grupo.');
    mutationScope.current = scope; ++revision.current; setWriting(true);
    try {
      const result = await operation();
      if (!mounted.current || active.current !== scope) throw new Error('La sesión cambió durante la operación.');
      return result;
    } finally {
      if (mutationScope.current === scope) mutationScope.current = null;
      if (mounted.current && active.current === scope) { setWriting(false); void latestRefresh.current(); }
    }
  }, [scope, userId]);
  const add = useCallback((channel: Channel) => {
    if (mounted.current && active.current === scope) setState(previous => ({ scope, synced: true,
      channels: [channel, ...(previous.scope === scope ? previous.channels.filter(c => c.id !== channel.id) : [])] }));
    return channel;
  }, [scope]);
  const remove = useCallback((id: string) => {
    if (mounted.current && active.current === scope) setState(previous => ({ ...previous, channels: previous.channels.filter(c => c.id !== id) }));
  }, [scope]);
  return { scope, api, channels: state.scope === scope ? state.channels : [], synced: state.scope === scope && state.synced,
    error, loading, writing, refresh,
    create: (name: string, pin: string) => mutate(async () => add(await api.create(name, pin))),
    join: (pin: string, id?: string) => mutate(async () => add(await api.join(pin, id))),
    leave: (id: string) => mutate(async () => { await api.leave(id); remove(id); }),
    remove: (id: string) => mutate(async () => { await api.remove(id); remove(id); }),
  };
}
export type ChannelsDirectory = ReturnType<typeof useChannelsDirectory>;
