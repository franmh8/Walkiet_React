import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { newRadioId as newId } from './randomId';
import { createPttApi, type PttApi } from '../../services/pttApi';
import { createRadioTransport } from './transport';
import type { RadioTransport } from './transport.types';

interface RadioConnection { scope: string; transport: RadioTransport; api: PttApi; }
interface Lease { id: string; api: PttApi; transport: RadioTransport; started: number; timer?: ReturnType<typeof setInterval>; }
export function useLiveRadio(server: string, userId: string, token: string, channel: { id: string; name: string } | null) {
  const scope = JSON.stringify([server, userId, token, channel?.id]);
  const active = useRef(scope); active.current = scope;
  const [state, setState] = useState<'off' | 'connecting' | 'connected' | 'reconnecting'>('off');
  const [error, setError] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [pressed, setPressed] = useState(false); const [transmitting, setTransmitting] = useState(false);
  const [duration, setDuration] = useState(0); const [starting, setStarting] = useState(false);
  const transport = useRef<RadioTransport | null>(null); const api = useRef<PttApi | null>(null);
  const lease = useRef<Lease | null>(null); const down = useRef(false);
  const generation = useRef(0); const connectionGeneration = useRef(0); const mounted = useRef(true);
  const connection = useRef<{ scope: string; promise: Promise<RadioConnection | null> } | null>(null);
  const ready = useRef<RadioConnection | null>(null);
  const preparing = useRef<{ scope: string; operation: object } | null>(null);
  const stop = useCallback(async () => {
    down.current = false; const stoppedVersion = ++generation.current; const stoppedScope = active.current;
    const previous = lease.current; lease.current = null;
    if (previous?.timer) clearInterval(previous.timer);
    const silence = transport.current?.silence(); // Corta el track antes de esperar la red.
    if (mounted.current) { setPressed(false); setStarting(false); setTransmitting(false); setDuration(0); }
    const results = await Promise.allSettled([silence, previous?.api.stop(previous.id)]);
    if (previous && results[1]?.status === 'rejected' && mounted.current && active.current === stoppedScope && generation.current === stoppedVersion) setError('El micrófono se cerró. El servidor liberará el turno al vencer su permiso.');
  }, []);
  const disconnect = useCallback(async () => {
    const stopping = stop(); ++connectionGeneration.current; connection.current = null; ready.current = null;
    const oldTransport = transport.current; transport.current = null;
    const oldApi = api.current; api.current = null;
    if (mounted.current) { setState('off'); setSpeakers([]); }
    await Promise.allSettled([stopping, oldTransport?.close(), oldApi?.disconnect()]);
  }, [stop]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void disconnect(); };
  }, [disconnect]);
  useEffect(() => { void disconnect(); setError(null); }, [scope, disconnect]);
  const connect = useCallback((): Promise<RadioConnection | null> => {
    if (!channel || !userId || !token || active.current !== scope) return Promise.resolve(null);
    if (connection.current?.scope === scope) return connection.current.promise;
    if (ready.current?.scope === scope && transport.current === ready.current.transport) return Promise.resolve(ready.current);
    if (transport.current) { setError('La radio está recuperando la conexión. Suelta PTT y vuelve a intentarlo cuando esté conectada.'); return Promise.resolve(null); }
    const version = ++connectionGeneration.current;
    setError(null); setState('connecting');
    const valid = () => mounted.current && active.current === scope && connectionGeneration.current === version;
    const promise = (async () => {
      let connected = false; let registered = false;
      let created: RadioTransport | null = null; let client: PttApi | null = null;
      try {
        const id = newId();
        client = createPttApi(server, token, channel.id, id);
        const credentials = await client.connect();
        registered = true;
        if (!valid()) return null;
        created = await createRadioTransport({
          state: next => {
            if (!valid() || transport.current !== created) return;
            if (next === 'disconnected') { void disconnect(); setError('Se perdió la conexión de radio. Mantén presionado PTT para reintentar.'); }
            else {
              if (next === 'reconnecting') { ready.current = null; void stop(); }
              if (next === 'connected' && created && client) ready.current = { scope, transport: created, api: client };
              setState(next);
            }
          },
          speakers: names => { if (valid()) setSpeakers(names); },
          playback: enabled => { if (valid()) setAudioEnabled(enabled); },
          error: message => { if (valid()) setError(message); },
        }, channel.name, valid);
        if (!valid()) return null;
        transport.current = created; api.current = client;
        await created.connect(credentials);
        if (!valid()) return null;
        connected = true; setState('connected');
        ready.current = { scope, transport: created, api: client };
        return ready.current;
      } catch (cause) {
        if (valid()) { setError(cause instanceof Error ? cause.message : 'No se pudo conectar la radio.'); setState('off'); }
        return null;
      } finally {
        if (!connected || !valid() || !created || transport.current !== created) {
          if (transport.current === created) { transport.current = null; api.current = null; ready.current = null; }
          // Un fallo de limpieza no debe sustituir el diagnóstico original.
          await Promise.allSettled([created?.close(), registered ? client?.disconnect() : undefined]);
        }
        if (valid()) connection.current = null;
      }
    })();
    connection.current = { scope, promise };
    return promise;
  }, [server, userId, token, channel?.id, channel?.name, scope, stop, disconnect]);
  useEffect(() => {
    // La escucha se prepara al elegir grupo, sin publicar el micrófono.
    // No reintentar en bucle si el PHP o el servicio multimedia no están disponibles.
    const resume = () => { if (AppState.currentState === 'active') void connect(); };
    resume();
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') void connect(); });
    return () => subscription.remove();
  }, [connect]);
  const press = useCallback(async () => {
    if (!channel || !userId || !token || preparing.current?.scope === scope || down.current) return;
    down.current = true; setPressed(true); setStarting(true); setError(null);
    const version = ++generation.current; const currentScope = scope;
    const operation = {};
    let deviceTransport: RadioTransport | null = null; let client: PttApi | null = null; let id: string | null = null;
    let startRequested = false;
    preparing.current = { scope, operation };
    let granted = false;
    const valid = () => mounted.current && down.current && active.current === currentScope && generation.current === version;
    try {
      const connected = await connect();
      if (!valid()) return;
      if (!connected) { await stop(); return; }
      deviceTransport = connected.transport; client = connected.api; id = newId();
      await deviceTransport.prepareMicrophone();
      if (!valid()) return;
      startRequested = true; await client.start(id); granted = true;
      if (!valid()) return;
      lease.current = { id, api: client, transport: deviceTransport, started: Date.now() };
      const liveClient = client; const liveId = id;
      const grantedAt = Date.now(); let heartbeating = false; let ticks = 0;
      lease.current!.timer = setInterval(() => {
        if (!valid()) return;
        const seconds = Math.floor((Date.now()-grantedAt)/1000); setDuration(seconds);
        if (seconds >= 44) { void stop(); return; }
        if (++ticks % 16 === 0 && !heartbeating) {
          heartbeating = true;
          void liveClient.heartbeat(liveId).catch(cause => {
            if (lease.current?.id !== id || active.current !== currentScope) return;
            void stop(); if (mounted.current) setError(cause instanceof Error ? cause.message : 'Se perdió el turno de radio.');
          }).finally(() => { heartbeating = false; });
        }
      }, 250);
      await deviceTransport.publish();
      if (!valid()) return;
      setStarting(false); setTransmitting(true);
      // El envío push va separado para no retrasar la apertura del micrófono.
      void client.notify(id).then(result => { if (result.push?.pending > 0 && mounted.current && lease.current?.id === id) setError('Audio en vivo activo. Algunos avisos están pendientes de envío.'); }).catch(() => { if (mounted.current && active.current === currentScope && lease.current?.id === id) setError('Audio en vivo activo. Los avisos push quedaron pendientes de entrega.'); });
    } catch (cause) {
      if (valid()) { await stop(); setError(cause instanceof Error ? cause.message : 'No se pudo abrir el micrófono.'); }
    } finally {
      if (!valid()) {
        await deviceTransport?.silence().catch(() => {});
        // Incluso si la respuesta de start se perdió, stop es idempotente por ID.
        if (startRequested && id) await client?.stop(id).catch(() => {});
      } else if (!granted) await stop();
      if (preparing.current?.scope === currentScope && preparing.current.operation === operation) preparing.current = null;
    }
  }, [channel?.id, userId, token, scope, stop, connect]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next !== 'active') void stop(); });
    const onBlur = () => { void stop(); };
    if (Platform.OS === 'web') { window.addEventListener('blur', onBlur); window.addEventListener('pagehide', onBlur); }
    return () => { subscription.remove(); if (Platform.OS === 'web') { window.removeEventListener('blur', onBlur); window.removeEventListener('pagehide', onBlur); } };
  }, [stop]);
  return { state, error, speakers, audioEnabled, pressed, transmitting, duration, starting, connect, disconnect, press, stop,
    clearError: () => setError(null), enableAudio: () => transport.current?.enableAudio().catch(() => setError('Toca Activar audio y permite la reproducción en el navegador.')) };
}
export type LiveRadio = ReturnType<typeof useLiveRadio>;
