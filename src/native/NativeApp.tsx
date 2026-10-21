import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tipos para React Native
interface User {
  id: string;
  name: string;
  badge: string;
  role: string;
  unit: string;
}

interface Channel {
  id: string;
  name: string;
  code: string;
  frequency: string;
  category: string;
  isEncrypted: boolean;
  activeUsers: number;
}

interface Transmission {
  id: string;
  sender: string;
  badge: string;
  channel: string;
  timestamp: string;
  duration: number;
  type: 'voice' | 'sos' | 'text';
  text?: string;
}

const DEFAULT_CHANNELS: Channel[] = [
  { id: 'ch-alfa', name: 'Alfa-10 Central', code: 'CH-10', frequency: '154.800 MHz', category: 'Comando', isEncrypted: true, activeUsers: 14 },
  { id: 'ch-bravo', name: 'Bravo-20 Operativos', code: 'CH-20', frequency: '155.125 MHz', category: 'Operativo', isEncrypted: true, activeUsers: 8 },
  { id: 'ch-charlie', name: 'Charlie-30 Vialidad', code: 'CH-30', frequency: '153.950 MHz', category: 'Tránsito', isEncrypted: true, activeUsers: 5 },
  { id: 'ch-delta', name: 'Delta-90 Emergencias', code: 'CH-90', frequency: '156.200 MHz', category: 'Emergencia', isEncrypted: true, activeUsers: 22 },
];

