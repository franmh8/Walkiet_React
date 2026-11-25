import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, ActivityIndicator, Platform } from 'react-native';
import { DialogAction, TacticalDialog } from '../components/TacticalDialog';
import { ProfileIcon as Feather } from './ProfileIcon';
import { useAppTheme } from './AppTheme';
import { createProfileStyles } from './profileStyles';
import { createAccountApi, type AccountSettings } from '../../services/accountApi';
import type { AccountProfile } from './useAccountProfile';
import type { RadioNotifications } from '../ptt/useRadioNotifications';
import { soundEngine } from '../../services/soundEngine';

export function SettingsScreen({ account, notifications, serverUrl, onServerChange, onBack }: {
  account: AccountProfile; notifications: RadioNotifications; serverUrl: string; onServerChange: (url: string) => Promise<void>; onBack: () => void;
}) {
  const { palette: p } = useAppTheme(); const s = useMemo(() => createProfileStyles(p), [p]);
  const [error, setError] = useState<string | null>(null); const [draft, setDraft] = useState(serverUrl);
  const [checking, setChecking] = useState(false); const [connection, setConnection] = useState<string | null>(null); const [confirm, setConfirm] = useState(false);
  const [advanced, setAdvanced] = useState(false); const settings = account.settings;
  const blocked = account.busy || account.loading || !account.loaded;
  const save = async (patch: Partial<AccountSettings>) => { setError(null); try { await account.saveSettings(patch); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); } };
  const changeNotifications = async (enabled: boolean) => {
    setError(null);
    let changed = false;
    try {
      const ok = enabled ? await notifications.enable() : await notifications.disable();
      if (ok) { changed = true; await account.saveSettings({ backgroundNotifications: enabled }); }
    } catch (cause) {
      if (changed) { if (enabled) await notifications.disable(); else await notifications.enable(); }
      setError(cause instanceof Error ? cause.message : 'No se pudieron cambiar los avisos.');
    }
  };
  const cleanUrl = () => {
    const value = draft.trim().replace(/\/+$/, ''); const url = new URL(value);
    const local = /^(localhost|127\.0\.0\.1|10\.[\d.]+|192\.168\.[\d.]+|172\.(1[6-9]|2\d|3[01])\.[\d.]+)$/.test(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local) || url.username || url.password || url.search || url.hash) throw new Error('Usa una URL HTTPS válida. HTTP solo está disponible para un servidor local de pruebas.');
    return value;
  };
  const testConnection = async () => {
    setChecking(true); setConnection(null); setError(null);
    try { const ms = await createAccountApi(cleanUrl(), '').health(); setConnection(`Conexión disponible · ${ms} ms`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo comprobar la conexión.'); }
    finally { setChecking(false); }
  };
  const themes = [{ key: 'light', label: 'Claro', icon: 'sun' }, { key: 'dark', label: 'Oscuro', icon: 'moon' }, { key: 'system', label: 'Sistema', icon: 'monitor' }] as const;
  return <View style={s.screen}><ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><View style={s.content}>
    <View style={s.header}><TouchableOpacity style={s.back} onPress={onBack} accessibilityLabel="Volver al perfil"><Feather name="arrow-left" size={21} color={p.text} /></TouchableOpacity><Text style={[s.heading, { fontSize: 23 }]}>Ajustes</Text></View>
    {(error || account.error || notifications.error) && <Text style={s.error} accessibilityRole="alert">{error || account.error || notifications.error}</Text>}
    {!account.loaded && !account.loading && <TouchableOpacity accessibilityRole="button" style={s.action} onPress={() => { void account.refresh(); }}><Text style={s.actionText}>Reintentar ajustes</Text></TouchableOpacity>}
    <View style={[s.card, s.settingsCard]}>
      <View style={s.sectionTitle}><Feather name="sun" size={21} color={p.accent} /><Text style={s.sectionText}>Tema</Text></View>
      <View style={s.themeRow}>{themes.map(theme => <TouchableOpacity key={theme.key} disabled={blocked} accessibilityRole="radio" accessibilityLabel={`Tema ${theme.label}`} accessibilityState={{ checked: settings.theme === theme.key, disabled: blocked }} aria-checked={settings.theme === theme.key} onPress={() => { void save({ theme: theme.key }); }} style={[s.themeOption, settings.theme === theme.key && s.selected]}><Feather name={theme.icon} size={24} color={settings.theme === theme.key ? p.accent : p.secondary} /><Text style={[s.themeText, settings.theme === theme.key && s.selectedText]}>{theme.label}</Text></TouchableOpacity>)}</View>
    </View>
    <View style={[s.card, s.settingsCard]}>
      <View style={s.sectionTitle}><Feather name="eye" size={21} color={p.accent} /><Text style={s.sectionText}>Privacidad</Text></View>
      <View style={s.settingRow}><View style={s.rowBody}><Text style={s.label}>Mostrar última conexión</Text><Text style={s.description}>Comparte cuándo usaste la app. No oculta «en línea».</Text></View><Switch accessibilityLabel="Mostrar última conexión" value={settings.showLastSeen} disabled={blocked} onValueChange={value => { void save({ showLastSeen: value }); }} trackColor={{ false: p.border, true: p.control }} thumbColor="#ffffff" {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff', style: { height: 30, width: 52 } } : {})} /></View>
      <View style={s.rule} />
      <View style={s.settingRow}><View style={s.rowBody}><Text style={s.label}>Confirmaciones de lectura</Text><Text style={s.description}>Muestra las palomitas verdes al leer.</Text></View><Switch accessibilityLabel="Confirmaciones de lectura" value={settings.readReceipts} disabled={blocked} onValueChange={value => { void save({ readReceipts: value }); }} trackColor={{ false: p.border, true: p.control }} thumbColor="#ffffff" {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff', style: { height: 30, width: 52 } } : {})} /></View>
    </View>
    <View style={[s.card, s.settingsCard]}>
      <View style={s.sectionTitle}><Feather name="image" size={21} color={p.accent} /><Text style={s.sectionText}>Fotos del chat</Text></View>
      <View style={s.settingRow}><View style={s.rowBody}><Text style={s.label}>Guardar fotos automáticamente</Text><Text style={s.description}>{Platform.OS === 'web' ? 'Aplica en la galería del teléfono.' : 'Guarda fotos nuevas en tu galería.'}</Text></View><Switch accessibilityLabel="Guardar fotos automáticamente" value={settings.autoSavePhotos} disabled={blocked} onValueChange={value => { void save({ autoSavePhotos: value }); }} trackColor={{ false: p.border, true: p.control }} thumbColor="#ffffff" {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff', style: { height: 30, width: 52 } } : {})} /></View>
    </View>
    <View style={[s.card, s.settingsCard]}>
      <View style={s.sectionTitle}><Feather name="bell" size={21} color={p.accent} /><Text style={s.sectionText}>Notificaciones</Text></View>
      <View style={s.settingRow}><View style={s.rowBody}><Text style={s.label}>{Platform.OS === 'web' ? 'Avisos del navegador' : 'Avisos de grupos'}</Text><Text style={s.description}>{Platform.OS === 'web' ? 'Actividad de radio con esta página abierta.' : 'Avisos de actividad en tus grupos.'}</Text></View><Switch accessibilityLabel="Activar notificaciones" value={settings.backgroundNotifications} disabled={blocked || notifications.busy || !notifications.available && !settings.backgroundNotifications} onValueChange={value => { void changeNotifications(value); }} trackColor={{ false: p.border, true: p.control }} thumbColor="#ffffff" {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff', style: { height: 30, width: 52 } } : {})} /></View>
      {!notifications.available && <Text style={s.description}>{notifications.unavailableReason}</Text>}
      <View style={s.rule} />
      <View style={s.settingRow}><View style={s.rowBody}><Text style={s.label}>Sonidos de mensajes</Text><Text style={s.description}>Aviso al recibir mensajes.</Text></View><TouchableOpacity style={s.sample} accessibilityRole="button" accessibilityLabel="Probar sonido de mensaje" disabled={blocked || !settings.messageSounds} accessibilityState={{disabled: blocked || !settings.messageSounds}} onPress={() => soundEngine.playIncomingChirp()}><Feather name="play" size={17} color={p.muted} /></TouchableOpacity><Switch accessibilityLabel="Sonidos de mensajes" value={settings.messageSounds} disabled={blocked} onValueChange={value => { void save({ messageSounds: value }); }} trackColor={{ false: p.border, true: p.control }} thumbColor="#ffffff" {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff', style: { height: 30, width: 52 } } : {})} /></View>
    </View>
    <View style={[s.card, s.settingsCard]}>
      <View style={s.sectionTitle}><Feather name="mic" size={21} color={p.accent} /><Text style={s.sectionText}>Radio PTT</Text></View>
      <View style={[s.settingRow, { flexWrap: 'wrap' }]}><View style={[s.rowBody, { minWidth: 150 }]}><Text style={[s.label, { flexShrink: 1 }]}>Botón para hablar</Text><Text style={s.description}>{settings.pttMode === 'hold' ? 'Mantén pulsado para hablar.' : 'Toca para iniciar y terminar.'}</Text></View><View style={s.segments}>{(['hold','toggle'] as const).map(mode => <TouchableOpacity disabled={blocked} key={mode} accessibilityRole="radio" accessibilityLabel={mode === 'hold' ? 'PTT Mantener' : 'PTT Alternar'} accessibilityState={{ checked: settings.pttMode === mode }} aria-checked={settings.pttMode === mode} style={[s.segment, settings.pttMode === mode && s.segmentActive]} onPress={() => { void save({ pttMode: mode }); }}><Text style={[s.segmentText, settings.pttMode === mode && s.segmentTextActive]}>{mode === 'hold' ? 'Mantener' : 'Alternar'}</Text></TouchableOpacity>)}</View></View>
      <View style={s.rule} />
      <View style={s.settingRow}><View style={s.rowBody}><Text style={s.label}>Tono Roger Beep</Text><Text style={s.description}>Pitido al terminar tu transmisión.</Text></View><TouchableOpacity style={s.sample} accessibilityRole="button" accessibilityLabel="Probar Roger Beep" disabled={blocked || !settings.rogerBeep} accessibilityState={{disabled: blocked || !settings.rogerBeep}} onPress={() => soundEngine.playRogerBeep()}><Feather name="volume-2" size={19} color={p.accent} /></TouchableOpacity><Switch accessibilityLabel="Tono Roger Beep" value={settings.rogerBeep} disabled={blocked} onValueChange={value => { void save({ rogerBeep: value }); }} trackColor={{ false: p.border, true: p.control }} thumbColor="#ffffff" {...(Platform.OS === 'web' ? { activeThumbColor: '#ffffff', style: { height: 30, width: 52 } } : {})} /></View>

    </View>
    <View style={[s.card, s.settingsCard]}>
      <TouchableOpacity style={s.sectionTitle} accessibilityLabel="Mostrar ajustes del servidor" onPress={() => setAdvanced(value => !value)}><Feather name="server" size={20} color={p.muted} /><Text style={s.sectionText}>Servidor</Text><Feather name={advanced ? 'chevron-up' : 'chevron-down'} size={21} color={p.muted} /></TouchableOpacity>
      {advanced && <><Text style={s.description}>Cambiar de servidor cierra tu sesión.</Text><TextInput accessibilityLabel="URL del servidor" style={s.input} value={draft} onChangeText={value => { setDraft(value); setConnection(null); }} placeholder="https://tu-servidor" placeholderTextColor={p.muted} autoCapitalize="none" autoCorrect={false} /><TouchableOpacity disabled={checking} style={s.action} onPress={() => { void testConnection(); }}>{checking ? <ActivityIndicator color={p.accent} /> : <Feather name="wifi" size={18} color={p.accent} />}<Text style={s.actionText}>Probar conexión</Text></TouchableOpacity>{connection && <Text accessibilityRole="status" style={s.description}>{connection}</Text>}{draft.trim().replace(/\/+$/, '') !== serverUrl.replace(/\/+$/, '') && <TouchableOpacity style={s.action} onPress={() => { try { cleanUrl(); setConfirm(true); } catch { setError('Ingresa una URL HTTPS válida o la dirección de tu servidor local.'); } }}><Text style={s.actionText}>Cambiar servidor</Text></TouchableOpacity>}</>}
    </View>
    <Text style={s.notice}>{account.busy ? 'Guardando…' : account.loaded ? (account.error || error ? 'Cambio sin aplicar' : 'Guardado') : 'Ajustes sin cargar'}</Text>
  </View></ScrollView>
  <TacticalDialog visible={confirm} title="Cambiar de servidor" icon={<Feather name="server" size={30} color={p.accent}/>}
    onClose={() => setConfirm(false)} showClose>
    <Text style={s.description}>Se cerrará tu sesión actual. Iniciarás sesión de nuevo en:</Text><Text style={s.label}>{draft}</Text>
    <DialogAction label="Cambiar y cerrar sesión" onPress={() => { setConfirm(false); void onServerChange(cleanUrl()).catch(() => setError('No se pudo guardar el nuevo servidor.')); }} />
    <DialogAction label="Cancelar" secondary onPress={() => setConfirm(false)} />
  </TacticalDialog>
  </View>;
}
