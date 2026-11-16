import { Room, RoomEvent, Track, ConnectionState, type RemoteTrack, type LocalAudioTrack, createLocalAudioTrack } from 'livekit-client';
import type { RadioEvents, RadioTransport } from './transport.types';

// Comparte la máquina de audio en web y nativo. Las APIs nativas se inicializan antes de crearla.
export function createLiveTransport(events: RadioEvents, web: boolean, cleanup: () => Promise<void> = async () => {}): RadioTransport {
  const room = new Room({ adaptiveStream: false, dynacast: false, singlePeerConnection: false,
    audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    publishDefaults: { stopMicTrackOnMute: true, audioPreset: { maxBitrate: 24000 } } });
  let closed = false; let desired = false; let captureRevision = 0;
  let prepared: LocalAudioTrack | undefined;
  let queue = Promise.resolve();
  const elements = new Set<HTMLMediaElement>();
  const detach = (track: RemoteTrack) => {
    if (web && track.kind === Track.Kind.Audio) for (const element of track.detach()) { elements.delete(element); element.remove(); }
  };
  room.on(RoomEvent.TrackSubscribed, track => {
    if (web && track.kind === Track.Kind.Audio) {
      const element = track.attach(); element.style.display = 'none'; document.body.appendChild(element); elements.add(element);
    }
  });
  room.on(RoomEvent.TrackUnsubscribed, detach);
  room.on(RoomEvent.ActiveSpeakersChanged, speakers => events.speakers(speakers.filter(p => !p.isLocal).map(p => p.name || 'Miembro del grupo')));
  room.on(RoomEvent.AudioPlaybackStatusChanged, enabled => events.playback(enabled));
  room.on(RoomEvent.ConnectionStateChanged, state => {
    if (state === ConnectionState.Connected) events.state('connected');
    if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) events.state('reconnecting');
    if (state === ConnectionState.Disconnected) { desired = false; stopTrack(); events.state('disconnected'); }
  });
  function stopTrack() {
    prepared?.stop(); prepared = undefined;
    const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
    if (track) { track.mediaStreamTrack.enabled = false; track.stop(); }
  }
  async function mute() {
    const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
    if (track) await room.localParticipant.unpublishTrack(track, true);
  }
  return {
    async connect(credentials) {
      await room.connect(credentials.url, credentials.token, { autoSubscribe: true });
      if (closed) { await room.disconnect(); return; }
      if (web) { try { await room.startAudio(); } catch { events.playback(false); } }
      else events.playback(true);
    },
    async prepareMicrophone() {
      desired = true; const revision = ++captureRevision;
      const track = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
      if (closed || !desired || captureRevision !== revision) { track.stop(); return; }
      prepared = track;
    },
    async publish() {
      queue = queue.catch(() => {}).then(async () => {
        for (let i = 0; i < 40 && desired && !closed && !room.localParticipant.permissions?.canPublish; i++) await new Promise(resolve => setTimeout(resolve, 50));
        if (!desired || closed) return;
        if (!room.localParticipant.permissions?.canPublish) throw new Error('El servidor no habilitó el micrófono. Suelta el botón y reintenta.');
        const track = prepared; prepared = undefined;
        if (!track) return;
        try { await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone, stopMicTrackOnMute: true }); }
        catch (cause) { track.stop(); throw cause; }
        if (!desired || closed) { stopTrack(); await mute(); }
      });
      await queue;
    },
    silence() {
      desired = false; ++captureRevision; stopTrack();
      queue = queue.catch(() => {}).then(mute);
      return queue;
    },
    async enableAudio() { if (web) await room.startAudio(); events.playback(true); },
    async close() {
      if (closed) return; closed = true; desired = false; stopTrack();
      try { await room.disconnect(); } finally {
        for (const element of elements) element.remove(); elements.clear();
        await cleanup();
      }
    },
  };
}
