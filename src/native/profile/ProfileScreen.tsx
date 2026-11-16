import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { ProfileIcon as Feather } from './ProfileIcon';
import { useAppTheme } from './AppTheme';
import { createProfileStyles } from './profileStyles';
import { SettingsScreen } from './SettingsScreen';
import { SecurityCodeModal } from './SecurityCodeModal';
import { pickAvatar } from './pickAvatar';
import type { AccountProfile } from './useAccountProfile';
import type { RadioNotifications } from '../ptt/useRadioNotifications';
interface CachedUser { authToken?: string; id: string; name: string; role: string; unit: string; phone_number?: string; email?: string; callsign?: string; badge?: string; }
export function ProfileScreen({ account, user, notifications, serverUrl, onLogout, onDeleted, onServerChange }: {
  account: AccountProfile; user: CachedUser; notifications: RadioNotifications; serverUrl: string;
  onLogout: () => Promise<void>; onDeleted: () => Promise<void>; onServerChange: (url: string) => Promise<void>;
}) {
  const { palette: p } = useAppTheme(); const s = useMemo(() => createProfileStyles(p), [p]);
  useEffect(() => { void account.refresh(); }, [account.refresh]);
  const [settings, setSettings] = useState(false); const [emailChange,setEmailChange]=useState(false); const [editing, setEditing] = useState<'name'|null>(null);
  const [draft, setDraft] = useState(''); const [photo, setPhoto] = useState(false); const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string|null>(null); const [notice, setNotice] = useState<string|null>(null);
  const value = account.user; const name = value?.name || user.name; const labels = { name: 'Nombre' };
  const initial = name.trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase();
  const disabled = account.busy || account.loading || !account.loaded || picking;
  const edit = (field: 'name'|'correo') => { account.clearError(); setError(null); setNotice(null); if(field==='correo'){setEmailChange(true);return;} setDraft(value?.[field] || ''); setEditing(field); };
  const save = async () => { try { await account.update({ [editing!]: draft }); setEditing(null); setNotice('Cambios guardados en tu cuenta.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.'); } };
  const choosePhoto = async (source: 'camera'|'library') => {
    setPhoto(false); setError(null); setPicking(true);
    try { const image = await pickAvatar(source); if (image) { await account.avatar(image); setNotice('Foto guardada en tu cuenta.'); } }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la foto.'); }
    finally { setPicking(false); }
  };
  const closeDelete = () => { if (!account.busy) { setDeleting(false); setPassword(''); setConfirmation(''); setError(null); } };
  const remove = async () => { setError(null); try { await account.deleteAccount(password); setPassword(''); setDeleting(false); await onDeleted(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la cuenta.'); } };
  if (settings) return <SettingsScreen account={account} notifications={notifications} serverUrl={serverUrl} onServerChange={onServerChange} onBack={() => setSettings(false)} />;
  const rows = [
    { key: 'name', label: 'Nombre', value: value?.name || user.name, editable: true },
    { key: 'phone', label: 'Número de teléfono', value: value?.phone_number || user.phone_number || 'No disponible' },
    { key: 'correo', label: 'Correo institucional', value: value ? value.correo : user.email, editable: true },
  ];
  const modal = (visible: boolean, close: () => void, children: React.ReactNode) => <Modal transparent visible={visible} animationType="fade" onRequestClose={close}><KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[s.modal, { maxHeight: '94%' }]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }}>{children}</ScrollView></View></KeyboardAvoidingView></Modal>;
  return <View style={s.screen}><ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled"><View style={s.content}>
    <View style={s.header}><Text style={s.heading}>Mi perfil</Text><TouchableOpacity accessibilityLabel="Actualizar perfil" style={s.back} disabled={account.loading || account.busy} onPress={() => { void account.refresh(); }}><Feather name="refresh-cw" size={19} color={p.muted} /></TouchableOpacity></View>
    <View style={s.hero}><TouchableOpacity accessibilityLabel="Cambiar foto de perfil" disabled={disabled} onPress={() => setPhoto(true)} style={s.avatarWrap}><View style={s.avatar}>{value?.avatar_url ? <Image source={{ uri: value.avatar_url }} accessibilityLabel="Foto de perfil" style={s.avatarImage} /> : <Text style={s.initials}>{initial}</Text>}</View><View style={s.camera}>{picking ? <ActivityIndicator color="#ffffff" size="small" /> : <Feather name="camera" size={16} color="#ffffff" />}</View></TouchableOpacity><Text style={s.name}>{name}</Text>{(value?.callsign || user.callsign || user.badge) && <Text style={s.callsign}>{value?.callsign || user.callsign || user.badge}</Text>}</View>
    {account.loading && <ActivityIndicator accessibilityLabel="Cargando perfil" color={p.accent} />}
    {(error || account.error) && !editing && !deleting && <Text accessibilityRole="alert" style={s.error}>{error || account.error}</Text>}
    {notice && <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
    <View style={s.card}>{rows.map((row, index) => <TouchableOpacity key={row.key} disabled={!row.editable || disabled} onPress={() => edit(row.key as 'name'|'correo')} accessibilityRole={row.editable ? 'button' : 'text'} accessibilityLabel={row.editable ? `Editar ${row.label}` : row.label} style={[s.row, index < rows.length-1 && s.divider]}><Text style={[s.label, { flexShrink: 1 }]}>{row.label}</Text><Text style={s.value} numberOfLines={2}>{row.value || 'Sin registrar'}</Text>{row.editable && <Text style={s.chevron}>›</Text>}</TouchableOpacity>)}</View>
    <TouchableOpacity accessibilityLabel="Configuración y ajustes" style={[s.card, s.row, { paddingVertical: 22 }]} onPress={() => { account.clearError(); setSettings(true); }}><View style={s.iconBox}><Feather name="settings" size={23} color={p.accent} /></View><View style={s.rowBody}><Text style={s.rowTitle}>Configuración y ajustes</Text><Text style={s.description} numberOfLines={1}>Tema, notificaciones y radio PTT</Text></View><Text style={s.chevron}>›</Text></TouchableOpacity>
    <TouchableOpacity accessibilityLabel="Cerrar sesión" style={s.action} disabled={account.busy} onPress={() => { void onLogout(); }}><Feather name="log-out" size={19} color={p.muted} /><Text style={s.actionText}>Cerrar sesión</Text></TouchableOpacity>
    <TouchableOpacity accessibilityLabel="Eliminar cuenta" style={[s.action, s.delete]} disabled={disabled} onPress={() => { setError(null); account.clearError(); setDeleting(true); }}><Feather name="trash-2" size={19} color={p.danger} /><Text style={[s.actionText, s.deleteText]}>Eliminar cuenta</Text></TouchableOpacity>
  </View></ScrollView>
    {modal(!!editing, () => { if (!account.busy) setEditing(null); }, <><View style={s.modalHeader}><Text style={s.modalTitle}>Editar {editing ? labels[editing].toLowerCase() : ''}</Text><TouchableOpacity accessibilityLabel="Cerrar edición del perfil" disabled={account.busy} onPress={() => setEditing(null)}><Feather name="x" size={22} color={p.muted} /></TouchableOpacity></View><TextInput accessibilityLabel={editing ? labels[editing] : 'Dato del perfil'} value={draft} onChangeText={setDraft} style={s.input} editable={!account.busy} autoCapitalize="words" autoCorrect maxLength={120} placeholderTextColor={p.muted} />{(error || account.error) && <Text accessibilityRole="alert" style={s.error}>{error || account.error}</Text>}<TouchableOpacity accessibilityLabel="Guardar cambios del perfil" disabled={account.busy || editing === 'name' && !draft.trim()} style={[s.action, s.primary, account.busy && s.disabled]} onPress={() => { void save(); }}>{account.busy && <ActivityIndicator color="#ffffff" />}<Text style={[s.actionText, s.white]}>Guardar cambios</Text></TouchableOpacity></>)}
    {modal(photo, () => setPhoto(false), <><Text style={s.modalTitle}>Foto de perfil</Text><TouchableOpacity style={s.action} onPress={() => { void choosePhoto('library'); }}><Feather name="image" size={19} color={p.accent} /><Text style={s.actionText}>Elegir de mis fotos</Text></TouchableOpacity>{Platform.OS !== 'web' && <TouchableOpacity style={s.action} onPress={() => { void choosePhoto('camera'); }}><Feather name="camera" size={19} color={p.accent} /><Text style={s.actionText}>Tomar una foto</Text></TouchableOpacity>}{value?.avatar_url && <TouchableOpacity style={s.action} onPress={() => { setPhoto(false); void account.avatar(null).catch(cause => setError(cause.message)); }}><Text style={[s.actionText, s.deleteText]}>Quitar foto</Text></TouchableOpacity>}<TouchableOpacity style={s.action} onPress={() => setPhoto(false)}><Text style={s.actionText}>Cancelar</Text></TouchableOpacity></>)}
    {modal(deleting, closeDelete, <><Text style={s.modalTitle}>Eliminar tu cuenta</Text><Text style={s.description}>Se eliminarán tu cuenta, agenda privada, foto, preferencias y sesiones. La BD también puede eliminar tus mensajes vinculados a la cuenta. Saldrás de los grupos de otras personas. Primero debes eliminar los grupos que administras.</Text><Text style={s.description}>Confirma tu contraseña y escribe ELIMINAR. Esta acción es permanente.</Text><TextInput accessibilityLabel="Contraseña para eliminar cuenta" placeholder="Contraseña actual" placeholderTextColor={p.muted} style={s.input} secureTextEntry value={password} onChangeText={setPassword} editable={!account.busy} autoCapitalize="none" /><TextInput accessibilityLabel="Confirmación ELIMINAR" placeholder="ELIMINAR" placeholderTextColor={p.muted} style={s.input} value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" editable={!account.busy} />{error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<TouchableOpacity accessibilityLabel="Confirmar eliminación de mi cuenta" disabled={account.busy || !password || confirmation !== 'ELIMINAR'} style={[s.action, s.delete, (account.busy || !password || confirmation !== 'ELIMINAR') && s.disabled]} onPress={() => { void remove(); }}>{account.busy && <ActivityIndicator color={p.danger} />}<Text style={[s.actionText, s.deleteText]}>Eliminar mi cuenta</Text></TouchableOpacity><TouchableOpacity style={s.action} disabled={account.busy} onPress={closeDelete}><Text style={s.actionText}>Cancelar</Text></TouchableOpacity></>)}
    <SecurityCodeModal visible={emailChange} mode="email" server={serverUrl} token={user.authToken || ''} onClose={()=>setEmailChange(false)} onComplete={async()=>{await account.refresh();}} />
  </View>;
}
