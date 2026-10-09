import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Alert,
  Platform,
  Modal,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRadio } from '../context/RadioContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Contact } from '../types';
import {
  Mic,
  AlertTriangle,
  Users,
  Wifi,
  X,
  Plus,
} from 'lucide-react-native';
import { SosAlertModal } from '../components/SosAlertModal';

export function PttScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const {
    selectedChannel,
    isTransmitting,
    startTransmitting,
    stopTransmitting,
    channels,
  } = useRadio();

  // Modal de usuarios / miembros del canal (Imagen 3)
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [contactsList, setContactsList] = useState<Contact[]>([]);

  // Modal de Alerta de Emergencia SOS (idéntico a la versión web)
  const [sosModalVisible, setSosModalVisible] = useState(false);

  // Contador de transmisión en segundos (Timer PTT)
  const [txSeconds, setTxSeconds] = useState(0);

  // Animaciones para PTT
  const pingAnim1 = useRef(new Animated.Value(0)).current;
  const pingAnim2 = useRef(new Animated.Value(0)).current;
  const pulseDotAnim = useRef(new Animated.Value(1)).current;

  // Cargar contactos para la lista de miembros del canal
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('c5i_contacts');
        if (stored) {
          setContactsList(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Error cargando contactos:', e);
      }
    })();
  }, [membersModalVisible]);

  // Manejar el timer de transmisión
  useEffect(() => {
    let timer: any;
    if (isTransmitting) {
      setTxSeconds(0);
      timer = setInterval(() => {
        setTxSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTxSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTransmitting]);

  // Animaciones de radar/ping continuo cuando se transmite
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    let dotLoop: Animated.CompositeAnimation | null = null;

    if (isTransmitting) {
      pingAnim1.setValue(0);
      pingAnim2.setValue(0);

      animLoop = Animated.loop(
        Animated.parallel([
          Animated.timing(pingAnim1, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(pingAnim2, {
              toValue: 1,
              duration: 1500,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      dotLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseDotAnim, {
            toValue: 0.25,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseDotAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );

      animLoop.start();
      dotLoop.start();
    } else {
      pingAnim1.setValue(0);
      pingAnim2.setValue(0);
      pulseDotAnim.setValue(1);
    }

    return () => {
      if (animLoop) animLoop.stop();
      if (dotLoop) dotLoop.stop();
    };
  }, [isTransmitting, pingAnim1, pingAnim2, pulseDotAnim]);

  const handleSosTrigger = () => {
    setSosModalVisible(true);
  };

  const channelTitle = selectedChannel
    ? selectedChannel.name
    : channels.length === 0
    ? 'Sin canales (Toca para ...'
    : 'Selecciona un canal';

  const memberCount = selectedChannel?.member_count || (channels.length === 0 ? 0 : 1);

  // Escalas y opacidades para los aros expansivos de animación
  const ringScale1 = pingAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });
  const ringOpacity1 = pingAnim1.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.7, 0.25, 0],
  });

  const ringScale2 = pingAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });
  const ringOpacity2 = pingAnim2.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.55, 0.15, 0],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* TOP BAR: CANAL ACTUAL, BOTÓN SOS (SÓLO ÍCONO) & BOTÓN MIEMBROS */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.navigate('Grupos')}
          style={styles.channelTitleWrapper}
        >
          <Text style={[styles.channelLabel, { color: colors.textMuted }]}>
            CANAL ACTUAL
          </Text>
          <Text
            style={[styles.channelTitle, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {channelTitle}
          </Text>
        </Pressable>

        {/* Acciones superiores: SOS (solo icono) y Píldora de miembros */}
        <View style={styles.topActions}>
          {/* Botón SOS: Idéntico a la versión móvil web (sólo icono de alerta) */}
          <Pressable
            onPress={handleSosTrigger}
            style={styles.sosIconButton}
            android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true }}
          >
            <AlertTriangle
              color="#ffffff"
              size={18}
              fill="rgba(255,255,255,0.25)"
            />
          </Pressable>

          {/* Botón Contador de Miembros: Abre modal de usuarios del canal */}
          <Pressable
            onPress={() => setMembersModalVisible(true)}
            style={[
              styles.membersPill,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <Users color={colors.textSecondary} size={15} />
            <Text style={[styles.membersText, { color: colors.text }]}>
              {memberCount}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ÁREA CENTRAL: PROMPT CON TIMER, BOTÓN PTT CON ANIMACIÓN & PÍLDORA WI-FI */}
      <View style={styles.centerArea}>
        {/* Indicador de estado y Timer */}
        <View style={styles.promptWrapper}>
          {isTransmitting ? (
            <View style={styles.promptRow}>
              <Animated.View
                style={[
                  styles.transmittingDot,
                  { opacity: pulseDotAnim },
                ]}
              />
              <Text style={styles.transmittingText}>
                Transmitiendo ({txSeconds.toString().padStart(2, '0')}s)...
              </Text>
            </View>
          ) : (
            <View style={styles.promptRow}>
              <View style={styles.idleDot} />
              <Text style={[styles.idleText, { color: colors.textSecondary }]}>
                Mantén presionado para hablar
              </Text>
            </View>
          )}
        </View>

        {/* Botón PTT con aros concéntricos y animación reactiva */}
        <View style={styles.pttCircleWrapper}>
          {/* Aros de animación de radar (ondas expansivas durante la transmisión) */}
          {isTransmitting && (
            <>
              <Animated.View
                style={[
                  styles.pingRing,
                  {
                    transform: [{ scale: ringScale1 }],
                    opacity: ringOpacity1,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pingRing,
                  {
                    transform: [{ scale: ringScale2 }],
                    opacity: ringOpacity2,
                  },
                ]}
              />
            </>
          )}

          {/* Aro Exterior */}
          <View
            style={[
              styles.pttOuterRing,
              {
                backgroundColor: isTransmitting
                  ? isDark
                    ? '#1e1017'
                    : '#fff1f2'
                  : colors.pttOuterBg,
                borderColor: isTransmitting
                  ? '#f43f5e'
                  : colors.pttOuterBorder,
                shadowColor: isDark ? '#000000' : '#64748b',
              },
              isTransmitting && styles.pttOuterRingTransmitting,
            ]}
          >
            {/* Botón Interior PTT */}
            <Pressable
              onPressIn={startTransmitting}
              onPressOut={stopTransmitting}
              style={({ pressed }) => [
                styles.pttInnerButton,
                {
                  backgroundColor: isTransmitting || pressed
                    ? '#be123c'
                    : colors.pttInnerBg,
                  borderColor: isTransmitting || pressed
                    ? '#f43f5e'
                    : colors.pttInnerBorder,
                },
                (isTransmitting || pressed) && styles.pttInnerActive,
              ]}
            >
              <Mic
                color={
                  isTransmitting
                    ? '#ffffff'
                    : isDark
                    ? '#cbd5e1'
                    : '#334155'
                }
                size={54}
                strokeWidth={1.8}
              />
            </Pressable>
          </View>
        </View>

        {/* Píldora de Conectividad Wi-Fi */}
        <View
          style={[
            styles.networkPill,
            {
              backgroundColor: colors.pillBg,
              borderColor: colors.pillBorder,
            },
          ]}
        >
          <Wifi color={colors.pillText} size={14} />
          <Text style={[styles.networkPillText, { color: colors.pillText }]}>
            Conectado (Wi-Fi)
          </Text>
        </View>
      </View>

      {/* MODAL DE MIEMBROS / USUARIOS DEL CANAL (EXACTO A IMAGEN 3) */}
      <Modal
        visible={membersModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMembersModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            {/* Header del Modal */}
            <View
              style={[
                styles.modalHeader,
                {
                  borderBottomColor: colors.border,
                  backgroundColor: isDark ? '#0c121e' : '#f8fafc',
                },
              ]}
            >
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalIconWrap,
                    {
                      backgroundColor: isDark
                        ? 'rgba(235, 82, 124, 0.15)'
                        : '#fff1f2',
                      borderColor: isDark
                        ? 'rgba(235, 82, 124, 0.3)'
                        : '#fecdd3',
                    },
                  ]}
                >
                  <Users
                    color={isDark ? '#eb527c' : '#8a1a36'}
                    size={20}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.modalTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {selectedChannel ? selectedChannel.name : 'Canal Táctico'}
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                    {memberCount} {memberCount === 1 ? 'usuario activo' : 'usuarios activos'} •{' '}
                    <Text style={{ textTransform: 'capitalize' }}>
                      {selectedChannel?.category || 'General'}
                    </Text>
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => setMembersModalVisible(false)}
                style={styles.modalCloseIconBtn}
              >
                <X color={colors.textMuted} size={20} />
              </Pressable>
            </View>

            {/* Lista de Miembros */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Tarjeta del Usuario Actual (Tú) */}
              <View
                style={[
                  styles.memberCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(138, 26, 54, 0.15)'
                      : '#fff1f2',
                    borderColor: isDark
                      ? 'rgba(235, 82, 124, 0.35)'
                      : '#fecdd3',
                  },
                ]}
              >
                <View style={styles.memberCardLeft}>
                  {/* Avatar con punto de estado verde */}
                  <View style={styles.avatarWrapper}>
                    <View
                      style={[
                        styles.avatarBox,
                        {
                          backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                          borderColor: isDark ? '#334155' : '#cbd5e1',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          { color: isDark ? '#f8fafc' : '#334155' },
                        ]}
                      >
                        {(user?.name || 'F').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.onlineDot} />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.memberNameRow}>
                      <Text
                        style={[styles.memberName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {user?.name || 'Francisco'} (Tú)
                      </Text>
                      <View style={styles.meBadge}>
                        <Text style={styles.meBadgeText}>TÚ</Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.memberMeta, { color: colors.textMuted }]}
                      numberOfLines={1}
                    >
                      <Text
                        style={{
                          color: isDark ? '#eb527c' : '#8a1a36',
                          fontWeight: '700',
                        }}
                      >
                        {user?.callsign || 'RADIO-8448'}
                      </Text>{' '}
                      • {user?.unit || 'Sector Operativo'}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.roleBadge,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.roleText, { color: colors.textSecondary }]}>
                    Operador
                  </Text>
                </View>
              </View>

              {/* Otros Contactos Guardados */}
              {contactsList.map((contact) => (
                <View
                  key={contact.id}
                  style={[
                    styles.memberCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.memberCardLeft}>
                    <View style={styles.avatarWrapper}>
                      <View
                        style={[
                          styles.avatarBox,
                          {
                            backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                            borderColor: isDark ? '#334155' : '#cbd5e1',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarText,
                            { color: isDark ? '#f8fafc' : '#334155' },
                          ]}
                        >
                          {contact.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.onlineDot} />
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[styles.memberName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {contact.name}
                      </Text>
                      <Text
                        style={[styles.memberMeta, { color: colors.textMuted }]}
                        numberOfLines={1}
                      >
                        <Text
                          style={{
                            color: isDark ? '#eb527c' : '#8a1a36',
                            fontWeight: '600',
                          }}
                        >
                          {contact.callsign || 'PATRULLA'}
                        </Text>{' '}
                        • {contact.unit || 'Oficial Conectado'}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.roleBadge,
                      {
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.roleText, { color: colors.textSecondary }]}>
                      Oficial
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Footer del Modal */}
            <View
              style={[
                styles.modalFooter,
                {
                  borderTopColor: colors.border,
                  backgroundColor: isDark ? '#0c121e' : '#f8fafc',
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  setMembersModalVisible(false);
                  navigation.navigate('Contactos');
                }}
                style={styles.manageContactsBtn}
              >
                <Plus color={isDark ? '#eb527c' : '#8a1a36'} size={15} />
                <Text
                  style={[
                    styles.manageContactsText,
                    { color: isDark ? '#eb527c' : '#8a1a36' },
                  ]}
                >
                  Gestionar Contactos
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMembersModalVisible(false)}
                style={[
                  styles.closeModalBtn,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.closeModalBtnText,
                    { color: isDark ? '#f8fafc' : '#334155' },
                  ]}
                >
                  Cerrar
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE ALERTA DE EMERGENCIA SOS (IDÉNTICO A LA VERSIÓN WEB) */}
      <SosAlertModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        channelId={selectedChannel?.id}
        channelName={selectedChannel?.name}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 14 : 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  channelTitleWrapper: {
    flex: 1,
    marginRight: 12,
  },
  channelLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  channelTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Botón SOS: Sólo icono en squircle, idéntico a versión móvil web
  sosIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#e11d48', // rose-600
    borderWidth: 1,
    borderColor: '#fda4af',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  membersPill: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  membersText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  promptWrapper: {
    marginBottom: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  idleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981', // emerald-500
  },
  idleText: {
    fontSize: 13,
    fontWeight: '500',
  },
  transmittingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#f43f5e',
  },
  transmittingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e11d48',
  },
  pttCircleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Aros de animación de radar expansivo
  pingRing: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  pttOuterRing: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  pttOuterRingTransmitting: {
    borderWidth: 2,
  },
  pttInnerButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  pttInnerActive: {
    transform: [{ scale: 0.95 }],
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginTop: 34,
  },
  networkPillText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* MODAL DE MIEMBROS (IMAGEN 3) */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalCloseIconBtn: {
    padding: 6,
    marginLeft: 8,
  },
  modalBody: {
    padding: 16,
    maxHeight: 280,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 8,
  },
  memberCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 13,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  meBadge: {
    backgroundColor: '#691c32',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  meBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  memberMeta: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  manageContactsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  manageContactsText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
  },
  closeModalBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