export default function NativeApp() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [identifier, setIdentifier] = useState('7711234567');
  const [password, setPassword] = useState('123');
  const [currentTab, setCurrentTab] = useState<'PTT' | 'CANALES' | 'MENSAJES' | 'AJUSTES'>('PTT');
  
  // Radio & PTT State
  const [selectedChannel, setSelectedChannel] = useState<Channel>(DEFAULT_CHANNELS[0]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [txDuration, setTxDuration] = useState(0);
  const [signalStrength] = useState(94);
  const [batteryLevel] = useState(88);
  const [serverUrl, setServerUrl] = useState('http://walkt.gt.tc');
  const [dbStatus] = useState<'ONLINE' | 'CONNECTING' | 'OFFLINE'>('ONLINE');
  const [isSosActive, setIsSosActive] = useState(false);
  
  // History & Messages
  const [transmissions, setTransmissions] = useState<Transmission[]>([
    { id: '1', sender: 'C5i Central', badge: 'CTR-01', channel: 'Alfa-10 Central', timestamp: '10:14', duration: 3, type: 'voice' },
    { id: '2', sender: 'Patrulla P-204', badge: 'PAT-204', channel: 'Alfa-10 Central', timestamp: '10:18', duration: 4, type: 'voice' },
    { id: '3', sender: 'Oficial Morales', badge: 'OF-104', channel: 'Alfa-10 Central', timestamp: '10:20', duration: 2, type: 'text', text: '10-4 Unidad en posición de vigilancia' },
  ]);
  const [messageInput, setMessageInput] = useState('');

  const timerRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem('c5i_native_user');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
        
        const savedUrl = await AsyncStorage.getItem('c5i_native_server_url');
        if (savedUrl) setServerUrl(savedUrl);
      } catch (e) {
        console.log('Error reading storage', e);
      }
    })();
  }, []);

  const handlePttPressIn = () => {
    setIsTransmitting(true);
    setTxDuration(0);
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate(60);
      } catch {}
    }
    timerRef.current = setInterval(() => {
      setTxDuration((prev) => prev + 1);
    }, 1000);
  };

  const handlePttPressOut = () => {
    if (!isTransmitting) return;
    setIsTransmitting(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate([0, 30, 40, 30]);
      } catch {}
    }

    if (txDuration > 0 && currentUser) {
      const newTx: Transmission = {
        id: Date.now().toString(),
        sender: currentUser.name,
        badge: currentUser.badge,
        channel: selectedChannel.name,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: txDuration,
        type: 'voice',
      };
      setTransmissions((prev) => [newTx, ...prev]);
    }
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Acceso Requerido', 'Ingresa tu identificador policial y contraseña');
      return;
    }
    const user: User = {
      id: identifier,
      name: identifier === '7711234567' ? 'Oficial Morales G.' : `Oficial ${identifier.slice(-4)}`,
      badge: 'OF-' + (identifier.slice(-3) || '104'),
      role: 'Elemento Táctico',
      unit: 'Patrulla P-204',
    };
    setCurrentUser(user);
    try {
      await AsyncStorage.setItem('c5i_native_user', JSON.stringify(user));
    } catch {}
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    try {
      await AsyncStorage.removeItem('c5i_native_user');
    } catch {}
  };

  const handleTriggerSos = () => {
    Alert.alert(
      '🚨 ALERTA DE EMERGENCIA C5i',
      '¿Confirmas la activación inmediata de código SOS / 10-33 con transmisión de coordenadas a toda la red?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'ACTIVAR SOS',
          style: 'destructive',
          onPress: () => {
            setIsSosActive(true);
            if (Platform.OS !== 'web') {
              try { Vibration.vibrate([0, 500, 200, 500]); } catch {}
            }
            const sosTx: Transmission = {
              id: Date.now().toString(),
              sender: currentUser?.name || 'Unidad Táctica',
              badge: currentUser?.badge || 'SOS-911',
              channel: 'Delta-90 Emergencias',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              duration: 1,
              type: 'sos',
              text: '🚨 ALERTA SOS ACTIVA - Oficial requiere apoyo inmediato en coordenadas C5i',
            };
            setTransmissions((prev) => [sosTx, ...prev]);
          },
        },
      ]
    );
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    const newMsg: Transmission = {
      id: Date.now().toString(),
      sender: currentUser?.name || 'Oficial',
      badge: currentUser?.badge || 'OF-104',
      channel: selectedChannel.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 1,
      type: 'text',
      text: messageInput.trim(),
    };
    setTransmissions((prev) => [newMsg, ...prev]);
    setMessageInput('');
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginCard}>
          <View style={styles.shieldBadge}>
            <Text style={styles.shieldIcon}>🛡️</Text>
          </View>
          <Text style={styles.loginTitle}>C5i HIDALGO</Text>
          <Text style={styles.loginSubtitle}>SISTEMA DE COMUNICACIONES TÁCTICAS PTT</Text>
          <Text style={styles.loginDbInfo}>Base de datos: if0_42687378_walkt (MySQL)</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>IDENTIFICADOR O TELÉFONO</Text>
            <TextInput
              style={styles.textInput}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Ej. 7711234567"
              placeholderTextColor="#556987"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PIN / CONTRASEÑA TÁCTICA</Text>
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Contraseña"
              placeholderTextColor="#556987"
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.8}>
            <Text style={styles.loginBtnText}>INICIAR ENLACE ENCRIPTADO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.demoBtn}
            onPress={() => {
              setIdentifier('7711234567');
              setPassword('123');
              handleLogin();
            }}
          >
            <Text style={styles.demoBtnText}>⚡ ACCESO RÁPIDO OPERADOR (DEMO)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>C5i WALKIE-TALKIE</Text>
          <Text style={styles.headerSubtitle}>
            {currentUser.badge} • {currentUser.name}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: dbStatus === 'ONLINE' ? '#10b981' : '#f59e0b' }]} />
            <Text style={styles.statusText}>{selectedChannel.code}</Text>
          </View>
        </View>
      </View>

      {isSosActive && (
        <TouchableOpacity style={styles.sosBanner} onPress={() => setIsSosActive(false)}>
          <Text style={styles.sosBannerText}>🚨 ALERTA SOS ACTIVA - PULSA PARA CANCELAR</Text>
        </TouchableOpacity>
      )}

      <View style={styles.mainContent}>
        {currentTab === 'PTT' && (
          <View style={styles.pttContainer}>
            <View style={styles.radioDisplay}>
              <View style={styles.displayHeader}>
                <Text style={styles.channelLabel}>CANAL SINTONIZADO</Text>
                <Text style={styles.freqLabel}>{selectedChannel.frequency}</Text>
              </View>
              <Text style={styles.channelName}>{selectedChannel.name}</Text>
              
              <View style={styles.metricsRow}>
                <Text style={styles.metricItem}>🔒 AES-256 ENCRYPTED</Text>
                <Text style={styles.metricItem}>📶 SEÑAL {signalStrength}%</Text>
                <Text style={styles.metricItem}>🔋 {batteryLevel}%</Text>
              </View>

              {isTransmitting ? (
                <View style={styles.txAlert}>
                  <View style={styles.txLiveDot} />
                  <Text style={styles.txText}>TRANSMITIENDO EN VIVO ({txDuration}s)</Text>
                </View>
              ) : (
                <View style={styles.standbyAlert}>
                  <Text style={styles.standbyText}>EN ESPERA • CANAL LIBRE</Text>
                </View>
              )}
            </View>

            <View style={styles.pttButtonWrapper}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPressIn={handlePttPressIn}
                onPressOut={handlePttPressOut}
                style={[
                  styles.pttButton,
                  isTransmitting && styles.pttButtonActive,
                ]}
              >
                <View style={[styles.pttInnerCircle, isTransmitting && styles.pttInnerCircleActive]}>
                  <Text style={styles.pttMicIcon}>{isTransmitting ? '🎙️' : '📻'}</Text>
                  <Text style={styles.pttMainText}>{isTransmitting ? 'TRANSMITIENDO' : 'PULSAR PARA HABLAR'}</Text>
                  <Text style={styles.pttSubText}>{isTransmitting ? 'Suelta para escuchar' : 'PUSH TO TALK (PTT)'}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.sosButton}
                onPress={handleTriggerSos}
                activeOpacity={0.8}
              >
                <Text style={styles.sosButtonText}>🚨 BOTÓN SOS / PÁNICO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickRogerBtn}
                onPress={() => {
                  const quickTx: Transmission = {
                    id: Date.now().toString(),
                    sender: currentUser.name,
                    badge: currentUser.badge,
                    channel: selectedChannel.name,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    duration: 1,
                    type: 'text',
                    text: '10-4 ENTERADO Y COPIADO',
                  };
                  setTransmissions((prev) => [quickTx, ...prev]);
                  Alert.alert('Transmisión Táctica', 'Código 10-4 enviado al canal ' + selectedChannel.name);
                }}
              >
                <Text style={styles.quickRogerText}>⚡ ENVIAR 10-4 (COPIADO)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentTab === 'CANALES' && (
          <ScrollView style={styles.scrollSection}>
            <Text style={styles.sectionTitle}>CANALES DISPONIBLES EN BD</Text>
            <Text style={styles.sectionSubtitle}>Toca cualquier canal para sintonizar tu radio</Text>
            {DEFAULT_CHANNELS.map((ch) => {
              const isSelected = ch.id === selectedChannel.id;
              return (
                <TouchableOpacity
                  key={ch.id}
                  style={[styles.channelCard, isSelected && styles.channelCardSelected]}
                  onPress={() => {
                    setSelectedChannel(ch);
                    Alert.alert('Canal Sintonizado', `Radio enlazado a ${ch.name} (${ch.frequency})`);
                  }}
                >
                  <View style={styles.channelInfo}>
                    <Text style={[styles.channelTitleText, isSelected && styles.channelTitleSelected]}>
                      {ch.code} - {ch.name}
                    </Text>
                    <Text style={styles.channelMetaText}>
                      {ch.frequency} • {ch.category} • {ch.activeUsers} Unidades activas
                    </Text>
                  </View>
                  <Text style={styles.channelSelectBadge}>
                    {isSelected ? 'SINTONIZADO' : 'CAMBIAR'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {currentTab === 'MENSAJES' && (
          <View style={styles.messagesContainer}>
            <ScrollView style={styles.transmissionsList}>
              <Text style={styles.sectionTitle}>REGISTRO TÁCTICO DE TRANSMISIONES</Text>
              {transmissions.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.transmissionItem,
                    item.type === 'sos' && styles.transmissionItemSos,
                  ]}
                >
                  <View style={styles.transHeader}>
                    <Text style={styles.transBadge}>{item.badge} • {item.sender}</Text>
                    <Text style={styles.transTime}>{item.timestamp}</Text>
                  </View>
                  <Text style={styles.transChannel}>Canal: {item.channel}</Text>
                  {item.text ? (
                    <Text style={styles.transText}>{item.text}</Text>
                  ) : (
                    <Text style={styles.transVoice}>🔊 Mensaje de Voz PTT ({item.duration}s transmitidos)</Text>
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.messageInputRow}>
              <TextInput
                style={styles.msgInput}
                value={messageInput}
                onChangeText={setMessageInput}
                placeholder="Escribir mensaje táctico encriptado..."
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity style={styles.sendMsgBtn} onPress={handleSendMessage}>
                <Text style={styles.sendMsgText}>ENVIAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentTab === 'AJUSTES' && (
          <ScrollView style={styles.scrollSection}>
            <Text style={styles.sectionTitle}>CONFIGURACIÓN Y BASE DE DATOS</Text>

            <View style={styles.settingsCard}>
              <Text style={styles.settingsHeader}>CONEXIÓN AL SERVIDOR</Text>
              <Text style={styles.settingsSub}>
                Servidor MySQL: sql206.infinityfree.com (if0_42687378_walkt)
              </Text>
              <TextInput
                style={styles.serverInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://walkt.gt.tc o URL local"
                placeholderTextColor="#64748b"
              />
              <View style={styles.serverPresets}>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={async () => {
                    setServerUrl('http://walkt.gt.tc');
                    await AsyncStorage.setItem('c5i_native_server_url', 'http://walkt.gt.tc');
                    Alert.alert('Servidor', 'Configurado a InfinityFree: http://walkt.gt.tc');
                  }}
                >
                  <Text style={styles.presetBtnText}>USAR INFINITYFREE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={async () => {
                    setServerUrl('http://localhost:3000');
                    await AsyncStorage.setItem('c5i_native_server_url', 'http://localhost:3000');
                    Alert.alert('Servidor', 'Configurado a Servidor Local: http://localhost:3000');
                  }}
                >
                  <Text style={styles.presetBtnText}>USAR LOCAL (3000)</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsCard}>
              <Text style={styles.settingsHeader}>DATOS DEL OFICIAL</Text>
              <Text style={styles.settingRow}>Oficial: {currentUser.name}</Text>
              <Text style={styles.settingRow}>Placa / Badge: {currentUser.badge}</Text>
              <Text style={styles.settingRow}>Unidad: {currentUser.unit}</Text>
              <Text style={styles.settingRow}>Rol: {currentUser.role}</Text>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>CERRAR SESIÓN</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, currentTab === 'PTT' && styles.navItemActive]}
          onPress={() => setCurrentTab('PTT')}
        >
          <Text style={styles.navIcon}>📻</Text>
          <Text style={[styles.navLabel, currentTab === 'PTT' && styles.navLabelActive]}>PTT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'CANALES' && styles.navItemActive]}
          onPress={() => setCurrentTab('CANALES')}
        >
          <Text style={styles.navIcon}>📡</Text>
          <Text style={[styles.navLabel, currentTab === 'CANALES' && styles.navLabelActive]}>CANALES</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'MENSAJES' && styles.navItemActive]}
          onPress={() => setCurrentTab('MENSAJES')}
        >
          <Text style={styles.navIcon}>💬</Text>
          <Text style={[styles.navLabel, currentTab === 'MENSAJES' && styles.navLabelActive]}>LOGS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'AJUSTES' && styles.navItemActive]}
          onPress={() => setCurrentTab('AJUSTES')}
        >
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={[styles.navLabel, currentTab === 'AJUSTES' && styles.navLabelActive]}>AJUSTES</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b13',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0c1220',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  sosBanner: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sosBannerText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  mainContent: {
    flex: 1,
  },
  pttContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  radioDisplay: {
    backgroundColor: '#0c1322',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  displayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  channelLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  freqLabel: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  channelName: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  metricItem: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  txAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#991b1b',
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  txLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f87171',
    marginRight: 8,
  },
  txText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  standbyAlert: {
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  standbyText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  pttButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  pttButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
    borderWidth: 4,
    borderColor: '#334155',
  },
  pttButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#fca5a5',
    transform: [{ scale: 0.96 }],
  },
  pttInnerCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#475569',
  },
  pttInnerCircleActive: {
    backgroundColor: '#b91c1c',
    borderColor: '#fecaca',
  },
  pttMicIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  pttMainText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  pttSubText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 4,
  },
  quickActions: {
    gap: 10,
  },
  sosButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  sosButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  quickRogerBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickRogerText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollSection: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 16,
  },
  channelCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  channelCardSelected: {
    borderColor: '#38bdf8',
    backgroundColor: '#082f49',
  },
  channelInfo: {
    flex: 1,
  },
  channelTitleText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  channelTitleSelected: {
    color: '#38bdf8',
  },
  channelMetaText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
  },
  channelSelectBadge: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: '#0c1b2f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  transmissionsList: {
    flex: 1,
  },
  transmissionItem: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
  },
  transmissionItemSos: {
    borderLeftColor: '#ef4444',
    backgroundColor: '#450a0a',
  },
  transHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  transBadge: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 12,
  },
  transTime: {
    color: '#64748b',
    fontSize: 11,
  },
  transChannel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4,
  },
  transVoice: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  transText: {
    color: '#f8fafc',
    fontSize: 13,
  },
  messageInputRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  msgInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
  },
  sendMsgBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },
  sendMsgText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  settingsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  settingsHeader: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  settingsSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 12,
  },
  serverInput: {
    backgroundColor: '#070b13',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 10,
  },
  serverPresets: {
    flexDirection: 'row',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  settingRow: {
    color: '#e2e8f0',
    fontSize: 13,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#0c1220',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navItemActive: {
    opacity: 1,
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  navLabelActive: {
    color: '#38bdf8',
  },
  loginCard: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  shieldBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0c1a30',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#38bdf8',
    marginBottom: 16,
  },
  shieldIcon: {
    fontSize: 28,
  },
  loginTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  loginSubtitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  loginDbInfo: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  demoBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  demoBtnText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 12,
  },
});
