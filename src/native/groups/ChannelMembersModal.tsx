import { useAppTheme, useThemeStyles } from '../profile/AppTheme';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { MessageSquareIcon, UsersIcon, XIcon } from '../icons';
import type { Channel, ChannelMember, ChannelsApi } from '../../services/channelsApi';
import { groupStyles as baseStyles } from './groupStyles';

export function ChannelMembersModal({ visible, channel, userId, api, onClose, onMessage, memberNames = {} }: {
  visible: boolean; channel: Channel | null; userId: string; api: ChannelsApi; onClose: () => void;
  onMessage: (member: ChannelMember) => Promise<boolean>;
  memberNames?: Record<string, string>;
}) {
  const styles = useThemeStyles(baseStyles);
  const { palette } = useAppTheme();
  const { height } = useWindowDimensions();
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [count, setCount] = useState(0); const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const opening = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    ++generation.current; opening.current = false; setOpeningId(null);
    return () => { ++generation.current; };
  }, [visible, channel?.id, userId, api]);
  const startMessage = async (member: ChannelMember) => {
    if (opening.current || member.id === userId) return;
    const version = generation.current;
    opening.current = true; setOpeningId(member.id);
    try { await onMessage(member); }
    catch { if (version === generation.current) setError('No se pudo abrir el chat. Intenta nuevamente.'); }
    finally {
      if (version === generation.current) { opening.current = false; setOpeningId(null); }
    }
  };
  useEffect(() => {
    let active = true; const id = channel?.id;
    setMembers([]); setCount(0); setError(null);
    if (!visible || !id) return;
    const load = async () => {
      setLoading(true);
      try {
        const result = await api.members(id);
        if (active) { setMembers(result.members); setCount(result.memberCount); setError(null); }
      } catch (cause) {
        if (active) { setMembers([]); setError(cause instanceof Error ? cause.message : 'No se pudieron consultar los miembros.'); }
      } finally { if (active) setLoading(false); }
    };
    void load(); const timer = setInterval(() => { void load(); }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [visible, channel?.id, userId, api]);
  return <Modal visible={visible && !!channel} transparent animationType="fade" onRequestClose={() => { if (!opening.current) onClose(); }}>
    <View style={styles.channelModalOverlay}><View style={[styles.channelModalCard, { maxHeight: height * 0.9 }]}>
      <View style={styles.channelModalHeader}>
        <View style={styles.channelModalHeaderLeft}>
          <View style={styles.channelModalIconBox}><UsersIcon size={20} color="#691c32" /></View>
          <View style={{ flex: 1 }}><Text style={styles.channelModalTitle} numberOfLines={1}>{channel?.name}</Text>
            <Text style={styles.channelModalSubtitle}>{count} {count === 1 ? 'miembro' : 'miembros'} • Táctico</Text></View>
        </View>
        <TouchableOpacity disabled={!!openingId} onPress={onClose} accessibilityLabel="Cerrar miembros del grupo" style={styles.channelModalCloseBtn}><XIcon size={20} color={palette.muted} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.channelMemberList}>
        {loading && members.length === 0 && <ActivityIndicator color="#691c32" />}
        {error && <Text style={styles.recoveryErrorText}>{error}</Text>}
        {members.map(member => {
          const name = memberNames[member.id] || member.name;
          return <View key={member.id} style={styles.channelMemberCard}>
          <View style={styles.channelMemberAvatar}><Text style={styles.channelMemberAvatarText}>{name.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.channelMemberInfo}>
            <Text style={styles.channelMemberName} numberOfLines={2}>{name}{member.id === userId ? ' (Tú)' : ''}</Text>
            <Text style={styles.channelMemberSubtext} numberOfLines={2}>{[member.callsign, member.unit].filter(Boolean).join(' • ')}</Text>
          </View>
          {member.id !== userId && <TouchableOpacity
            accessibilityRole="button" accessibilityLabel={`Enviar mensaje a ${name}`}
            accessibilityHint="Abre una conversación privada con este integrante"
            accessibilityState={{ disabled: !!openingId, busy: openingId === member.id }}
            disabled={!!openingId} onPress={() => { void startMessage(member); }}
            style={[styles.channelMemberMessage, !!openingId && { opacity: 0.6 }]}>
            {openingId === member.id ? <ActivityIndicator size="small" color={palette.accent} /> : <MessageSquareIcon size={20} color={palette.accent} />}
            <Text style={styles.channelMemberMessageText}>Mensaje</Text>
          </TouchableOpacity>}
        </View>; })}
        {count > members.length && !error && <Text style={styles.channelModalSubtitle}>Mostrando los primeros {members.length} de {count} miembros.</Text>}
      </ScrollView>
    </View></View>
  </Modal>;
}
