import { useThemeStyles, useAppTheme } from '../profile/AppTheme';
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { AlertTriangleIcon, MicIcon, UsersIcon } from '../icons';
import { soundEngine } from '../../services/soundEngine';
import type { Channel } from '../../services/channelsApi';
import type { LiveRadio } from './useLiveRadio';
import type { RadioNotifications } from './useRadioNotifications';

export function PttScreen({ channel, radio, notifications, onGroups, onMembers, onSos, pttMode = 'hold' }: {
  pttMode?: 'hold'|'toggle'; channel: Channel | null; radio: LiveRadio; notifications: RadioNotifications;
  onGroups: () => void; onMembers: () => void; onSos: () => void;
}) {
  const styles = useThemeStyles(baseStyles); const { palette } = useAppTheme();
  const keyboardDown = useRef(false); const transmitting = useRef(false);
  const pressed = useRef(false); pressed.current = radio.pressed;
  useEffect(() => { if (transmitting.current && !radio.transmitting) soundEngine.playRogerBeep(); transmitting.current = radio.transmitting; }, [radio.transmitting]);
  useEffect(() => { if (radio.transmitting) soundEngine.playPttStart(); }, [radio.transmitting]);
  useEffect(() => () => { void radio.stop(); }, [radio.stop]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input,textarea,button,[role=button]'));
    const down = (event: KeyboardEvent) => { if (event.code === 'Space' && !typing(event.target)) { event.preventDefault(); if (!event.repeat) { keyboardDown.current = true; void (pttMode === 'toggle' && pressed.current ? radio.stop() : radio.press()); } } };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space' && keyboardDown.current) { event.preventDefault(); keyboardDown.current = false; if (pttMode === 'hold') void radio.stop(); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); if (keyboardDown.current) { keyboardDown.current = false; if (pttMode === 'hold') void radio.stop(); } };
  }, [radio.press, radio.stop, pttMode]);
  const connected = radio.state === 'connected';
  const stateText = radio.state === 'connecting' ? 'Conectando radio...' : radio.state === 'reconnecting' ? 'Recuperando conexión...' : connected ? 'Radio conectada' : 'Radio desconectada';
  const prompt = radio.starting ? (connected ? 'Preparando micrófono y turno...' : (pttMode === 'hold' ? 'Conectando al canal... Mantén presionado' : 'Conectando al canal... Toca para cancelar')) : radio.transmitting ? `Transmitiendo · ${radio.duration}s` : radio.speakers.length ? `Hablando: ${radio.speakers.join(', ')}` : pttMode === 'hold' ? 'Mantén presionado para hablar' : 'Toca para hablar; vuelve a tocar para terminar';
  return <View style={styles.screen}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.titleArea} onPress={onGroups} accessibilityLabel="Seleccionar grupo de radio">
        <Text style={styles.eyebrow}>CANAL ACTUAL</Text><Text style={styles.title} numberOfLines={2}>{channel?.name || 'Ningún grupo seleccionado'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.sos} onPress={onSos} accessibilityLabel="Llamada de Emergencia SOS"><AlertTriangleIcon size={22} color="#fff" /></TouchableOpacity>
      <TouchableOpacity style={styles.members} onPress={onMembers} disabled={!channel} accessibilityLabel={channel ? 'Ver usuarios dentro del canal' : 'No hay grupo seleccionado'}>
        <UsersIcon size={20} color="#64748b" /><Text style={styles.memberCount}>{channel?.memberCount ?? 0}</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.center}>
      {(radio.error || notifications.error) && <Text accessibilityRole="alert" style={styles.error}>{radio.error || notifications.error}</Text>}
      <Text style={[styles.prompt, radio.transmitting && styles.promptOn]} accessibilityLiveRegion="polite">{channel ? prompt : 'Crea un grupo o únete a uno para comunicarte'}</Text>
      <View style={[styles.circle, radio.transmitting && styles.circleOn]}>
        <TouchableOpacity style={[styles.button, radio.transmitting && styles.buttonOn]}
          disabled={!channel} onPressIn={() => { if (pttMode === 'hold') void radio.press(); }} onPressOut={() => { if (pttMode === 'hold') void radio.stop(); }} onPress={() => { if (pttMode === 'toggle') void (radio.pressed ? radio.stop() : radio.press()); }}
          accessibilityRole="button" accessibilityLabel={pttMode === 'hold' ? "Mantén presionado para transmitir al grupo" : "Alternar transmisión al grupo"} accessibilityState={{ disabled: !channel }}>
          {radio.starting ? <ActivityIndicator size="large" color="#691c32" /> : <MicIcon size={52} color={radio.transmitting ? '#fff' : palette.text} strokeWidth={2} />}
        </TouchableOpacity>
      </View>
      <View style={[styles.status, connected && styles.statusOn]}><View style={[styles.dot, connected && styles.dotOn]} /><Text style={styles.statusText}>{stateText}</Text></View>
      {!channel && <TouchableOpacity style={styles.action} onPress={onGroups}><Text style={styles.actionText}>Seleccionar grupo</Text></TouchableOpacity>}
      {connected && !radio.audioEnabled && <TouchableOpacity style={styles.action} onPress={() => { void radio.enableAudio(); }}><Text style={styles.actionText}>Activar audio</Text></TouchableOpacity>}
      {notifications.available && <TouchableOpacity style={styles.noticeButton} disabled={notifications.enabled || notifications.busy} onPress={() => { void notifications.enable(); }}>
        <Text style={styles.noticeText}>{notifications.busy ? 'Activando avisos...' : notifications.enabled ? 'Avisos activados en este teléfono' : 'Activar avisos de los grupos'}</Text>
      </TouchableOpacity>}
    </View>
  </View>;
}
const baseStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 8 },
  titleArea: { flex: 1 }, eyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '800', marginTop: 4 },
  sos: { backgroundColor: '#e11d48', width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  members: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, height: 44, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14 },
  memberCount: { color: '#334155', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 20 },
  prompt: { color: '#475569', fontSize: 15, fontWeight: '600', textAlign: 'center' }, promptOn: { color: '#be123c' },
  error: { alignSelf: 'stretch', color: '#9f1239', backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 1, padding: 12, borderRadius: 12, fontSize: 13 },
  circle: { width: 250, height: 250, borderRadius: 125, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  circleOn: { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
  button: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonOn: { backgroundColor: '#691c32', borderColor: '#691c32' },
  status: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 20, backgroundColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 8 },
  statusOn: { backgroundColor: '#ecfdf5' }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#94a3b8' }, dotOn: { backgroundColor: '#059669' },
  statusText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  actionText: { color: '#691c32', fontWeight: '700' }, noticeButton: { padding: 10 }, noticeText: { color: '#64748b', textAlign: 'center', fontSize: 12 },
});
