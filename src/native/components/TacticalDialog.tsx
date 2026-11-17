import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangleIcon, CheckCircleIcon, ShieldIcon, XIcon } from '../icons';
import { useAppTheme } from '../profile/AppTheme';

export type DialogTone = 'info' | 'success' | 'warning' | 'danger';
export function TacticalDialog({ visible, title, description, tone = 'info', icon, children, onClose, busy = false, closeLabel = 'Cerrar aviso', showClose = false, onDismiss }: {
  visible: boolean; title: string; description?: string; tone?: DialogTone; icon?: React.ReactNode;
  children: React.ReactNode; onClose: () => void; busy?: boolean; closeLabel?: string; showClose?: boolean; onDismiss?: () => void;
}) {
  const { palette: p, dark } = useAppTheme();
  const colors = tone === 'success' ? { color: '#059669', background: dark ? '#113b31' : '#ecfdf5', border: '#6ee7b7' }
    : tone === 'warning' ? { color: dark ? '#fbbf24' : '#b45309', background: dark ? '#443218' : '#fffbeb', border: '#fcd34d' }
    : tone === 'danger' ? { color: p.danger, background: p.dangerSoft, border: dark ? '#9f3e54' : '#fecdd3' }
    : { color: p.accent, background: p.soft, border: p.border };
  return <Modal transparent visible={visible} animationType="fade" presentationStyle="overFullScreen"
    onDismiss={onDismiss} onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.card, { backgroundColor: p.card, borderColor: dark ? p.border : '#f2c8d0' }]}
        accessibilityViewIsModal {...(Platform.OS === 'web' ? { role: 'dialog' as const, 'aria-modal': true, 'aria-label': title } : {})}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View testID="dialog-top-drop" accessible={false} pointerEvents="none" style={[styles.drop, { backgroundColor: p.soft }]} />
            <View style={[styles.badge, { backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.color }]}>
              {icon || (tone === 'success' ? <CheckCircleIcon size={33} color={colors.color} strokeWidth={2.4} />
                : tone === 'warning' || tone === 'danger' ? <AlertTriangleIcon size={31} color={colors.color} strokeWidth={2.2} />
                : <ShieldIcon size={31} color={colors.color} strokeWidth={2} />)}
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>{title}</Text>
            {!!description && <Text style={[styles.description, { color: p.muted }]}>{description}</Text>}
          </View>
          <View style={styles.body}>{children}</View>
        </ScrollView>
        {showClose && <TouchableOpacity accessibilityRole="button" accessibilityLabel={closeLabel} disabled={busy}
          onPress={onClose} hitSlop={8} style={[styles.close, { backgroundColor: p.input }, busy && styles.disabled]}><XIcon size={20} color={p.muted} /></TouchableOpacity>}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function DialogAction({ label, onPress, secondary = false, danger = false, disabled = false, busy = false, accessibilityLabel, busyLabel = 'Procesando…' }: {
  label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; busy?: boolean; accessibilityLabel?: string; busyLabel?: string;
}) {
  const { palette: p } = useAppTheme();
  const color = secondary ? p.secondary : '#ffffff';
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} activeOpacity={0.85} onPress={onPress}
    style={[styles.action, { backgroundColor: secondary ? p.input : danger ? '#be123c' : '#691c32', borderColor: secondary ? p.border : danger ? '#be123c' : '#691c32' }, (disabled || busy) && styles.disabled]}>
    {busy && <ActivityIndicator color={color} size="small" />}<Text style={[styles.actionText, { color }]}>{busy ? busyLabel : label}</Text>
  </TouchableOpacity>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 430, maxHeight: '94%', borderRadius: 26, borderWidth: 1.5, overflow: 'hidden', shadowColor: '#691c32', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  scroll: { flexGrow: 0 }, content: { paddingBottom: 24 },
  hero: { alignItems: 'center', paddingTop: 26, paddingHorizontal: 24, paddingBottom: 20, gap: 10 },
  drop: { position: 'absolute', width: 210, height: 110, top: -44, borderRadius: 58 },
  badge: { width: 66, height: 66, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, shadowOpacity: 0.12, elevation: 2 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  description: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  body: { paddingHorizontal: 24, gap: 16 },
  close: { position: 'absolute', right: 12, top: 12, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  action: { width: '100%', minHeight: 48, borderWidth: 1, borderRadius: 15, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '700', textAlign: 'center' }, disabled: { opacity: 0.5 },
});
