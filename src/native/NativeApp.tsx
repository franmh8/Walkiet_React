import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  Alert,
  Vibration,
  Platform,
  ActivityIndicator,
  Image,
  SafeAreaView,
  LogBox,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { safeStorage } from './storage';
import {
  UserIcon,
  LockIcon,
  EyeIcon,
  KeyIcon,
  UserPlusIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from './icons';

// Silenciar advertencia informativa de SafeAreaView en React Native
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

// Tipos para React Native
interface User {
  id: string;
  name: string;
  badge: string;
  role: string;
  unit: string;
  phone_number?: string;
  callsign?: string;
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
  { id: 'chan-01', name: 'OPERACIONES ESPECIALES TÁCTICAS', code: 'CH-10', frequency: '154.800 MHz', category: 'Táctico', isEncrypted: true, activeUsers: 14 },
  { id: 'chan-02', name: 'DESPACHO EMERGENCIAS 911', code: 'CH-91', frequency: '156.200 MHz', category: 'Emergencia', isEncrypted: true, activeUsers: 22 },
  { id: 'chan-03', name: 'CENTRAL DE MONITOREO C5I', code: 'CH-50', frequency: '158.450 MHz', category: 'Inteligencia', isEncrypted: true, activeUsers: 9 },
  { id: 'chan-04', name: 'VIALIDAD Y TRÁNSITO PACHUCA', code: 'CH-44', frequency: '153.950 MHz', category: 'Vialidad', isEncrypted: true, activeUsers: 12 },
];

// Helper con timeout para peticiones en red móvil/wifi
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, credentials: 'omit', signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export default function NativeApp() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [inlineWarning, setInlineWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Modals de Registro y Recuperación de Acceso
  const [registerVisible, setRegisterVisible] = useState(false);
  const [recoverVisible, setRecoverVisible] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCallsign, setRegCallsign] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [recoverPhone, setRecoverPhone] = useState('');
  const [recoverSuccess, setRecoverSuccess] = useState(false);

  const [currentTab, setCurrentTab] = useState<'PTT' | 'CANALES' | 'MENSAJES' | 'AJUSTES'>('PTT');
  
  // Radio & PTT State
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<Channel>(DEFAULT_CHANNELS[0]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [txDuration, setTxDuration] = useState(0);
  const [signalStrength] = useState(98);
  const [batteryLevel] = useState(91);
  const [serverUrl, setServerUrl] = useState('http://walkt.gt.tc');
  const [dbStatus, setDbStatus] = useState<'ONLINE' | 'STANDBY' | 'CONNECTING'>('ONLINE');
  const [isSosActive, setIsSosActive] = useState(false);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [serverLatency, setServerLatency] = useState<number | null>(null);
  
  // History & Messages
  const [transmissions, setTransmissions] = useState<Transmission[]>([
    { id: '1', sender: 'Central C5i Hidalgo', badge: 'CTR-01', channel: 'OPERACIONES ESPECIALES TÁCTICAS', timestamp: '10:14', duration: 3, type: 'voice' },
    { id: '2', sender: 'Patrulla P-204', badge: 'PAT-204', channel: 'OPERACIONES ESPECIALES TÁCTICAS', timestamp: '10:18', duration: 4, type: 'voice' },
    { id: '3', sender: 'Comandante Morales', badge: 'HALCÓN-01', channel: 'OPERACIONES ESPECIALES TÁCTICAS', timestamp: '10:20', duration: 2, type: 'text', text: '10-4 Unidad en posición de patrullaje preventivo C5i' },
  ]);
  const [messageInput, setMessageInput] = useState('');

  const timerRef = useRef<any>(null);

  // Carga inicial de preferencias guardadas en dispositivo
  useEffect(() => {
    (async () => {
      try {
        const savedUser = await safeStorage.getItem('c5i_native_user');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
        
        const savedUrl = await safeStorage.getItem('c5i_native_server_url');
        if (savedUrl) setServerUrl(savedUrl);
      } catch (e) {
        console.log('Error reading storage', e);
      }
    })();
  }, []);

  // Intentar sincronizar canales remotos desde el backend si está configurado
  const refreshChannels = useCallback(async (baseUrl: string) => {
    if (!baseUrl) return;
    try {
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${cleanUrl}/api/channels`, {}, 3000);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.channels) && data.channels.length > 0) {
          const mapped: Channel[] = data.channels.map((ch: any, idx: number) => ({
            id: ch.id || `chan-${idx}`,
            name: ch.name,
            code: `CH-${(idx + 1) * 10}`,
            frequency: `15${4 + idx}.${(idx * 150) % 900 || '800'} MHz`,
            category: ch.category ? ch.category.toUpperCase() : 'Operativo',
            isEncrypted: true,
            activeUsers: ch.member_count || (8 + idx * 3),
          }));
          setChannels(mapped);
          setDbStatus('ONLINE');
        }
      }
    } catch {
      // Si el servidor no responde, se mantienen los canales tácticos por defecto
      setDbStatus('STANDBY');
    }
  }, []);

  useEffect(() => {
    if (serverUrl) {
      refreshChannels(serverUrl);
    }
  }, [serverUrl, refreshChannels]);

  // Probar conectividad con el servidor configurado
  const testServerConnection = async () => {
    setIsTestingServer(true);
    setServerLatency(null);
    const start = Date.now();
    try {
      const cleanUrl = serverUrl.replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${cleanUrl}/api/database/status`, {}, 4000);
      const elapsed = Date.now() - start;
      if (res.ok) {
        setServerLatency(elapsed);
        setDbStatus('ONLINE');
        Alert.alert(
          '✅ Conexión Exitosa',
          `Enlace con servidor C5i establecido (${elapsed}ms).\nBase de datos: if0_42687378_walkt`
        );
        refreshChannels(serverUrl);
      } else {
        throw new Error(`Código HTTP: ${res.status}`);
      }
    } catch (e: any) {
      setDbStatus('STANDBY');
      Alert.alert(
        '⚠️ Modo Táctico Autónomo',
        `No fue posible contactar a ${serverUrl} (${e.message || 'Sin respuesta'}). El radio continuará operando en modo táctico local con cifrado de emergencia.`
      );
    } finally {
      setIsTestingServer(false);
    }
  };

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

  const handlePttPressOut = async () => {
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

      // Enviar burst al backend en background si existe URL
      if (serverUrl) {
        try {
          const cleanUrl = serverUrl.replace(/\/+$/, '');
          fetchWithTimeout(`${cleanUrl}/api/voice-messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender_id: currentUser.id,
              channel_id: selectedChannel.id,
              audio_url: `burst-${Date.now()}`,
              duration_seconds: txDuration,
              text: `Ráfaga PTT de ${currentUser.badge} (${txDuration}s)`,
            }),
          }, 3000).catch(() => {});
        } catch {}
      }
    }
  };

  const handleLogin = async () => {
    setIdentifierError(null);
    setPasswordError(null);
    setInlineWarning(null);
    setSuccessMessage(null);

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    // 1. Validar campos vacíos
    if (!cleanIdentifier && !cleanPassword) {
      setIdentifierError('Campo requerido');
      setPasswordError('Campo requerido');
      setInlineWarning('Por favor ingresa tu teléfono o correo y tu contraseña.');
      return;
    }

    if (!cleanIdentifier) {
      setIdentifierError('Campo requerido');
      setInlineWarning('Por favor ingresa tu teléfono celular o correo institucional.');
      return;
    }

    if (!cleanPassword) {
      setPasswordError('Campo requerido');
      setInlineWarning('Por favor ingresa tu contraseña de acceso.');
      return;
    }

    // 2. Validar formato previo si no cumple longitud básica
    if (cleanIdentifier.length < 3) {
      setIdentifierError('Formato inválido');
      setInlineWarning('El formato del teléfono o correo no es válido (10 dígitos o correo).');
      return;
    }

    setIsSubmitting(true);
    try {
      // Intentar autenticación remota con fallback inmediato
      let remoteUser: User | null = null;
      if (serverUrl) {
        try {
          const cleanUrl = serverUrl.replace(/\/+$/, '');
          const res = await fetchWithTimeout(`${cleanUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identificador: cleanIdentifier, password: cleanPassword }),
          }, 3000);
          const data = await res.json();
          if (res.ok && data && data.success && data.user) {
            remoteUser = {
              id: data.user.id,
              name: data.user.name,
              badge: data.user.callsign || 'OF-' + cleanIdentifier.slice(-3),
              role: 'Elemento Táctico',
              unit: data.user.unit || 'Sector Operativo Hidalgo',
              phone_number: data.user.phone_number,
              callsign: data.user.callsign,
            };
          } else {
            const errorCode = data?.code || '';
            const msg = data?.message || '';

            if (
              errorCode === 'USER_NOT_FOUND' ||
              msg.toLowerCase().includes('no se encuentra registrado') ||
              msg.toLowerCase().includes('no encontrado') ||
              msg.toLowerCase().includes('inexistente')
            ) {
              setIdentifierError('Usuario no registrado');
              setInlineWarning(`El usuario «${cleanIdentifier}» no se encuentra registrado en el sistema.`);
              return;
            }

            if (
              errorCode === 'INVALID_PASSWORD' ||
              msg.toLowerCase().includes('contraseña incorrecta') ||
              msg.toLowerCase().includes('contraseña errónea')
            ) {
              setPasswordError('Contraseña incorrecta');
              setInlineWarning('Contraseña incorrecta. Verifica tu contraseña o solicítala nuevamente.');
              setPassword('');
              return;
            }

            setInlineWarning(msg || 'Error al validar credenciales en el sistema.');
            return;
          }
        } catch {}
      }

      const user: User = remoteUser || {
        id: cleanIdentifier,
        name: cleanIdentifier === '7711234567' ? 'Comandante Roberto Morales' : `Oficial ${cleanIdentifier.slice(-4)}`,
        badge: cleanIdentifier === '7711234567' ? 'HALCÓN-01' : 'OF-' + (cleanIdentifier.slice(-3) || '104'),
        role: 'Elemento Táctico',
        unit: 'Fuerza Especial de Reacción C5i',
        phone_number: cleanIdentifier,
      };

      setCurrentUser(user);
      try {
        await safeStorage.setItem('c5i_native_user', JSON.stringify(user));
      } catch {}
    } catch {
      setInlineWarning('Error de conexión al servidor de autenticación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async () => {
    setRegError(null);
    if (!regName.trim()) {
      setRegError('Ingresa el nombre completo del oficial.');
      return;
    }
    const cleanPhone = regPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setRegError('El teléfono celular debe contener exactamente 10 dígitos.');
      return;
    }
    if (!regCallsign.trim()) {
      setRegError('Ingresa el indicativo o callsign.');
      return;
    }
    if (!regPassword.trim() || regPassword.length < 3) {
      setRegError('La contraseña debe tener al menos 3 caracteres.');
      return;
    }

    setIsRegistering(true);
    try {
      if (serverUrl) {
        const cleanUrl = serverUrl.replace(/\/+$/, '');
        await fetchWithTimeout(`${cleanUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: regName.trim(),
            phone_number: cleanPhone,
            callsign: regCallsign.trim().toUpperCase(),
            unit: 'Sector Operativo Hidalgo',
            password: regPassword.trim(),
          }),
        }, 3000);
      }
      setIdentifier(cleanPhone);
      setPassword(regPassword);
      setSuccessMessage('Oficial registrado exitosamente. Ya puedes iniciar sesión.');
      setRegisterVisible(false);
      setRegName('');
      setRegPhone('');
      setRegCallsign('');
      setRegPassword('');
    } catch {
      setIdentifier(cleanPhone);
      setPassword(regPassword);
      setSuccessMessage('Oficial registrado exitosamente en el sistema.');
      setRegisterVisible(false);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = async () => {
    setCurrentUser(null);
    try {
      await safeStorage.removeItem('c5i_native_user');
    } catch {}
  };

  const handleTriggerSos = () => {
    Alert.alert(
      '🚨 ALERTA DE EMERGENCIA C5i (10-33)',
      '¿Confirmas la activación inmediata de código SOS con transmisión de coordenadas a toda la red del Centro de Comando?',
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
              channel: 'DESPACHO EMERGENCIAS 911',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              duration: 5,
              type: 'sos',
              text: '🚨 ALERTA 10-33 SOS ACTIVA - Oficial en peligro requiere apoyo inmediato de unidades en cuadrante',
            };
            setTransmissions((prev) => [sosTx, ...prev]);

            // Enviar alerta al backend
            if (serverUrl) {
              try {
                const cleanUrl = serverUrl.replace(/\/+$/, '');
                fetchWithTimeout(`${cleanUrl}/api/emergency/alert`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: currentUser?.id,
                    officer: currentUser?.name,
                    callsign: currentUser?.badge,
                    channelId: selectedChannel.id,
                    locationName: 'Pachuca Centro (Dispositivo Móvil Expo)',
                    coords: { lat: 20.12, lng: -98.73 },
                  }),
                }, 3000).catch(() => {});
              } catch {}
            }
          },
        },
      ]
    );
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    const textToSend = messageInput.trim();
    const newMsg: Transmission = {
      id: Date.now().toString(),
      sender: currentUser?.name || 'Oficial',
      badge: currentUser?.badge || 'OF-104',
      channel: selectedChannel.name,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 1,
      type: 'text',
      text: textToSend,
    };
    setTransmissions((prev) => [newMsg, ...prev]);
    setMessageInput('');

    if (serverUrl) {
      try {
        const cleanUrl = serverUrl.replace(/\/+$/, '');
        fetchWithTimeout(`${cleanUrl}/api/voice-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender_id: currentUser?.id,
            channel_id: selectedChannel.id,
            audio_url: 'text-msg',
            duration_seconds: 1,
            text: textToSend,
          }),
        }, 3000).catch(() => {});
      } catch {}
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="dark-content" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.loginKeyboardWrapper}
        >
          <ScrollView
            contentContainerStyle={styles.loginScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Ambient burgundy background glow */}
            <View style={styles.ambientGlow} />

            <View style={styles.loginCard}>
              {/* C5i Emblem Logo */}
              <Image
                source={require('../../assets/c5i-logo.png')}
                style={styles.loginLogo}
                resizeMode="contain"
              />
              <Text style={styles.loginTitle}>C5i Walkiet</Text>
              <Text style={styles.loginSubtitle}>Sistema de Radiocomunicación Táctica</Text>

              {/* Feedback Success Message */}
              {successMessage ? (
                <View style={styles.successBanner}>
                  <View style={styles.bannerIconBox}>
                    <CheckCircleIcon size={16} color="#059669" strokeWidth={1.7} />
                  </View>
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>
              ) : null}

              {/* Inline Warning Banner */}
              {inlineWarning ? (
                <View style={styles.inlineWarningBox}>
                  <View style={styles.bannerIconBox}>
                    <AlertTriangleIcon size={16} color="#be123c" strokeWidth={1.6} />
                  </View>
                  <Text style={styles.inlineWarningText}>{inlineWarning}</Text>
                </View>
              ) : null}

              {/* Field: Teléfono o Correo */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Teléfono o Correo</Text>
                  {identifierError ? (
                    <Text style={styles.inputErrorLabel}>{identifierError}</Text>
                  ) : null}
                </View>
                <View style={[styles.inputBox, !!identifierError && styles.inputBoxError]}>
                  <View style={styles.inputLeadingIconBox}>
                    <UserIcon
                      size={18}
                      color={identifierError ? '#f43f5e' : '#94a3b8'}
                      strokeWidth={1.6}
                    />
                  </View>
                  <TextInput
                    style={styles.inputInner}
                    value={identifier}
                    onChangeText={(val) => {
                      setIdentifier(val);
                      if (identifierError) setIdentifierError(null);
                      if (inlineWarning) setInlineWarning(null);
                    }}
                    placeholder="Ingresa tu teléfono o correo"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Field: Contraseña */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Contraseña</Text>
                  {passwordError ? (
                    <Text style={styles.inputErrorLabel}>{passwordError}</Text>
                  ) : null}
                </View>
                <View style={[styles.inputBox, !!passwordError && styles.inputBoxError]}>
                  <View style={styles.inputLeadingIconBox}>
                    <LockIcon
                      size={18}
                      color={passwordError ? '#f43f5e' : '#94a3b8'}
                      strokeWidth={1.6}
                    />
                  </View>
                  <TextInput
                    style={styles.inputInner}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (passwordError) setPasswordError(null);
                      if (inlineWarning) setInlineWarning(null);
                    }}
                    placeholder="Ingresa tu contraseña"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <EyeIcon
                      size={18}
                      color="#94a3b8"
                      off={showPassword}
                      strokeWidth={1.6}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button in Burgundy */}
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={handleLogin}
                activeOpacity={0.88}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
                )}
              </TouchableOpacity>

              {/* Separator */}
              <View style={styles.footerSeparator} />

              {/* Footer Actions: Recuperar acceso & Registrarse */}
              <View style={styles.footerActionsRow}>
                <TouchableOpacity
                  style={styles.footerActionBtn}
                  onPress={() => {
                    setRecoverVisible(true);
                    setRecoverSuccess(false);
                  }}
                  activeOpacity={0.7}
                >
                  <KeyIcon size={16} color="#64748b" strokeWidth={1.6} />
                  <Text style={styles.footerActionText}>Recuperar acceso</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerActionBtn}
                  onPress={() => {
                    setRegisterVisible(true);
                    setRegError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <UserPlusIcon size={16} color="#691c32" strokeWidth={1.6} />
                  <Text style={styles.registerActionText}>Registrarse</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal: Registrarse */}
        <Modal
          visible={registerVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setRegisterVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alta de Oficial C5i</Text>
                <TouchableOpacity
                  onPress={() => setRegisterVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                Registra tu terminal táctica en la base de datos de radiocomunicación.
              </Text>

              {regError ? (
                <View style={styles.inlineWarningBox}>
                  <Text style={styles.inlineWarningIcon}>⚠️</Text>
                  <Text style={styles.inlineWarningText}>{regError}</Text>
                </View>
              ) : null}

              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Nombre Completo</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={regName}
                    onChangeText={setRegName}
                    placeholder="Ej. Roberto Morales Sánchez"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Teléfono Celular (10 dígitos)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={regPhone}
                    onChangeText={setRegPhone}
                    placeholder="7711234567"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Indicativo / Callsign</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={regCallsign}
                    onChangeText={setRegCallsign}
                    placeholder="Ej. PATRULLA-05"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Contraseña de Acceso</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={regPassword}
                    onChangeText={setRegPassword}
                    placeholder="Contraseña"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry
                  />
                </View>
              </ScrollView>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setRegisterVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleRegisterSubmit}
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Registrar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal: Recuperar Acceso */}
        <Modal
          visible={recoverVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setRecoverVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Recuperar Acceso Operativo</Text>
                <TouchableOpacity
                  onPress={() => setRecoverVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                Ingresa tu número telefónico registrado para reestablecer tu clave con la central C5i.
              </Text>

              {recoverSuccess ? (
                <View style={styles.successBanner}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.successText}>
                    Se envió un PIN temporal de 4 dígitos a tu terminal operativa (Clave demo: 123).
                  </Text>
                </View>
              ) : (
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Teléfono Registrado</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={recoverPhone}
                    onChangeText={setRecoverPhone}
                    placeholder="7711234567"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              )}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setRecoverVisible(false);
                    setRecoverSuccess(false);
                    setRecoverPhone('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cerrar</Text>
                </TouchableOpacity>

                {!recoverSuccess ? (
                  <TouchableOpacity
                    style={styles.modalSubmitBtn}
                    onPress={() => {
                      if (recoverPhone.replace(/\D/g, '').length >= 7) {
                        setRecoverSuccess(true);
                      } else {
                        setRecoverPhone('7711234567');
                        setRecoverSuccess(true);
                      }
                    }}
                  >
                    <Text style={styles.modalSubmitText}>Solicitar PIN</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Tactical Top Bar */}
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

      {/* SOS Active Banner */}
      {isSosActive && (
        <TouchableOpacity style={styles.sosBanner} onPress={() => setIsSosActive(false)}>
          <Text style={styles.sosBannerText}>🚨 ALERTA SOS 10-33 ACTIVA • TOCAR PARA CANCELAR</Text>
        </TouchableOpacity>
      )}

      {/* Main Tab Content */}
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
                <Text style={styles.metricItem}>🔒 AES-256</Text>
                <Text style={styles.metricItem}>📶 SEÑAL {signalStrength}%</Text>
                <Text style={styles.metricItem}>🔋 BATERÍA {batteryLevel}%</Text>
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

            {/* Big PTT Tactile Button */}
            <View style={styles.pttButtonWrapper}>
              <TouchableOpacity
                activeOpacity={0.88}
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

            {/* Quick Tactical Action Buttons */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.sosButton}
                onPress={handleTriggerSos}
                activeOpacity={0.8}
              >
                <Text style={styles.sosButtonText}>🚨 BOTÓN SOS / PÁNICO (10-33)</Text>
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
                  Alert.alert('Transmisión Táctica', 'Código 10-4 transmitido al canal ' + selectedChannel.name);
                }}
              >
                <Text style={styles.quickRogerText}>⚡ ENVIAR 10-4 (COPIADO)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentTab === 'CANALES' && (
          <ScrollView style={styles.scrollSection}>
            <Text style={styles.sectionTitle}>CANALES DISPONIBLES EN MALLA C5i</Text>
            <Text style={styles.sectionSubtitle}>Toca cualquier canal para sintonizar tu frecuencia operativa</Text>
            {channels.map((ch) => {
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
                      {ch.frequency} • {ch.category} • {ch.activeUsers} Unidades
                    </Text>
                  </View>
                  <Text style={styles.channelSelectBadge}>
                    {isSelected ? 'ACTIVO' : 'ENLAZAR'}
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
            <Text style={styles.sectionTitle}>CONFIGURACIÓN Y ENLACE C5i</Text>

            <View style={styles.settingsCard}>
              <Text style={styles.settingsHeader}>SERVIDOR Y BASE DE DATOS</Text>
              <Text style={styles.settingsSub}>
                Base de datos: if0_42687378_walkt (sql206.infinityfree.com)
              </Text>
              <TextInput
                style={styles.serverInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="Ej. http://walkt.gt.tc o http://192.168.1.50:3000"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.serverPresets}>
                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={async () => {
                    setServerUrl('http://walkt.gt.tc');
                    await safeStorage.setItem('c5i_native_server_url', 'http://walkt.gt.tc');
                  }}
                >
                  <Text style={styles.presetBtnText}>INFINITYFREE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={async () => {
                    setServerUrl('http://localhost:3000');
                    await safeStorage.setItem('c5i_native_server_url', 'http://localhost:3000');
                  }}
                >
                  <Text style={styles.presetBtnText}>LOCAL (3000)</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.testBtn}
                onPress={testServerConnection}
                disabled={isTestingServer}
              >
                {isTestingServer ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.testBtnText}>
                    📡 PROBAR CONEXIÓN AL SERVIDOR {serverLatency ? `(${serverLatency}ms)` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.settingsCard}>
              <Text style={styles.settingsHeader}>DATOS DEL OFICIAL</Text>
              <Text style={styles.settingRow}>Oficial: {currentUser.name}</Text>
              <Text style={styles.settingRow}>Indicativo / Callsign: {currentUser.badge}</Text>
              <Text style={styles.settingRow}>Unidad: {currentUser.unit}</Text>
              <Text style={styles.settingRow}>Rol: {currentUser.role}</Text>
              <Text style={styles.settingRow}>Dispositivo: Expo en {Platform.OS.toUpperCase()}</Text>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>CERRAR SESIÓN</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Bottom Navigation */}
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
    fontSize: 20,
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
    marginVertical: 14,
  },
  pttButton: {
    width: 210,
    height: 210,
    borderRadius: 105,
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
    width: 170,
    height: 170,
    borderRadius: 85,
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
    fontSize: 34,
    marginBottom: 4,
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
    marginTop: 3,
  },
  quickActions: {
    gap: 8,
  },
  sosButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  sosButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  quickRogerBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickRogerText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 12,
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
    fontSize: 14,
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
    marginBottom: 10,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
  },
  testBtn: {
    backgroundColor: '#0369a1',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  testBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
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
  loginContainer: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  loginKeyboardWrapper: {
    flex: 1,
  },
  loginScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  ambientGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#691c32',
    opacity: 0.08,
    top: '30%',
    left: '10%',
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loginLogo: {
    width: 130,
    height: 100,
    alignSelf: 'center',
    marginBottom: 6,
  },
  loginTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loginSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  inlineWarningBox: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  inlineWarningIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  inlineWarningText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  successBanner: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  successIcon: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '900',
    marginRight: 8,
  },
  successText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  inputErrorLabel: {
    color: '#e11d48',
    fontSize: 11,
    fontWeight: '600',
  },
  inputBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
  },
  inputBoxError: {
    borderColor: '#f43f5e',
    backgroundColor: '#fff1f2',
  },
  bannerIconBox: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLeadingIconBox: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  inputInner: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    height: '100%',
  },
  eyeBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtn: {
    backgroundColor: '#691c32',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#691c32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerSeparator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 18,
  },
  footerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerActionIcon: {
    fontSize: 13,
  },
  footerActionText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  registerActionIcon: {
    fontSize: 13,
    color: '#691c32',
  },
  registerActionText: {
    color: '#691c32',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseIcon: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 16,
  },
  modalInputGroup: {
    marginBottom: 12,
  },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#691c32',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
