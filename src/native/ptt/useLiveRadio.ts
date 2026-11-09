import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { newRadioId as newId } from './randomId';
import { createPttApi, type PttApi } from '../../services/pttApi';
import { createRadioTransport } from './transport';
import type { RadioTransport } from './transport.types';

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
  const generation = useRef(0); const connectionGeneration = useRef(0); const mounted = useRef(true); const connecting = useRef(false); const preparing = useRef<{ scope: string; id: string } | null>(null);
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
    const stopping = stop(); ++connectionGeneration.current; connecting.current = false;
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
  const connect = useCallback(async () => {
    if (!channel || !userId || !token || connecting.current || transport.current) return;
    connecting.current = true; const version = ++connectionGeneration.current;
    setError(null); setState('connecting');
    let connected = false;
    let created: RadioTransport | null = null; let client: PttApi | null = null;
    const valid = () => mounted.current && active.current === scope && connectionGeneration.current === version;
    try {
      const id = newId();
      client = createPttApi(server, token, channel.id, id);
      const credentials = await client.connect();
      if (!valid()) return;
      created = await createRadioTransport({
        state: next => {
          if (!mounted.current || active.current !== scope || transport.current !== created) return;
          if (next === 'disconnected') { void disconnect(); setState('off'); setError('Se perdió la conexión de radio. Vuelve a conectarla.'); }
          else { if (next === 'reconnecting') void stop(); setState(next); }
        },
        speakers: names => { if (mounted.current && active.current === scope) setSpeakers(names); },
        playback: enabled => { if (mounted.current && active.current === scope) setAudioEnabled(enabled); },
        error: message => { if (mounted.current && active.current === scope) setError(message); },
      }, channel.name, valid);
      if (!valid()) return;
      transport.current = created; api.current = client;
      await created.connect(credentials);
      if (!valid()) return;
      connected = true; setState('connected');
    } catch (cause) {
      if (mounted.current && active.current === scope && connectionGeneration.current === version) { setError(cause instanceof Error ? cause.message : 'No se pudo conectar la radio.'); setState('off'); }
    } finally {
      if (!connected || !valid() || !created || transport.current !== created || !api.current) {
        if (transport.current === created) { transport.current = null; api.current = null; }
        await created?.close(); await client?.disconnect().catch(() => {});
      }
      if (active.current === scope && connectionGeneration.current === version) connecting.current = false;
    }
  }, [server, userId, token, channel?.id, channel?.name, scope, stop, disconnect]);
  const press = useCallback(async () => {
    if (preparing.current?.scope === scope || down.current || !transport.current || !api.current || state !== 'connected') return;
    down.current = true; setPressed(true); setStarting(true); setError(null);
    const version = ++generation.current; const currentScope = scope;
    const deviceTransport = transport.current; const client = api.current; const id = newId();
    preparing.current = { scope, id };
    let granted = false;
    const valid = () => mounted.current && down.current && active.current === currentScope && generation.current === version;
    try {
      await deviceTransport.prepareMicrophone();
      if (!valid()) return;
      await client.start(id); granted = true;
      if (!valid()) return;
      lease.current = { id, api: client, transport: deviceTransport, started: Date.now() };
      const grantedAt = Date.now(); let heartbeating = false; let ticks = 0;
      lease.current!.timer = setInterval(() => {
        if (!valid()) return;
        const seconds = Math.floor((Date.now()-grantedAt)/1000); setDuration(seconds);
        if (seconds >= 44) { void stop(); return; }
        if (++ticks % 16 === 0 && !heartbeating) {
          heartbeating = true;
          void client.heartbeat(id).catch(cause => {
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
        await deviceTransport.silence().catch(() => {});
        // Incluso si la respuesta de start se perdió, stop es idempotente por ID.
        await client.stop(id).catch(() => {});
      } else if (!granted) await stop();
      if (preparing.current?.scope === currentScope && preparing.current.id === id) preparing.current = null;
    }
  }, [state, scope, stop]);
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
