import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createContactsApi } from '../../services/contactsApi';
import type { ContactInput, DirectoryContact } from '../../services/contactsApi';

// Una sola fuente de datos para la pantalla, el selector de chat y los grupos.
export function useContactsDirectory(serverUrl: string, enabled = true) {
  const api = useMemo(() => createContactsApi(serverUrl), [serverUrl]);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const mutating = useRef(false);
  const revision = useRef(0);
  const readSequence = useRef(0);
  const mounted = useRef(false);
  const target = useRef({ serverUrl, enabled });
  target.current = { serverUrl, enabled };
  const matchesTarget = useCallback((url: string) =>
    mounted.current && target.current.enabled && target.current.serverUrl === url, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!enabled || !matchesTarget(serverUrl) || mutating.current) return false;
    const version = revision.current;
    const request = ++readSequence.current;
    setLoading(true);
    try {
      const result = await api.list();
      if (!matchesTarget(serverUrl) || version !== revision.current || request !== readSequence.current) return false;
      setContacts(result);
      setError(null);
      return true;
    } catch (cause) {
      if (matchesTarget(serverUrl) && version === revision.current && request === readSequence.current) {
        setError(cause instanceof Error ? cause.message : 'No se pudieron consultar los contactos.');
      }
      return false;
    } finally {
      if (mounted.current && request === readSequence.current) setLoading(false);
    }
  }, [api, serverUrl, enabled, matchesTarget]);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++revision.current; };
  }, []);

  useEffect(() => {
    ++revision.current;
    ++readSequence.current;
    setContacts([]);
    setError(null);
    setLoading(false);
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const ok = await refresh();
      // Un servidor con error no genera una petición fallida cada pocos segundos.
      if (active) timer = setTimeout(poll, ok ? 15000 : 60000);
    };
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); ++revision.current; };
  }, [serverUrl, enabled, refresh]);

  const mutate = useCallback(async <T,>(operation: () => Promise<T>, apply: (value: T) => void): Promise<T> => {
    if (!enabled || !matchesTarget(serverUrl)) throw new Error('Configura el servidor e inicia sesión para gestionar contactos.');
    if (mutating.current) throw new Error('Espera a que termine la operación de contactos.');
    mutating.current = true;
    ++revision.current;
    setWriting(true);
    try {
      const saved = await operation();
      if (!matchesTarget(serverUrl)) throw new Error('El servidor cambió durante la operación. Vuelve a consultar el directorio.');
      apply(saved);
      return saved;
    } finally {
      mutating.current = false;
      ++revision.current;
      if (mounted.current) {
        setWriting(false);
        void latestRefresh.current();
      }
    }
  }, [enabled, serverUrl, matchesTarget]);

  return {
    contacts, error, loading, writing, refresh,
    isMutating: () => mutating.current,
    create: (input: ContactInput) => mutate(() => api.create(input), saved => {
      setContacts(previous => [saved, ...previous.filter(contact => contact.id !== saved.id)]);
    }),
    update: (id: string, input: ContactInput) => mutate(() => api.update(id, input), saved => {
      setContacts(previous => previous.map(contact => contact.id === id ? saved : contact));
    }),
    remove: (id: string) => mutate(() => api.remove(id), () => {
      setContacts(previous => previous.filter(contact => contact.id !== id));
    }),
  };
}

export type ContactsDirectory = ReturnType<typeof useContactsDirectory>;
