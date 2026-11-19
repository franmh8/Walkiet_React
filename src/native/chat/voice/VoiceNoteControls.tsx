import React from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {PeerAvatar} from '../../profile/PeerAvatar';
import {MicIcon} from '../../icons';
import {voiceTime} from './voiceTypes';

export function VoiceNoteControls(p: {
  isSelf: boolean; playing: boolean; loading: boolean; disabled: boolean;
  peaks: number[]; duration: number; position: number; avatarUri?: string | null;
  name: string; play: () => void; seek: (fraction: number) => void;
}) {
  const color = p.isSelf ? '#ffffff' : '#691c32', muted = p.isSelf ? '#ffffff99' : '#94a3b8';
  const fraction = p.duration > 0 ? Math.min(1, p.position / p.duration) : 0;
  return <View style={{width: 280, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 9}}>
    <View>
      <PeerAvatar uri={p.avatarUri} name={p.name} style={{width: 40, height: 40, borderRadius: 20, backgroundColor: p.isSelf ? '#ffffff20' : '#f1f5f9', alignItems: 'center', justifyContent: 'center'}}>
        <Text style={{color, fontSize: 17, fontWeight: '700'}}>{p.name.trim().slice(0, 1).toUpperCase()}</Text>
      </PeerAvatar>
      <View style={{position: 'absolute', bottom: -3, right: -3, borderRadius: 9, padding: 2, backgroundColor: p.isSelf ? '#691c32' : '#ffffff'}}><MicIcon size={13} color={muted}/></View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={p.playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'} disabled={p.disabled || p.loading} onPress={p.play}
      style={{width: 34, height: 44, alignItems: 'center', justifyContent: 'center', opacity: p.disabled ? 0.5 : 1}}>
      {p.loading ? <ActivityIndicator color={color}/> : p.playing ? <View style={{flexDirection: 'row', gap: 4}}><View style={{height: 22, width: 5, borderRadius: 1, backgroundColor: color}}/><View style={{height: 22, width: 5, borderRadius: 1, backgroundColor: color}}/></View>
        : <View style={{width: 0, height: 0, borderTopWidth: 11, borderBottomWidth: 11, borderLeftWidth: 18, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color, marginLeft: 3}}/>}
    </Pressable>
    <View style={{flex: 1, minWidth: 0}}>
      <View testID="voice-waveform" accessible accessibilityRole="adjustable" accessibilityLabel="Posición de la nota de voz"
        accessibilityValue={{min: 0, max: 100, now: Math.round(fraction * 100)}}
        accessibilityActions={[{name: 'increment', label: 'Adelantar'}, {name: 'decrement', label: 'Retroceder'}]}
        onAccessibilityAction={event => {if (!p.disabled && p.duration) p.seek(Math.max(0, Math.min(1, fraction + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))));}}
        style={{height: 32, flexDirection: 'row', alignItems: 'center', gap: 2}}>
        {p.peaks.map((peak, i) => <Pressable key={i} accessible={false} disabled={p.disabled || !p.duration} onPress={() => p.seek(i / p.peaks.length)}
          style={{flex: 1, height: '100%', justifyContent: 'center'}}><View testID={`voice-wave-bar-${i}`} style={{height: 3 + 27 * peak, borderRadius: 2, backgroundColor: i / p.peaks.length < fraction ? color : muted}}/></Pressable>)}
        <View pointerEvents="none" style={{position: 'absolute', left: `${fraction * 96}%`, width: 9, height: 9, borderRadius: 5, backgroundColor: color}}/>
      </View>
      <Text testID="voice-duration" style={{color: muted, fontSize: 11, marginTop: 1}}>{voiceTime(p.playing || p.position > 0 ? p.position : p.duration)}</Text>
    </View>
  </View>;
}
