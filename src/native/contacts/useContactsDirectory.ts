import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContactsApiError, createContactsApi } from '../../services/contactsApi';
import type { ContactInput, DirectoryContact } from '../../services/contactsApi';

interface Session { userId: string; token: string; }
interface Page { scope: string; query: string; contacts: DirectoryContact[]; nextCursor: string | null; hasMore: boolean; }
const emptyPage = (scope: string, query: string): Page => ({ scope, query, contacts: [], nextCursor: null, hasMore: false });

// Página acotada por sesión. No hay caché global ni descarga completa ni sondeo periódico.
export function useContactsDirectory(serverUrl: string, session: Session | null) {
  const userId = session?.userId || ''; const token = session?.token || '';
  const scope = JSON.stringify([serverUrl, userId, token]);
  const api = useMemo(() => createContactsApi(serverUrl, token), [serverUrl, token]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<Page>(() => emptyPage(scope, ''));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const active = useRef({ scope, query, userId }); active.current = { scope, query, userId };
  const mounted = useRef(false);
  const revision = useRef(0); const sequence = useRef(0);
  const mutating = useRef(false); const readingMore = useRef(false);
  const pageRef = useRef(page); pageRef.current = page;

  const read = useCallback(async (append = false) => {
    if (!userId || !mounted.current || mutating.current || (append && readingMore.current)) return false;
    const previous = pageRef.current;
    if (append && (previous.scope !== scope || previous.query !== query || !previous.nextCursor)) return false;
    const version = revision.current; const request = ++sequence.current;
    if (append) readingMore.current = true;
    setLoading(true);
    try {
      const result = await api.list(query, append ? previous.nextCursor : null);
      if (!mounted.current || active.current.scope !== scope || active.current.query !== query || version !== revision.current || request !== sequence.current) return false;
      setPage({ scope, query, contacts: append ? [...previous.contacts, ...result.contacts.filter(c => !previous.contacts.some(p => p.id === c.id))] : result.contacts,
        nextCursor: result.nextCursor, hasMore: result.hasMore });
      setError(null); return true;
    } catch (cause) {
      if (mounted.current && active.current.scope === scope && active.current.query === query && version === revision.current && request === sequence.current) {
        if (cause instanceof ContactsApiError && cause.status === 401) setPage(emptyPage(scope, query));
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar tu agenda.');
      }
      return false;
    } finally {
      if (append && request === sequence.current) readingMore.current = false;
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [api, scope, userId, query]);
  const latestRead = useRef(read); latestRead.current = read;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++revision.current; }; }, []);
  useEffect(() => {
    ++revision.current; ++sequence.current; readingMore.current = false; setPage(emptyPage(scope, query)); setError(null); setLoading(false);
    if (!userId) return;
    const timer = setTimeout(() => { void read(); }, query ? 350 : 0);
    return () => { clearTimeout(timer); ++revision.current; };
  }, [scope, query, userId, read]);
  useEffect(() => { setQuery(''); }, [scope]);

  const mutate = useCallback(async <T,>(operation: () => Promise<T>) => {
    if (!userId || !token || active.current.scope !== scope) throw new Error('Inicia sesión de nuevo para gestionar tu agenda privada.');
    if (mutating.current) throw new Error('Espera a que termine la operación de contactos.');
    mutating.current = true; ++revision.current; setWriting(true);
    try {
      const saved = await operation();
      if (!mounted.current || active.current.scope !== scope) throw new Error('La sesión cambió durante la operación. Consulta tu agenda de nuevo.');
      return saved;
    } finally {
      mutating.current = false; ++revision.current;
      if (mounted.current) { setWriting(false); void latestRead.current(); }
    }
  }, [api, scope, userId, token]);

  const visible = page.scope === scope && page.query === query ? page : emptyPage(scope, query);
  return { scope, contacts: visible.contacts, error, loading, writing, query,
    setQuery, refresh: () => read(), loadMore: () => read(true), hasMore: visible.hasMore,
    isMutating: () => mutating.current,
    create: (input: ContactInput) => mutate(() => api.create(input)),
    update: (id: string, input: ContactInput) => mutate(() => api.update(id, input)),
    remove: (id: string) => mutate(() => api.remove(id)),
  };
}
export type ContactsDirectory = ReturnType<typeof useContactsDirectory>;
