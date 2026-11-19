import React, {useEffect, useRef, useState} from 'react';
import {Platform, Text, View} from 'react-native';
import {getRecordingPermissionsAsync, useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, type AudioSample} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import {randomUUID} from 'expo-crypto';
import {isVoiceData} from './voiceTypes';
import {registerVoicePlayback, stopVoicePlayback} from './voicePlayback';
import {VoiceNoteControls} from './VoiceNoteControls';
import {audioPeaks, emptyWave, labelDuration, wavWaveform, WAVE_BARS} from './voiceWaveform';
import type {VoiceNotePlayerProps} from './VoiceNotePlayer.types';
function pause(player: {pause: () => void}) {try {player.pause();} catch {}}
function NativePlayer(p: VoiceNotePlayerProps) {
  const player = useAudioPlayer(null, {updateInterval: 100}), status = useAudioPlayerStatus(player);
  const file = useRef<string | null>(null), mounted = useRef(true), version = useRef(0), busy = useRef(false);
  const latest = useRef(p); latest.current = p;
  const [loading, setLoading] = useState(false), [error, setError] = useState(false), [wave, setWave] = useState(emptyWave);
  const analysed = useRef<string | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    const unregister = registerVoicePlayback(() => {++version.current; pause(player);});
    return () => {
      mounted.current = false; ++version.current; unregister(); pause(player);
      if (file.current) void FileSystem.deleteAsync(file.current, {idempotent: true}).catch(() => {});
    };
  }, [player]);
  useEffect(() => {if (!p.enabled) {++version.current; pause(player);}}, [p.enabled, player]);
  useEffect(() => {
    if (p.visible === false || analysed.current === p.dataUrl) return;
    analysed.current = p.dataUrl; const pcm = wavWaveform(p.dataUrl); if (pcm) setWave(pcm);
  }, [p.dataUrl, p.visible]);
  useEffect(() => {
    let disposed = false; let sub: {remove: () => void} | undefined;
    // AAC: las barras se completan con muestras reales durante la reproducción.
    // No solicitar permiso de grabación solo para escuchar una nota.
    if (p.visible === false || p.dataUrl?.startsWith('data:audio/wav')) return;
    void (async () => {
      try {
        const permitted = Platform.OS !== 'android' || (await getRecordingPermissionsAsync()).granted;
        if (disposed || !permitted || !player.isAudioSamplingSupported) return;
        player.setAudioSamplingEnabled(true);
        let last = -1;
        sub = player.addListener('audioSampleUpdate', (sample: AudioSample) => {
          const total = player.duration || labelDuration(latest.current.label);
          if (!mounted.current || total <= 0 || sample.timestamp < 0) return;
          const bin = Math.min(WAVE_BARS - 1, Math.floor(sample.timestamp / total * WAVE_BARS));
          if (bin === last) return; last = bin;
          const level = audioPeaks(sample.channels.map(channel => channel.frames), 1)[0];
          setWave(previous => {const peaks = [...previous.peaks]; peaks[bin] = level; return {peaks, duration: total};});
        });
      } catch {} // La reproducción funciona aunque el equipo no permita muestreo.
    })();
    return () => {disposed = true; sub?.remove();};
  }, [player, p.dataUrl, p.visible]);
  const play = async () => {
    if (!latest.current.enabled || busy.current) return;
    if (status.playing) {player.pause(); return;}
    stopVoicePlayback(); const current = version.current;
    busy.current = true; setLoading(true); setError(false);
    try {
      await latest.current.beforePlay();
      if (!mounted.current || version.current !== current || !latest.current.enabled) return;
      await setAudioModeAsync({allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false});
      if (!file.current) {
        if (!FileSystem.cacheDirectory) throw new Error('No hay espacio temporal disponible.');
        const extension = p.dataUrl!.startsWith('data:audio/wav') ? 'wav' : 'm4a';
        const uri = FileSystem.cacheDirectory + 'chat-voice-' + randomUUID() + '.' + extension;
        await FileSystem.writeAsStringAsync(uri, p.dataUrl!.split(',')[1], {encoding: FileSystem.EncodingType.Base64});
        if (!mounted.current) {await FileSystem.deleteAsync(uri, {idempotent: true}); return;}
        file.current = uri; player.replace({uri});
      }
      if (!mounted.current || version.current !== current) return;
      if (status.didJustFinish || status.duration > 0 && status.currentTime >= status.duration) await player.seekTo(0);
      player.play();
    } catch {if (mounted.current) setError(true);}
    finally {busy.current = false; if (mounted.current) setLoading(false);}
  };
  return <View testID="voice-note-player" style={{maxWidth: '100%'}}>
    <VoiceNoteControls {...p} duration={status.duration || wave.duration || labelDuration(p.label)} position={status.currentTime} playing={status.playing}
      loading={loading} disabled={!p.enabled} peaks={wave.peaks} play={() => void play()}
      seek={fraction => {if (status.duration > 0) void player.seekTo(fraction * status.duration).catch(() => setError(true));}}/>
    {(error || status.error) && <Text accessibilityRole="alert" style={{color: p.isSelf ? '#fff' : '#691c32', fontSize: 12}}>No se pudo reproducir el audio.</Text>}
  </View>;
}
export const VoiceNotePlayer = React.memo(function VoiceNotePlayer(p: VoiceNotePlayerProps) {
  return isVoiceData(p.dataUrl) ? <NativePlayer {...p}/> : <Text style={{color: p.isSelf ? '#ffffffbb' : '#64748b', fontSize: 12}}>Audio anterior no disponible</Text>;
});
