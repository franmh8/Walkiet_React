import { useThemeStyles } from '../profile/AppTheme';
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { UsersIcon, XIcon } from '../icons';
import type { Channel, ChannelMember, ChannelsApi } from '../../services/channelsApi';
import { groupStyles as baseStyles } from './groupStyles';

export function ChannelMembersModal({ visible, channel, userId, api, onClose }: {
  visible: boolean; channel: Channel | null; userId: string; api: ChannelsApi; onClose: () => void;
}) {
  const styles = useThemeStyles(baseStyles);
  const { height } = useWindowDimensions();
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [count, setCount] = useState(0); const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  }, [visible, channel?.id, api]);
  return <Modal visible={visible && !!channel} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.channelModalOverlay}><View style={[styles.channelModalCard, { maxHeight: height * 0.9 }]}>
      <View style={styles.channelModalHeader}>
        <View style={styles.channelModalHeaderLeft}>
          <View style={styles.channelModalIconBox}><UsersIcon size={20} color="#691c32" /></View>
          <View style={{ flex: 1 }}><Text style={styles.channelModalTitle} numberOfLines={1}>{channel?.name}</Text>
            <Text style={styles.channelModalSubtitle}>{count} {count === 1 ? 'miembro' : 'miembros'} • Táctico</Text></View>
        </View>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar miembros del grupo" style={styles.channelModalCloseBtn}><XIcon size={20} color="#64748b" /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.channelMemberList}>
        {loading && members.length === 0 && <ActivityIndicator color="#691c32" />}
        {error && <Text style={styles.recoveryErrorText}>{error}</Text>}
        {members.map(member => <View key={member.id} style={styles.channelMemberCard}>
          <View style={styles.channelMemberAvatar}><Text style={styles.channelMemberAvatarText}>{member.name.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.channelMemberInfo}>
            <Text style={styles.channelMemberName}>{member.name}{member.id === userId ? ' (Tú)' : ''}</Text>
            <Text style={styles.channelMemberSubtext}>{[member.callsign, member.unit].filter(Boolean).join(' • ')}</Text>
          </View>
        </View>)}
        {count > members.length && !error && <Text style={styles.channelModalSubtitle}>Mostrando los primeros {members.length} de {count} miembros.</Text>}
      </ScrollView>
    </View></View>
  </Modal>;
}
