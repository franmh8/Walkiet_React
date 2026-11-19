import React, {useEffect, useRef, useState} from 'react';
import {Text, View} from 'react-native';
import {isVoiceData} from './voiceTypes';
import {registerVoicePlayback, stopVoicePlayback} from './voicePlayback';
import {VoiceNoteControls} from './VoiceNoteControls';
import {audioPeaks, emptyWave, labelDuration, wavWaveform, type VoiceWave} from './voiceWaveform';
import type {VoiceNotePlayerProps} from './VoiceNotePlayer.types';
// Decodificar AAC solo cuando la nota entra en pantalla, de una en una.
let decodeQueue: Promise<unknown> = Promise.resolve();
export const VoiceNotePlayer = React.memo(function VoiceNotePlayer(p: VoiceNotePlayerProps) {
  const ref = useRef<HTMLAudioElement>(null), version = useRef(0), busy = useRef(false);
  const latest = useRef(p); latest.current = p;
  const [error, setError] = useState(false), [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false), [position, setPosition] = useState(0), [duration, setDuration] = useState(0);
  const [wave, setWave] = useState<VoiceWave>(emptyWave);
  const analysed = useRef<string | undefined>(undefined);
  const valid = isVoiceData(p.dataUrl);
  useEffect(() => {
    const audio = ref.current;
    const stop = () => {++version.current; audio?.pause();};
    const unregister = registerVoicePlayback(stop);
    return () => {unregister(); stop();};
  }, [p.dataUrl]);
  useEffect(() => {if (!p.enabled) {++version.current; ref.current?.pause();}}, [p.enabled]);
  useEffect(() => {
    if (!valid || p.visible === false || analysed.current === p.dataUrl) return;
    let cancelled = false;
    const url = p.dataUrl!;
    const pcm = wavWaveform(url);
    if (pcm) {analysed.current = url; setWave(pcm); return;}
    decodeQueue = decodeQueue.catch(() => {}).then(async () => {
      if (cancelled) return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const context: AudioContext = new AudioContextClass();
      try {
        const audio = await context.decodeAudioData(await (await fetch(url)).arrayBuffer());
        if (!cancelled) {
          analysed.current = url;
          setWave({peaks: audioPeaks(Array.from({length: audio.numberOfChannels}, (_, i) => audio.getChannelData(i))), duration: audio.duration});
        }
      } catch {} finally {void context.close().catch(() => {});}
    });
    return () => {cancelled = true;};
  }, [p.dataUrl, p.visible, valid]);
  const play = async () => {
    const audio = ref.current;
    if (!audio || !latest.current.enabled || busy.current) return;
    if (!audio.paused) {audio.pause(); return;}
    stopVoicePlayback(); const current = version.current;
    busy.current = true; setLoading(true); setError(false);
    try {
      await latest.current.beforePlay();
      if (current !== version.current || !latest.current.enabled || !audio.isConnected) return;
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
    } catch {if (audio.isConnected) setError(true);}
    finally {busy.current = false; if (audio.isConnected) setLoading(false);}
  };
  const total = duration || wave.duration || labelDuration(p.label);
  return <View testID="voice-note-player" style={{maxWidth: '100%'}}>
    {valid ? <>
      <audio ref={ref} aria-hidden="true" preload={p.visible === false ? 'none' : 'metadata'} src={p.dataUrl} style={{display: 'none'}}
        onLoadedMetadata={() => {const n = ref.current?.duration; if (n && Number.isFinite(n)) setDuration(n);}}
        onTimeUpdate={() => setPosition(ref.current?.currentTime || 0)}
        onPlay={() => {if (!latest.current.enabled) ref.current?.pause(); else setPlaying(true);}}
        onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError(true)}/>
      <VoiceNoteControls {...p} duration={total} position={position} playing={playing} loading={loading} disabled={!p.enabled}
        peaks={wave.peaks} play={() => void play()} seek={fraction => {if (ref.current && Number.isFinite(ref.current.duration)) {ref.current.currentTime = fraction * ref.current.duration; setPosition(ref.current.currentTime);}}}/>
    </> : <Text style={{color: p.isSelf ? '#ffffffbb' : '#64748b', fontSize: 12}}>Audio anterior no disponible</Text>}
    {error && <Text accessibilityRole="alert" style={{color: p.isSelf ? '#fff' : '#691c32', fontSize: 12}}>No se pudo reproducir el audio.</Text>}
  </View>;
});
