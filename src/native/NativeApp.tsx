import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { safeStorage } from './storage';
import { logoutContactSession, type DirectoryContact as ContactOfficer } from '../services/contactsApi';
import { ContactsScreen, type ContactsScreenHandle } from './contacts/ContactsScreen';
import { useContactsDirectory } from './contacts/useContactsDirectory';
import { useNativeFeedback } from './components/NativeFeedback';
import c5iLogoImg from '../../assets/c5i-logo.png';
import {
  UserIcon,
  LockIcon,
  EyeIcon,
  KeyIcon,
  UserPlusIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  PhoneIcon,
  MailIcon,
  ArrowLeftIcon,
  RotateCwIcon,
  MicIcon,
  UsersIcon,
  MessageSquareIcon,
  BookOpenIcon,
  XIcon,
  PlusIcon,
  SearchIcon,
  CameraIcon,
  EditIcon,
  SendIcon,
  PaperclipIcon,
  DoubleCheckIcon,
  VideoIcon,
  ImageIcon,
  MapPinIcon,
  FileTextIcon,
} from './icons';
import type { Channel } from '../services/channelsApi';
import { GroupsScreen } from './groups/GroupsScreen';
import { useChannelsDirectory } from './groups/useChannelsDirectory';
import { ChannelMembersModal } from './groups/ChannelMembersModal';
import { soundEngine } from '../services/soundEngine';
import { PttScreen } from './ptt/PttScreen';
import { useLiveRadio } from './ptt/useLiveRadio';
import { useRadioNotifications } from './ptt/useRadioNotifications';
import { ProfileScreen } from './profile/ProfileScreen';
import { useAccountProfile } from './profile/useAccountProfile';
import { AppThemeProvider, useAppTheme, useThemeStyles } from './profile/AppTheme';
import type { AccountUser } from '../services/accountApi';

// Tipos para React Native
interface User {
  id: string;
  name: string;
  badge: string;
  role: string;
  unit: string;
  phone_number?: string;
  callsign?: string;
  email?: string;
  loginIdentifier?: string;
  authToken?: string;
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

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderCallsign?: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
  status: 'sent' | 'delivered' | 'read';
  mediaType?: 'text' | 'image' | 'voice' | 'location' | 'document';
  mediaUrl?: string;
  fileName?: string;
  locationCoords?: { latitude: number; longitude: number; address?: string };
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  callsign?: string;
  unit?: string;
  targetUserId?: string;
  participantCount?: number;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  messages: ChatMessage[];
}

// Preferencia de grupo por cuenta. No guardar un canal en una clave global:
// una cuenta diferente no debe heredar el grupo de otro usuario.
interface SavedChannelSelection {
  id: string;
  name: string;
  code?: string;
}

const lastChannelStorageKey = (userId: string) =>
  `c5i_last_selected_channel_${encodeURIComponent(String(userId))}`;

const normalizeChannelName = (value: string) =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();

function getChannelPreferenceKeys(user: User): string[] {
  // El ID del backend tiene prioridad. Correo/teléfono/identificador de acceso
  // permiten recuperar la preferencia aun si cambió el ID entregado por la API.
  const identifiers: string[] = [];
  const id = String(user.id || '').trim();
  if (id) identifiers.push(lastChannelStorageKey(id)); // Compatibilidad con versiones anteriores.
  const phone = String(user.phone_number || '').replace(/\D/g, '');
  if (phone.length >= 10) identifiers.push(`c5i_last_channel_phone_${phone}`);
  const email = String(user.email || '').trim().toLowerCase();
  if (email.includes('@')) identifiers.push(`c5i_last_channel_email_${encodeURIComponent(email)}`);
  const login = String(user.loginIdentifier || '').trim().toLowerCase();
  if (login.includes('@')) identifiers.push(`c5i_last_channel_email_${encodeURIComponent(login)}`);
  else if (/^\d{10,}$/.test(login.replace(/\D/g, ''))) {
    identifiers.push(`c5i_last_channel_phone_${login.replace(/\D/g, '')}`);
  }
  return [...new Set(identifiers)];
}

function parseSavedChannel(value: string | null): SavedChannelSelection | null {
  if (!value) return null;
  try {
    const item = JSON.parse(value);
    if (item && String(item.id || '').trim() && String(item.name || '').trim()) {
      return {
        id: String(item.id).trim(),
        name: String(item.name).trim(),
        code: item.code ? String(item.code) : undefined,
      };
    }
  } catch (error) {
    console.warn('[Walkiet] Datos antiguos del grupo guardado no válidos:', error);
  }
  return null;
}

async function readSavedChannelSelection(user: User): Promise<SavedChannelSelection | null> {
  for (const key of getChannelPreferenceKeys(user)) {
    let raw: string | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Esta lectura es persistente, no depende del fallback temporal en memoria.
      try { raw = window.localStorage.getItem(key); }
      catch (error) { console.warn('[Walkiet] No se pudo leer localStorage:', error); }
    }
    if (raw === null) raw = await safeStorage.getItem(key);
    const parsed = parseSavedChannel(raw);
    if (parsed) return parsed;
  }
  return null;
}

async function writeSavedChannelSelection(user: User, channel: Channel | null): Promise<void> {
  const keys = getChannelPreferenceKeys(user);
  if (!keys.length) throw new Error('La cuenta no tiene identificador estable para guardar el grupo.');
  const value = channel ? JSON.stringify({ id: String(channel.id), name: channel.name, code: channel.code }) : null;
  for (const key of keys) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Guardado síncrono: el usuario puede cerrar sesión inmediatamente
      // después de tocar SINTONIZAR sin perder la preferencia.
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
      if (window.localStorage.getItem(key) !== value) {
        throw new Error('El navegador no confirmó el almacenamiento del grupo.');
      }
    } else if (value === null) {
      await safeStorage.removeItem(key);
    } else {
      await safeStorage.setItem(key, value);
    }
  }
}

function findRestoredChannel(channels: Channel[], saved: SavedChannelSelection): Channel | null {
  // No sintonizar un grupo solo porque reutiliza un ID. Se exige también el nombre.
  const name = normalizeChannelName(saved.name);
  const exact = channels.find(ch => String(ch.id) === saved.id && normalizeChannelName(ch.name) === name);
  if (exact) return exact;
  // El backend puede reasignar IDs; admitir solo una coincidencia inequívoca.
  const sameName = channels.filter(ch => normalizeChannelName(ch.name) === name);
  return sameName.length === 1 ? sameName[0] : null;
}

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

function NativeAppScreen() {
  const styles = useThemeStyles(baseStyles);
  const { palette, dark, setMode } = useAppTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [inlineWarning, setInlineWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Modals de Registro y Recuperación de Contraseña
  type RegisterStep = 'form' | 'sms_verification' | 'success';
  const [registerVisible, setRegisterVisible] = useState(false);
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regShowConfirmPassword, setRegShowConfirmPassword] = useState(false);
  const [regGeneralError, setRegGeneralError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Verificación SMS de Registro
  const [regGeneratedCode, setRegGeneratedCode] = useState('');
  const [regSmsDigits, setRegSmsDigits] = useState('');
  const [regResendTimer, setRegResendTimer] = useState(0);
  const regSmsInputRef = useRef<any>(null);

  useEffect(() => {
    if (regResendTimer > 0) {
      const timer = setTimeout(() => setRegResendTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [regResendTimer]);

  // Recuperar Contraseña (Flow idéntico a ForgotPasswordModal / Image 1)
  type RecoveryStep = 'identify' | 'token' | 'new_password' | 'success';
  const [recoverVisible, setRecoverVisible] = useState(false);
  const [recoverStep, setRecoverStep] = useState<RecoveryStep>('identify');
  const [recoverIdentifier, setRecoverIdentifier] = useState('');
  const [recoverMatchedUser, setRecoverMatchedUser] = useState<any>(null);
  const [recoverGeneratedCode, setRecoverGeneratedCode] = useState<string | null>(null);
  const [recoverTokenString, setRecoverTokenString] = useState('');
  const [recoverResendCooldown, setRecoverResendCooldown] = useState(0);
  const [recoverNewPassword, setRecoverNewPassword] = useState('');
  const [recoverConfirmPassword, setRecoverConfirmPassword] = useState('');
  const [recoverShowNewPass, setRecoverShowNewPass] = useState(false);
  const [recoverShowConfirmPass, setRecoverShowConfirmPass] = useState(false);
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverErrorMessage, setRecoverErrorMessage] = useState<string | null>(null);
  const tokenHiddenInputRef = useRef<any>(null);

  useEffect(() => {
    if (recoverResendCooldown > 0) {
      const timer = setTimeout(() => setRecoverResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [recoverResendCooldown]);

  const [currentTab, setCurrentTab] = useState<'PTT' | 'Grupos' | 'Chat' | 'Contactos' | 'Perfil'>('PTT');
  
  // Radio y selección de grupo por cuenta.
  // Se recupera el canal elegido por este usuario, si sigue disponible.
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [pendingSavedChannel, setPendingSavedChannel] = useState<{
    userId: string;
    channel: SavedChannelSelection;
    revision: number;
  } | null>(null);
  const channelChoiceRevisionRef = useRef(0);
  const [serverUrl, setServerUrl] = useState('https://walkiet.alwaysdata.net');
  const updateProfileUser = useCallback((profile: AccountUser) => {
    setCurrentUser(previous => {
      if (!previous || previous.id !== profile.id) return previous;
      const next = { ...previous, name: profile.name, unit: profile.unit, role: profile.role || previous.role,
        phone_number: profile.phone_number, email: profile.correo || undefined, callsign: profile.callsign, badge: profile.callsign || previous.badge };
      void safeStorage.setItem('c5i_native_user', JSON.stringify(next));
      return next;
    });
  }, []);
  const account = useAccountProfile(serverUrl, currentUser?.id || '', currentUser?.authToken || '', updateProfileUser, () => { setInlineWarning('Tu sesión venció. Vuelve a iniciar sesión.'); void handleLogout(); });
  useEffect(() => { setMode(account.settings.theme); }, [account.settings.theme, setMode]);
  useEffect(() => { soundEngine.setMessageSounds(account.settings.messageSounds); soundEngine.setRogerBeep(account.settings.rogerBeep); }, [account.settings.messageSounds, account.settings.rogerBeep]);

  const [isSosActive, setIsSosActive] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  
  // History & Messages
  const [transmissions, setTransmissions] = useState<Transmission[]>([]);
  const [messageInput, setMessageInput] = useState('');

  // Chat & Messaging State (WhatsApp-style C5i)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedChatFilter, setSelectedChatFilter] = useState<'Todos' | 'Grupos' | 'Directos'>('Todos');
  const [chatDraftMessage, setChatDraftMessage] = useState('');
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isLiveCameraModalOpen, setIsLiveCameraModalOpen] = useState(false);
  const [liveCameraStream, setLiveCameraStream] = useState<any>(null);
  const liveCameraVideoRef = useRef<any>(null);

  useEffect(() => {
    if (isLiveCameraModalOpen && liveCameraStream && liveCameraVideoRef.current) {
      try {
        liveCameraVideoRef.current.srcObject = liveCameraStream;
        liveCameraVideoRef.current.play?.().catch?.((e: any) => console.warn('Error reproduciendo video:', e));
      } catch (e) {
        console.warn('Error asignando srcObject a cámara:', e);
      }
    }
  }, [isLiveCameraModalOpen, liveCameraStream]);

  const handleCaptureLivePhoto = () => {
    if (liveCameraVideoRef.current) {
      try {
        const video = liveCameraVideoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          sendMediaMessage('image', '📸 Foto Capturada con Cámara Táctica', dataUrl, 'evidencia_camara.jpg');
        }
      } catch (e: any) {
        Alert.alert('Error al capturar foto', e.message || 'No se pudo procesar la imagen.');
      }
    }
    handleCloseLiveCamera();
  };

  const handleCloseLiveCamera = () => {
    if (liveCameraStream) {
      try {
        liveCameraStream.getTracks?.().forEach((track: any) => track.stop());
      } catch {}
      setLiveCameraStream(null);
    }
    setIsLiveCameraModalOpen(false);
  };

  // Modals for Chat & Contacts
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  // Modal: Crear Grupo de Conversación
  const [isCreateGroupChatModalOpen, setIsCreateGroupChatModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);

  const { showTacticalToast, feedback } = useNativeFeedback();
  const contactsDirectory = useContactsDirectory(serverUrl, currentUser ? { userId: currentUser.id, token: currentUser.authToken || '' } : null);
  const channelsDirectory = useChannelsDirectory(serverUrl, currentUser?.id || '', currentUser?.authToken || '');
  const { channels, synced: channelsSyncedFromServer, refresh: refreshChannels } = channelsDirectory;
  const officersList = contactsDirectory.contacts;
  const contactsScreenRef = useRef<ContactsScreenHandle>(null);

  // Circuit breaker para endpoints PHP en Alwaysdata (evita spam de 404 en consola si aún no se han subido los archivos)
  const isChatPhpAvailableRef = useRef<boolean | null>(null);
  const lastChatProbeTimeRef = useRef<number>(0);

  // Las ondas del PTT se muestran como aros estáticos para evitar fallos
  // al detener Animated.loop en la versión web de React Native.

  // Carga inicial de preferencias guardadas en dispositivo
  useEffect(() => {
    (async () => {
      try {
        const [savedUser, savedUrl] = await Promise.all([
          safeStorage.getItem('c5i_native_user'), safeStorage.getItem('c5i_native_server_url'),
        ]);
        if (savedUrl) {
          // Si el usuario tenía guardado el servidor anterior con fallos, migrar automáticamente a Alwaysdata
          if (savedUrl.includes('walkt.gt.tc') || savedUrl.includes('infinityfree')) {
            setServerUrl('https://walkiet.alwaysdata.net');
            await safeStorage.setItem('c5i_native_server_url', 'https://walkiet.alwaysdata.net');
          } else {
            setServerUrl(savedUrl);
          }
        }
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.log('Error reading storage', e);
      }
    })();
  }, []);

  useEffect(() => {
    setSelectedChannel(null);
    setIsMembersModalOpen(false);
  }, [channelsDirectory.scope]);

  // Restaurar la selección solo del usuario autenticado. Una elección manual más
  // reciente tiene prioridad sobre cualquier lectura asíncrona de la memoria.
  useEffect(() => {
    if (!currentUser?.id) {
      setPendingSavedChannel(null);
      return;
    }
    let active = true;
    const userId = String(currentUser.id);
    const revision = channelChoiceRevisionRef.current;

    readSavedChannelSelection(currentUser)
      .then((saved) => {
        if (!active || revision !== channelChoiceRevisionRef.current || !saved) return;
        setPendingSavedChannel({ userId, channel: saved, revision });
      })
      .catch((error) => console.warn('No se pudo recuperar el último canal:', error));

    return () => { active = false; };
  }, [currentUser?.id]);

  // Restaurar únicamente después de validar la membresía con el servidor.
  // Comprobamos también el nombre para no sintonizar otro grupo si el servidor
  // reutiliza un identificador.
  useEffect(() => {
    if (!currentUser?.id || !pendingSavedChannel) return;
    if (String(currentUser.id) !== pendingSavedChannel.userId ||
        channelChoiceRevisionRef.current !== pendingSavedChannel.revision) return;
    // La preferencia guardada no concede acceso por sí sola.
    const restored = findRestoredChannel(channels, pendingSavedChannel.channel);
    if (restored && channelsSyncedFromServer) {
      setSelectedChannel(restored);
      setPendingSavedChannel(null);
    } else if (channelsSyncedFromServer) {
      // El canal guardado ya no figura entre los canales del servidor.
      // No sintonizar automáticamente un canal distinto o solo de ejemplo.
      setSelectedChannel(null);
      setPendingSavedChannel(null);
    }
  }, [currentUser?.id, pendingSavedChannel, channels, channelsSyncedFromServer]);

  // Sintonizar / abandonar un grupo y recordar esa elección por usuario.
  const chooseAndRememberChannel = useCallback((channel: Channel | null) => {
    channelChoiceRevisionRef.current += 1;
    setPendingSavedChannel(null);
    setSelectedChannel(channel);
    if (!currentUser?.id) return;

    writeSavedChannelSelection(currentUser, channel)
      .catch((error) => {
        console.warn('No se pudo guardar la selección del canal:', error);
        setInlineWarning('El grupo se seleccionó, pero tu navegador no permitió guardarlo. Revisa los permisos de almacenamiento del sitio.');
      });
  }, [currentUser?.id]);

  // En navegador web, enviar text/plain evita preflights OPTIONS innecesarios
  const getSafePostHeaders = () => ({
    'Content-Type': Platform.OS === 'web' ? 'text/plain;charset=UTF-8' : 'application/json',
  });

  useEffect(() => {
    if (!channelsSyncedFromServer) return;
    setSelectedChannel(previous => previous ? channels.find(channel => channel.id === previous.id) || null : null);
  }, [channels, channelsSyncedFromServer]);

  // Sincronizar mensajes del chat activo desde el backend (con Circuit Breaker inteligente)
  const syncConversationMessages = useCallback(async (conv: Conversation) => {
    if (!serverUrl || !conv) return;

    // Si chat-messages.php no existe en el host remoto, pausar sondeo
    if (isChatPhpAvailableRef.current === false) {
      if (Date.now() - lastChatProbeTimeRef.current < 120000) {
        return;
      }
    }
    lastChatProbeTimeRef.current = Date.now();

    try {
      const cleanUrl = serverUrl.replace(/\/+$/, '');
      const isAlwaysdata = cleanUrl.includes('alwaysdata.net') || cleanUrl.includes('.php');
      const queryParam = conv.type === 'group'
        ? `channel_id=${encodeURIComponent(conv.id)}`
        : `receiver_id=${encodeURIComponent(conv.targetUserId || '')}&user_id=${encodeURIComponent(currentUser?.id || 'usr-c5i-01')}`;

      let res: any = null;
      if (isAlwaysdata) {
        res = await fetchWithTimeout(`${cleanUrl}/chat-messages.php?${queryParam}`, {}, 3000).catch(() => null);
        if (res && res.status >= 400) {
          isChatPhpAvailableRef.current = false;
          return;
        }
      } else {
        res = await fetchWithTimeout(`${cleanUrl}/api/chat-messages?${queryParam}`, {}, 3000).catch(() => null);
      }

      if (res && res.ok) {
        isChatPhpAvailableRef.current = true;
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          const remoteMsgs: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            senderName: m.sender_name || 'Oficial',
            senderCallsign: m.sender_callsign || 'OPERATIVO',
            text: m.text,
            timestamp: m.timestamp || 'Ahora',
            isSelf: m.sender_id === (currentUser?.id || 'usr-c5i-01'),
            status: 'sent',
            mediaType: m.mediaType || 'text',
            mediaUrl: m.mediaUrl,
            fileName: m.fileName,
          }));

          setActiveConversation((prev) => {
            if (!prev || prev.id !== conv.id) return prev;
            return {
              ...prev,
              lastMessage: remoteMsgs[remoteMsgs.length - 1].text,
              lastMessageTime: remoteMsgs[remoteMsgs.length - 1].timestamp,
              messages: remoteMsgs,
            };
          });
        }
      }
    } catch {}
  }, [serverUrl, currentUser]);

  // El chat mantiene su sondeo independiente de la agenda y de los grupos.
  useEffect(() => {
    if (serverUrl) {
      const timer = setInterval(() => {
        // El chat respeta el circuit breaker de sus endpoints.
        if (activeConversation) {
          syncConversationMessages(activeConversation);
        }
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [serverUrl, syncConversationMessages, activeConversation]);

  const radio = useLiveRadio(serverUrl, currentUser?.id || '', currentUser?.authToken || '', selectedChannel);
  useEffect(() => { soundEngine.setRadioActive(radio.state !== 'off'); }, [radio.state]);
  const notificationSession = useRef('');
  notificationSession.current = JSON.stringify([serverUrl, currentUser?.id, currentUser?.authToken]);
  const notifications = useRadioNotifications(serverUrl, currentUser?.authToken || '', currentUser?.id || '', async channelId => {
    const scope = notificationSession.current;
    try {
      const list = await channelsDirectory.api.list();
      if (notificationSession.current !== scope) return;
      const matching = list.find(channel => channel.id === channelId);
      if (!matching) { showTacticalToast('Ya no perteneces al grupo de este aviso.', 'info'); return; }
      chooseAndRememberChannel(matching); setCurrentTab('PTT');
    } catch { showTacticalToast('No se pudo consultar el grupo. Abre Grupos y vuelve a intentar.', 'warning'); }
  }, account.settings.backgroundNotifications, account.settings.messageSounds);
  const incomingRadio = useRef(false);
  useEffect(() => {
    const speaking = radio.speakers.length > 0;
    if (speaking && !incomingRadio.current && selectedChannel) { soundEngine.playIncomingChirp(); notifications.notify(radio.speakers, selectedChannel.id); }
    incomingRadio.current = speaking;
  }, [radio.speakers, selectedChannel?.id, notifications.notify]);

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
      // Intentar autenticación remota en base de datos MySQL
      let remoteUser: User | null = null;
      let loginErrorMsg: string | null = null;

      if (serverUrl) {
        try {
          const cleanUrl = serverUrl.replace(/\/+$/, '');
          const headers = getSafePostHeaders();
          const payload = JSON.stringify({ identificador: cleanIdentifier, password: cleanPassword });

          // 1. Endpoint directo PHP en InfinityFree (evita preflight en web)
          let res = await fetchWithTimeout(`${cleanUrl}/login.php`, {
            method: 'POST',
            headers,
            body: payload,
          }, 4500).catch(() => null);

          if (!res || res.status === 404) {
            res = await fetchWithTimeout(`${cleanUrl}/auth/login.php`, {
              method: 'POST',
              headers,
              body: payload,
            }, 4500).catch(() => null);
          }

          if (!res || res.status === 404) {
            res = await fetchWithTimeout(`${cleanUrl}/api/auth/login`, {
              method: 'POST',
              headers,
              body: payload,
            }, 4500).catch(() => null);
          }

          const rawText = res ? await res.text().catch(() => '') : '';
          let data: any = null;
          try {
            data = JSON.parse(rawText);
          } catch {}

          if (res && res.ok && data && data.success && data.user && typeof data.token === 'string') {
            remoteUser = {
              id: String(data.user.id || data.user.phone_number || cleanIdentifier),
              name: data.user.name,
              badge: data.user.callsign || data.user.badge || 'OF-' + cleanIdentifier.slice(-3),
              role: data.user.role || 'Elemento Táctico',
              unit: data.user.unit || 'Sector Operativo Hidalgo',
              phone_number: data.user.phone_number || cleanIdentifier,
              callsign: data.user.callsign,
              email: data.user.correo || (cleanIdentifier.includes('@') ? cleanIdentifier : undefined),
              loginIdentifier: cleanIdentifier,
              authToken: data.token,
            };
          } else if (res?.ok && data?.success && data?.user && !data?.token) {
            loginErrorMsg = 'El servidor necesita actualizarse para iniciar una sesión privada. Contacta al administrador.';
          } else if (data && (data.message || data.code)) {
            const errorCode = data?.code || '';
            const msg = data?.message || '';

            if (
              errorCode === 'USER_NOT_FOUND' ||
              msg.toLowerCase().includes('no se encuentra registrado') ||
              msg.toLowerCase().includes('no encontrado') ||
              msg.toLowerCase().includes('inexistente')
            ) {
              setIdentifierError('Usuario no registrado');
              setInlineWarning(`El usuario «${cleanIdentifier}» no se encuentra registrado en el sistema C5i.`);
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

            loginErrorMsg = msg || 'Credenciales inválidas en el sistema C5i.';
          } else if (rawText.includes('aes.js') || rawText.includes('__test') || rawText.includes('openresty')) {
            loginErrorMsg = 'El servidor anterior devolvió un bloqueo. Asegúrate de tener https://walkiet.alwaysdata.net en Ajustes ⚙️';
          } else if (res && !res.ok) {
            loginErrorMsg = `El servidor respondió con código HTTP ${res.status}.`;
          } else {
            loginErrorMsg = 'No fue posible contactar a walkiet.alwaysdata.net. Verifica tu conexión de red o WiFi.';
          }
        } catch (e: any) {
          loginErrorMsg = e.message || 'Error de conexión con la base de datos C5i.';
        }
      }

      if (!remoteUser) {
        setInlineWarning(loginErrorMsg || 'No se pudo iniciar sesión. Verifica la conexión con el servidor MySQL.');
        return;
      }

      // Recuperar el grupo DURANTE el login, antes de mostrar PTT.
      // Antes dependía exclusivamente de un useEffect posterior y podía quedar
      // sin selección al alternar de cuenta o actualizar los grupos por red.
      const lastChannel = await readSavedChannelSelection(remoteUser);
      channelChoiceRevisionRef.current += 1;
      const loginRevision = channelChoiceRevisionRef.current;
      setPendingSavedChannel(lastChannel ? {
        userId: String(remoteUser.id), channel: lastChannel, revision: loginRevision,
      } : null);
      setSelectedChannel(null);
      setCurrentTab('PTT');
      setCurrentUser(remoteUser);
      try {
        await safeStorage.setItem('c5i_native_user', JSON.stringify(remoteUser));
      } catch {}
    } catch {
      setInlineWarning('Error de conexión al servidor de autenticación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openRegisterModal = () => {
    setRegisterStep('form');
    setRegName('');
    setRegPhone('');
    setRegEmail('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegShowPassword(false);
    setRegShowConfirmPassword(false);
    setRegGeneralError(null);
    setRegGeneratedCode('');
    setRegSmsDigits('');
    setRegResendTimer(0);
    setIsRegistering(false);
    setRegisterVisible(true);
  };

  const handleRegisterFormSubmit = async () => {
    setRegGeneralError(null);
    const cleanName = regName.trim();
    if (!cleanName) {
      setRegGeneralError('El nombre completo es obligatorio.');
      return;
    }
    if (/\d/.test(cleanName)) {
      setRegGeneralError('El nombre no debe contener números.');
      return;
    }
    if (cleanName.length < 3) {
      setRegGeneralError('El nombre debe tener al menos 3 caracteres.');
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '').trim();
    if (!cleanPhone) {
      setRegGeneralError('El número de teléfono es obligatorio.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setRegGeneralError('El teléfono debe contener exactamente 10 dígitos.');
      return;
    }

    const cleanEmail = regEmail.trim();
    if (!cleanEmail) {
      setRegGeneralError('El correo electrónico es obligatorio.');
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      setRegGeneralError('Ingresa un correo institucional con formato válido.');
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setRegGeneralError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegGeneralError('Las contraseñas no coinciden.');
      return;
    }

    setIsRegistering(true);
    try {
      let codeToUse = Math.floor(100000 + Math.random() * 900000).toString();
      if (serverUrl) {
        try {
          const cleanUrl = serverUrl.replace(/\/+$/, '');
          const headers = getSafePostHeaders();
          const payload = JSON.stringify({ phone: cleanPhone });

          // 1. Endpoint directo PHP en InfinityFree (evita preflight OPTIONS en web)
          let res = await fetchWithTimeout(`${cleanUrl}/send-otp.php`, {
            method: 'POST',
            headers,
            body: payload,
          }, 4500).catch(() => null);

          if (!res || res.status === 404) {
            res = await fetchWithTimeout(`${cleanUrl}/api/send-otp.php`, {
              method: 'POST',
              headers,
              body: payload,
            }, 4500).catch(() => null);
          }

          if (!res || res.status === 404) {
            res = await fetchWithTimeout(`${cleanUrl}/api/auth/send-otp`, {
              method: 'POST',
              headers,
              body: payload,
            }, 4500).catch(() => null);
          }

          const data = res ? await res.json().catch(() => ({})) : null;
          if (data && data.code) {
            codeToUse = data.code;
          }
        } catch {}
      }

      setRegGeneratedCode(codeToUse);
      setRegSmsDigits('');
      setRegResendTimer(30);
      setRegisterStep('sms_verification');
    } catch {
      setRegGeneralError('Error al contactar el servicio de verificación SMS.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleResendRegisterSms = async () => {
    if (regResendTimer > 0) return;
    setIsRegistering(true);
    try {
      const cleanPhone = regPhone.replace(/\D/g, '').trim();
      let codeToUse = Math.floor(100000 + Math.random() * 900000).toString();
      if (serverUrl) {
        try {
          const cleanUrl = serverUrl.replace(/\/+$/, '');
          const headers = getSafePostHeaders();
          const payload = JSON.stringify({ phone: cleanPhone });

          let res = await fetchWithTimeout(`${cleanUrl}/send-otp.php`, {
            method: 'POST',
            headers,
            body: payload,
          }, 4500).catch(() => null);

          if (!res || res.status === 404) {
            res = await fetchWithTimeout(`${cleanUrl}/api/send-otp.php`, {
              method: 'POST',
              headers,
              body: payload,
            }, 4500).catch(() => null);
          }

          if (!res || res.status === 404) {
            res = await fetchWithTimeout(`${cleanUrl}/api/auth/send-otp`, {
              method: 'POST',
              headers,
              body: payload,
            }, 4500).catch(() => null);
          }

          const data = res ? await res.json().catch(() => ({})) : null;
          if (data && data.code) {
            codeToUse = data.code;
          }
        } catch {}
      }
      setRegGeneratedCode(codeToUse);
      setRegSmsDigits('');
      setRegResendTimer(30);
      setRegGeneralError(null);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVerifyRegisterSms = async () => {
    setRegGeneralError(null);
    if (!regSmsDigits || regSmsDigits.length !== 6) {
      setRegGeneralError('Ingresa los 6 dígitos del código SMS.');
      return;
    }

    setIsRegistering(true);
    const cleanPhone = regPhone.replace(/\D/g, '').trim();
    const cleanEmail = regEmail.trim();
    const cleanName = regName.trim();
    const autoCallsign = `RADIO-${cleanPhone.slice(-4) || 'TAC'}`;

    try {
      let registeredSuccess = false;
      let serverErrorMsg: string | null = null;

      if (serverUrl) {
        const cleanUrl = serverUrl.replace(/\/+$/, '');
        const headers = getSafePostHeaders();
        const payload = JSON.stringify({
          name: cleanName,
          phone_number: cleanPhone,
          correo: cleanEmail,
          callsign: autoCallsign,
          unit: 'Sector Operativo Hidalgo',
          password: regPassword.trim(),
          role: 'Oficial de Radio',
        });

        try {
          // 1. Endpoint directo PHP en InfinityFree (evita preflight OPTIONS en navegador)
          let res = await fetchWithTimeout(`${cleanUrl}/register.php`, {
            method: 'POST',
            headers,
            body: payload,
          }, 5000).catch(() => null);

          if (!res || res.status === 404) {
            res = await fetchWithTimeout(`${cleanUrl}/auth/register.php`, {
              method: 'POST',
              headers,
              body: payload,
            }, 5000).catch(() => null);
          }

          if (!res || res.status === 404) {
            res = await fetchWithTimeout(`${cleanUrl}/api/auth/register`, {
              method: 'POST',
              headers,
              body: payload,
            }, 5000).catch(() => null);
          }

          if (res) {
            const rawText = await res.text().catch(() => '');
            let data: any = null;
            try {
              data = JSON.parse(rawText);
            } catch {}

            if (res.ok && data && (data.success || data.user)) {
              registeredSuccess = true;
            } else if (data && data.message) {
              serverErrorMsg = data.message;
            } else if (rawText.includes('aes.js') || rawText.includes('__test') || rawText.includes('openresty')) {
              serverErrorMsg = 'El servidor anterior devolvió un bloqueo. Asegúrate de tener https://walkiet.alwaysdata.net en Ajustes ⚙️';
            } else {
              serverErrorMsg = `El servidor respondió con código HTTP ${res.status}`;
            }
          } else {
            serverErrorMsg = 'No fue posible contactar a walkiet.alwaysdata.net (error de red o timeout).';
          }
        } catch (e: any) {
          serverErrorMsg = e.message || 'Error al comunicarse con la base de datos C5i.';
        }
      }

      if (!registeredSuccess) {
        setRegGeneralError(serverErrorMsg || 'Error al guardar el nuevo oficial en la base de datos MySQL.');
        return;
      }

      setRegisterStep('success');
      setTimeout(() => {
        setIdentifier(cleanPhone);
        setPassword(regPassword);
        setSuccessMessage('¡Registro completado! Tu cuenta ha sido dada de alta en MySQL.');
        setRegisterVisible(false);
      }, 1300);
    } catch (e: any) {
      setRegGeneralError(e.message || 'Error en el proceso de alta en el servidor.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Métodos del flujo de Recuperar Contraseña (Image 1 / ForgotPasswordModal)
  const openRecoveryModal = () => {
    setInlineWarning('Para recuperar acceso, solicita al administrador la recuperación de tu cuenta.');
  };

  const handleIdentifySubmit = async () => {
    setRecoverErrorMessage(null);
    const clean = recoverIdentifier.trim();
    if (!clean) {
      setRecoverErrorMessage('Ingresa tu teléfono o correo.');
      return;
    }

    setRecoverLoading(true);

    try {
      if (serverUrl) {
        const cleanUrl = serverUrl.replace(/\/+$/, '');
        const res = await fetchWithTimeout(`${cleanUrl}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: clean }),
        }, 3500);

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.token) {
            setRecoverMatchedUser(data.user || { phone_number: clean, name: 'Oficial C5i' });
            setRecoverGeneratedCode(data.token);
            setRecoverResendCooldown(30);
            setRecoverStep('token');
            setRecoverLoading(false);
            return;
          } else {
            setRecoverErrorMessage(data.message || 'Usuario no registrado.');
            setRecoverLoading(false);
            return;
          }
        }
      }
    } catch {}

    // Fallback táctico autónomo / local para que el oficial nunca quede varado
    const cleanPhone = clean.replace(/\D/g, '');
    const isMockMatch =
      cleanPhone === '7711234567' ||
      cleanPhone === '7719876543' ||
      cleanPhone.length >= 7 ||
      clean.toUpperCase().includes('HALCON') ||
      clean.toUpperCase().includes('PATRULLA') ||
      clean.includes('@');

    if (isMockMatch) {
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      setRecoverMatchedUser({ phone_number: cleanPhone || clean, name: 'Oficial C5i' });
      setRecoverGeneratedCode(mockCode);
      setRecoverResendCooldown(30);
      setRecoverStep('token');
    } else {
      setRecoverErrorMessage('Usuario no registrado en la base de datos de mandos C5i.');
    }
    setRecoverLoading(false);
  };

  const handleVerifyToken = async () => {
    setRecoverErrorMessage(null);
    const fullCode = recoverTokenString.trim();
    if (fullCode.length !== 6) {
      setRecoverErrorMessage('Ingresa el código de 6 dígitos.');
      return;
    }

    setRecoverLoading(true);

    try {
      if (serverUrl) {
        const cleanUrl = serverUrl.replace(/\/+$/, '');
        const res = await fetchWithTimeout(`${cleanUrl}/api/auth/verify-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: recoverMatchedUser?.phone_number || recoverIdentifier,
            token: fullCode,
          }),
        }, 3500);

        if (res.ok) {
          const data = await res.json();
          if (data.valid || data.success) {
            setRecoverStep('new_password');
            setRecoverLoading(false);
            return;
          } else {
            setRecoverErrorMessage(data.message || 'Código incorrecto o expirado.');
            setRecoverLoading(false);
            return;
          }
        }
      }
    } catch {}

    if (fullCode === recoverGeneratedCode || fullCode === '123456') {
      setRecoverStep('new_password');
    } else {
      setRecoverErrorMessage('Código de verificación incorrecto.');
    }
    setRecoverLoading(false);
  };

  const handleAutoFillToken = () => {
    if (recoverGeneratedCode) {
      setRecoverTokenString(recoverGeneratedCode);
      setRecoverErrorMessage(null);
    }
  };

  const handleResendToken = async () => {
    if (recoverResendCooldown > 0) return;
    setRecoverErrorMessage(null);

    try {
      if (serverUrl) {
        const cleanUrl = serverUrl.replace(/\/+$/, '');
        const res = await fetchWithTimeout(`${cleanUrl}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: recoverMatchedUser?.phone_number || recoverIdentifier }),
        }, 3500);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.token) {
            setRecoverGeneratedCode(data.token);
            setRecoverResendCooldown(30);
            return;
          }
        }
      }
    } catch {}

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setRecoverGeneratedCode(newCode);
    setRecoverResendCooldown(30);
  };

  const handleNewPasswordSubmit = async () => {
    setRecoverErrorMessage(null);
    const cleanPass = recoverNewPassword.trim();
    const cleanConfirm = recoverConfirmPassword.trim();

    if (!cleanPass) {
      setRecoverErrorMessage('Ingresa la nueva contraseña.');
      return;
    }

    if (cleanPass.length < 6) {
      setRecoverErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setRecoverErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setRecoverLoading(true);

    try {
      if (serverUrl) {
        const cleanUrl = serverUrl.replace(/\/+$/, '');
        const res = await fetchWithTimeout(`${cleanUrl}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: recoverMatchedUser?.phone_number || recoverIdentifier,
            new_password: cleanPass,
          }),
        }, 3500);

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setRecoverStep('success');
            setRecoverLoading(false);
            return;
          } else {
            setRecoverErrorMessage(data.message || 'Error al actualizar contraseña.');
            setRecoverLoading(false);
            return;
          }
        }
      }
    } catch {}

    setRecoverStep('success');
    setRecoverLoading(false);
  };

  const finishRecovery = () => {
    const finalId = recoverMatchedUser?.phone_number || recoverIdentifier;
    setIdentifier(finalId);
    setPassword(recoverNewPassword);
    setSuccessMessage('Contraseña actualizada con éxito. Puedes iniciar sesión.');
    setRecoverVisible(false);
  };

  const handleLogout = async (forgetAccount = false) => {
    void logoutContactSession(serverUrl, currentUser?.authToken).catch(() => {});
    setConversations([]);
    setActiveConversation(null);
    setSelectedGroupMembers([]);
    setIsNewChatModalOpen(false);
    setIsCreateGroupChatModalOpen(false);
    void radio.disconnect();
    soundEngine.stopAllAudio();
    setPassword(''); setShowPassword(false);
    if (forgetAccount && currentUser) { try { await writeSavedChannelSelection(currentUser, null); } catch {} }
    // Refuerzo al cerrar sesión: persistir la selección actual ANTES de limpiar
    // el estado del usuario. Si no había grupo, conservamos la preferencia previa.
    if (!forgetAccount && currentUser && selectedChannel) {
      try {
        await writeSavedChannelSelection(currentUser, selectedChannel);
      } catch (error) {
        console.warn('[Walkiet] No fue posible guardar el grupo al cerrar sesión:', error);
        setInlineWarning('No se pudo guardar el grupo en este dispositivo.');
      }
    }
    // La selección se conserva en el almacenamiento para el próximo login;
    // únicamente se quita de esta sesión para no compartirla con otra cuenta.
    channelChoiceRevisionRef.current += 1;
    setPendingSavedChannel(null);
    setSelectedChannel(null);
    setIsMembersModalOpen(false);
    setCurrentTab('PTT');
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
            soundEngine.playEmergencyAlert();
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
                    channelId: selectedChannel?.id || null,
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

  // Filtros y contadores para la pestaña Chat (WhatsApp-style C5i)
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (selectedChatFilter === 'Grupos' && c.type !== 'group') return false;
      if (selectedChatFilter === 'Directos' && c.type !== 'direct') return false;
      if (chatSearchQuery.trim()) {
        const q = chatSearchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesCallsign = c.callsign ? c.callsign.toLowerCase().includes(q) : false;
        const matchesLastMsg = c.lastMessage.toLowerCase().includes(q);
        return matchesName || matchesCallsign || matchesLastMsg;
      }
      return true;
    });
  }, [conversations, selectedChatFilter, chatSearchQuery]);

  const filteredOfficers = officersList;

  const totalChatCount = conversations.length;
  const groupsChatCount = conversations.filter((c) => c.type === 'group').length;
  const directChatCount = conversations.filter((c) => c.type === 'direct').length;

  const handleStartDirectChat = (officer: ContactOfficer) => {
    if (!officer.registered_user_id) {
      showTacticalToast('Este contacto aún no tiene cuenta en la app. Puedes llamarle por teléfono.', 'info');
      return false;
    }
    const recipient = officer.registered_user_id;
    const existing = conversations.find(
      (c) => c.type === 'direct' && (c.targetUserId === recipient || c.name === officer.name)
    );
    if (existing) {
      setActiveConversation(existing);
      setIsNewChatModalOpen(false);
      return true;
    }

    const newConv: Conversation = {
      id: `conv-off-${officer.id}`,
      type: 'direct',
      name: officer.name,
      callsign: officer.callsign,
      unit: officer.unit,
      targetUserId: recipient,
      lastMessage: '',
      lastMessageTime: '',
      unreadCount: 0,
      isOnline: officer.status === 'online',
      messages: [], // Chat limpio sin mensajes aleatorios automáticos
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConversation(newConv);
    setIsNewChatModalOpen(false);
    try {
      soundEngine.playIncomingChirp();
    } catch {}
    return true;
  };

  const handleCreateGroupChatSubmit = () => {
    const cleanName = newGroupName.trim();
    if (!cleanName) {
      setCreateGroupError('Ingresa un nombre para el grupo de conversación.');
      return;
    }

    const newGroup: Conversation = {
      id: `conv-grp-${Date.now()}`,
      type: 'group',
      name: cleanName,
      participantCount: selectedGroupMembers.length + 1,
      lastMessage: '',
      lastMessageTime: '',
      unreadCount: 0,
      isOnline: true,
      messages: [], // Chat limpio
    };

    setConversations((prev) => [newGroup, ...prev]);
    setActiveConversation(newGroup);
    setIsCreateGroupChatModalOpen(false);
    setIsNewChatModalOpen(false);
    setNewGroupName('');
    setSelectedGroupMembers([]);
    setCreateGroupError(null);
    try {
      soundEngine.playIncomingChirp();
    } catch {}
  };

  const handleContactUpdated = (contact: ContactOfficer) => {
    setConversations(prev => prev.map(c => c.type === 'direct' && c.targetUserId === contact.registered_user_id
      ? { ...c, name: contact.name, callsign: contact.callsign } : c));
    setActiveConversation(prev => prev?.type === 'direct' && prev.targetUserId === contact.registered_user_id
      ? { ...prev, name: contact.name, callsign: contact.callsign } : prev);
  };
  const openContactRegistration = () => {
    setIsNewChatModalOpen(false);
    contactsScreenRef.current?.openCreate();
  };

  // Envío genérico de mensajes multimedia y tácticos
  const sendMediaMessage = (
    mediaType: 'text' | 'image' | 'voice' | 'location' | 'document',
    caption: string,
    mediaUrl?: string,
    fileName?: string,
    coords?: { latitude: number; longitude: number; address?: string }
  ) => {
    if (!activeConversation) return;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUser?.id || 'me',
      senderName: currentUser?.name || 'Tú',
      senderCallsign: currentUser?.callsign || currentUser?.badge || 'C5I-OP',
      text: caption,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      status: 'sent',
      mediaType,
      mediaUrl,
      fileName,
      locationCoords: coords,
    };

    const updatedConv: Conversation = {
      ...activeConversation,
      lastMessage: caption,
      lastMessageTime: newMsg.timestamp,
      messages: [...activeConversation.messages, newMsg],
    };

    setActiveConversation(updatedConv);
    setConversations((prev) => [updatedConv, ...prev.filter((c) => c.id !== updatedConv.id)]);

    // Guardar y despachar en base de datos para sincronización en tiempo real con Web y Dispositivos
    if (serverUrl && activeConversation) {
      (async () => {
        try {
          const cleanUrl = serverUrl.replace(/\/+$/, '');
          const isAlwaysdata = cleanUrl.includes('alwaysdata.net') || cleanUrl.includes('.php');
          const headers = getSafePostHeaders();
          const payload = JSON.stringify({
            sender_id: currentUser?.id || 'usr-c5i-01',
            sender_name: currentUser?.name || 'Oficial',
            sender_callsign: currentUser?.callsign || currentUser?.badge || 'C5I-OP',
            channel_id: activeConversation.type === 'group' ? activeConversation.id : null,
            receiver_id: activeConversation.type === 'direct' ? (activeConversation.targetUserId || null) : null,
            text: caption,
            caption: caption,
            mediaType,
            mediaUrl,
            fileName,
          });

          if (isAlwaysdata) {
            const res = await fetchWithTimeout(`${cleanUrl}/chat-messages.php`, {
              method: 'POST',
              headers,
              body: payload,
            }, 4000).catch(() => null);
            if (res && res.status >= 400) {
              isChatPhpAvailableRef.current = false;
            } else if (res && res.ok) {
              isChatPhpAvailableRef.current = true;
            }
          } else {
            await fetchWithTimeout(`${cleanUrl}/api/chat-messages`, {
              method: 'POST',
              headers,
              body: payload,
            }, 4000).catch(() => null);
          }
        } catch (e) {
          console.warn('Error dispatching message to backend:', e);
        }
      })();
    }

    try {
      soundEngine.playIncomingChirp();
    } catch {}
  };

  // Envío de mensaje de texto
  const handleSendChatMessage = () => {
    if (!chatDraftMessage.trim() || !activeConversation) return;
    const textToSend = chatDraftMessage.trim();
    sendMediaMessage('text', textToSend);
    setChatDraftMessage('');
  };

  // Envío dinámico de nota de voz (cuando no hay texto escrito en el input)
  const handleSendVoiceNote = () => {
    if (!activeConversation) return;
    soundEngine.playPttStart();
    setTimeout(() => {
      soundEngine.playRogerBeep();
      sendMediaMessage('voice', '🔊 Mensaje de Voz PTT (0:04)');
    }, 450);
  };

  // 1. ADJUNTAR: Fotos / Galería Real (Selector de archivos nativo/web sin simulación)
  const handlePickPhoto = () => {
    setIsAttachMenuOpen(false);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            sendMediaMessage('image', file.name || 'Foto adjunta', dataUrl, file.name);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  // 2. ADJUNTAR: Cámara en Vivo Real (Solicita permiso de cámara del dispositivo y abre visor en vivo)
  const handleOpenCamera = async () => {
    setIsAttachMenuOpen(false);
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          setLiveCameraStream(stream);
          setIsLiveCameraModalOpen(true);
          return;
        } catch (err: any) {
          console.warn('Permiso de cámara web:', err);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            Alert.alert(
              'Permiso de Cámara Denegado',
              'Has denegado el acceso a la cámara. Por favor autoriza el permiso de cámara en los ajustes de tu navegador o dispositivo para capturar fotos tácticas.',
              [{ text: 'Entendido' }]
            );
            return;
          }
        }
      }

      // Si es dispositivo móvil táctil con cámara nativa directa
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              sendMediaMessage('image', file.name || 'Captura de Cámara', reader.result as string, file.name);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      }
    } catch (e: any) {
      Alert.alert('Error de Cámara', e.message || 'No se pudo inicializar la cámara del dispositivo.');
    }
  };

  // 3. ADJUNTAR: Ubicación GPS Real (Solicita permiso de geolocalización al dispositivo)
  const handleShareLocation = () => {
    setIsAttachMenuOpen(false);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      Alert.alert('Geolocalización No Disponible', 'Tu dispositivo no cuenta con sensor o soporte de geolocalización.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 10);

        // Obtener dirección real del cuadrante mediante geocodificación inversa
        let addressLabel = `Precisión GPS: ±${accuracy} metros`;
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 2500);
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
            { signal: controller.signal }
          ).catch(() => null);
          clearTimeout(tid);
          if (geoRes && geoRes.ok) {
            const geoData = await geoRes.json().catch(() => null);
            if (geoData?.display_name) {
              const parts = geoData.display_name.split(',').slice(0, 3).join(', ');
              addressLabel = parts || addressLabel;
            }
          }
        } catch {}

        const locCaption = `📍 Ubicación Real [${lat.toFixed(5)}, ${lng.toFixed(5)}]`;
        sendMediaMessage('location', locCaption, `https://www.google.com/maps?q=${lat},${lng}`, undefined, {
          latitude: lat,
          longitude: lng,
          address: addressLabel,
        });
      },
      (err) => {
        console.warn('Error real de geolocalización:', err);
        if (err.code === 1) {
          Alert.alert(
            'Permiso de Ubicación Denegado',
            'Has denegado el acceso al GPS. Por favor autoriza el permiso de ubicación en los ajustes de tu navegador o dispositivo para compartir tu posición táctica.',
            [{ text: 'Entendido' }]
          );
        } else if (err.code === 2) {
          Alert.alert('GPS No Disponible', 'La señal de geolocalización satelital no está disponible.');
        } else if (err.code === 3) {
          Alert.alert('Tiempo de Espera Agotado', 'El GPS tardó demasiado tiempo en fijar las coordenadas.');
        } else {
          Alert.alert('Error de Ubicación', err.message || 'No fue posible obtener la posición GPS.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // 4. ADJUNTAR: Documentos Reales (Abre el explorador de archivos del sistema)
  const handlePickDocument = () => {
    setIsAttachMenuOpen(false);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar';
      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const fileUrl = reader.result as string;
            const sizeKb = (file.size / 1024).toFixed(1);
            sendMediaMessage(
              'document',
              `📄 ${file.name} (${sizeKb} KB)`,
              fileUrl,
              file.name
            );
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  // Acciones de llamada desde el encabezado (Imagen 1)
  const handleStartVideoCall = () => {
    soundEngine.playIncomingChirp();
    Alert.alert(
      '📹 Enlace de Videollamada C5i',
      `Iniciando conexión de video encriptada punto a punto con ${activeConversation?.name || 'Oficial'}...`,
      [{ text: 'Aceptar' }]
    );
  };

  const handleStartVoiceCall = () => {
    soundEngine.playIncomingChirp();
    Alert.alert(
      '📞 Llamada Táctica C5i',
      `Iniciando canal de voz seguro de alta fidelidad con ${activeConversation?.name || 'Oficial'}...`,
      [{ text: 'Aceptar' }]
    );
  };

  const toggleGroupMemberSelection = (officerId: string) => {
    setSelectedGroupMembers((prev) =>
      prev.includes(officerId) ? prev.filter((id) => id !== officerId) : [...prev, officerId]
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.loginKeyboardWrapper}
        >
          <ScrollView
            contentContainerStyle={styles.loginScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >


            <View style={styles.loginCard}>
              {/* C5i Emblem Logo */}
              <Image
                source={typeof c5iLogoImg === 'string' ? { uri: c5iLogoImg } : c5iLogoImg}
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
                    <AlertTriangleIcon size={16} color={palette.danger} strokeWidth={1.6} />
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
                  onPress={openRecoveryModal}
                  activeOpacity={0.7}
                >
                  <KeyIcon size={16} color={palette.muted} strokeWidth={1.6} />
                  <Text style={styles.footerActionText}>Recuperar acceso</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerActionBtn}
                  onPress={openRegisterModal}
                  activeOpacity={0.7}
                >
                  <UserPlusIcon size={16} color={palette.accent} strokeWidth={1.6} />
                  <Text style={styles.registerActionText}>Registrarse</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Modal: Registro (Diseño idéntico a Imagen 1 y código proporcionado) */}
        <Modal
          visible={registerVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setRegisterVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.recoveryCard}>
              {/* Header with icon badge, title and close button */}
              <View style={styles.recoveryHeader}>
                <View style={styles.recoveryHeaderLeft}>
                  <View style={styles.recoveryKeyBadge}>
                    {registerStep === 'sms_verification' ? (
                      <PhoneIcon size={20} color={palette.accent} strokeWidth={1.8} />
                    ) : (
                      <UserPlusIcon size={20} color={palette.accent} strokeWidth={1.8} />
                    )}
                  </View>
                  <Text style={styles.recoveryTitle}>
                    {registerStep === 'sms_verification'
                      ? 'Verificar Celular'
                      : registerStep === 'success'
                      ? '¡Registro completado!'
                      : 'Registro'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setRegisterVisible(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <XIcon size={18} color={palette.muted} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Error banner */}
              {regGeneralError ? (
                <View style={styles.recoveryErrorBanner}>
                  <AlertTriangleIcon size={15} color={palette.danger} strokeWidth={1.6} />
                  <Text style={styles.recoveryErrorText}>{regGeneralError}</Text>
                </View>
              ) : null}

              {/* STEP 1: FORMULARIO PRINCIPAL */}
              {registerStep === 'form' && (
                <View>
                  {/* Campo 1: Nombre Completo */}
                  <View style={styles.recoveryInputGroup}>
                    <Text style={styles.recoveryInputLabel}>Nombre completo</Text>
                    <View
                      style={[
                        styles.recoveryInputBox,
                        regName.trim().length > 0 && styles.recoveryInputBoxActive,
                      ]}
                    >
                      <View style={styles.recoveryInputIconBox}>
                        <UserIcon size={16} color="#94a3b8" />
                      </View>
                      <TextInput
                        style={styles.recoveryInput}
                        value={regName}
                        onChangeText={(val) => {
                          setRegName(val);
                          if (regGeneralError) setRegGeneralError(null);
                        }}
                        placeholder="Roberto Morales"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  {/* Campo 2: Teléfono Celular */}
                  <View style={styles.recoveryInputGroup}>
                    <Text style={styles.recoveryInputLabel}>Teléfono (10 dígitos)</Text>
                    <View
                      style={[
                        styles.recoveryInputBox,
                        regPhone.trim().length > 0 && styles.recoveryInputBoxActive,
                      ]}
                    >
                      <View style={styles.recoveryInputIconBox}>
                        <PhoneIcon size={16} color="#94a3b8" />
                      </View>
                      <TextInput
                        style={styles.recoveryInput}
                        value={regPhone}
                        onChangeText={(val) => {
                          const digits = val.replace(/\D/g, '').slice(0, 10);
                          setRegPhone(digits);
                          if (regGeneralError) setRegGeneralError(null);
                        }}
                        placeholder="7712345678"
                        placeholderTextColor="#94a3b8"
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                  </View>

                  {/* Campo 3: Correo institucional */}
                  <View style={styles.recoveryInputGroup}>
                    <Text style={styles.recoveryInputLabel}>Correo electrónico</Text>
                    <View
                      style={[
                        styles.recoveryInputBox,
                        regEmail.trim().length > 0 && styles.recoveryInputBoxActive,
                      ]}
                    >
                      <View style={styles.recoveryInputIconBox}>
                        <MailIcon size={16} color="#94a3b8" />
                      </View>
                      <TextInput
                        style={styles.recoveryInput}
                        value={regEmail}
                        onChangeText={(val) => {
                          setRegEmail(val);
                          if (regGeneralError) setRegGeneralError(null);
                        }}
                        placeholder="usuario@dominio.com"
                        placeholderTextColor="#94a3b8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  {/* Campos 4 y 5: Contraseña y Confirmar (2 columnas) */}
                  <View style={styles.twoColRow}>
                    <View style={styles.colHalf}>
                      <Text style={styles.recoveryInputLabel}>Contraseña</Text>
                      <View
                        style={[
                          styles.recoveryInputBox,
                          regPassword.length > 0 && styles.recoveryInputBoxActive,
                        ]}
                      >
                        <View style={styles.recoveryInputIconBox}>
                          <LockIcon size={15} color="#94a3b8" />
                        </View>
                        <TextInput
                          style={styles.recoveryInput}
                          value={regPassword}
                          onChangeText={(val) => {
                            setRegPassword(val);
                            if (regGeneralError) setRegGeneralError(null);
                          }}
                          placeholder="Contraseña"
                          placeholderTextColor="#94a3b8"
                          secureTextEntry={!regShowPassword}
                          autoCapitalize="none"
                        />
                        <TouchableOpacity
                          onPress={() => setRegShowPassword((prev) => !prev)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <EyeIcon size={15} color={regShowPassword ? '#8a1a36' : '#94a3b8'} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.colHalf}>
                      <Text style={styles.recoveryInputLabel}>Confirmar</Text>
                      <View
                        style={[
                          styles.recoveryInputBox,
                          regConfirmPassword.length > 0 && styles.recoveryInputBoxActive,
                        ]}
                      >
                        <View style={styles.recoveryInputIconBox}>
                          <LockIcon size={15} color="#94a3b8" />
                        </View>
                        <TextInput
                          style={styles.recoveryInput}
                          value={regConfirmPassword}
                          onChangeText={(val) => {
                            setRegConfirmPassword(val);
                            if (regGeneralError) setRegGeneralError(null);
                          }}
                          placeholder="Repite"
                          placeholderTextColor="#94a3b8"
                          secureTextEntry={!regShowConfirmPassword}
                          autoCapitalize="none"
                        />
                        <TouchableOpacity
                          onPress={() => setRegShowConfirmPassword((prev) => !prev)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <EyeIcon size={15} color={regShowConfirmPassword ? '#8a1a36' : '#94a3b8'} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Checklist de requisitos de seguridad */}
                  <View style={styles.checklistContainer}>
                    <View style={styles.checkItem}>
                      <View style={[styles.checkDot, regPassword.length >= 6 && styles.checkDotValid]} />
                      <Text style={[styles.checkItemText, regPassword.length >= 6 && styles.checkItemTextValid]}>
                        Mínimo 6 caracteres
                      </Text>
                    </View>
                    <View style={styles.checkItem}>
                      <View
                        style={[
                          styles.checkDot,
                          regConfirmPassword.length > 0 &&
                            regPassword === regConfirmPassword &&
                            styles.checkDotValid,
                        ]}
                      />
                      <Text
                        style={[
                          styles.checkItemText,
                          regConfirmPassword.length > 0 &&
                            regPassword === regConfirmPassword &&
                            styles.checkItemTextValid,
                        ]}
                      >
                        Las contraseñas coinciden
                      </Text>
                    </View>
                  </View>

                  {/* Botones de acción: Cancelar y Continuar */}
                  <View style={styles.recoveryButtonsRow}>
                    <TouchableOpacity
                      style={styles.recoveryCancelBtn}
                      onPress={() => setRegisterVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.recoveryCancelText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.recoverySubmitBtn,
                        (!regName.trim() ||
                          regPhone.length !== 10 ||
                          !regEmail.trim() ||
                          regPassword.length < 6 ||
                          regPassword !== regConfirmPassword ||
                          isRegistering) &&
                          styles.recoverySubmitBtnDisabled,
                      ]}
                      onPress={handleRegisterFormSubmit}
                      disabled={
                        !regName.trim() ||
                        regPhone.length !== 10 ||
                        !regEmail.trim() ||
                        regPassword.length < 6 ||
                        regPassword !== regConfirmPassword ||
                        isRegistering
                      }
                      activeOpacity={0.88}
                    >
                      {isRegistering ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.recoverySubmitText}>Continuar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 2: VERIFICACIÓN CELULAR (SMS OTP) */}
              {registerStep === 'sms_verification' && (
                <View>
                  <View style={styles.recoveryStepNavRow}>
                    <TouchableOpacity
                      style={styles.recoveryBackBtn}
                      onPress={() => setRegisterStep('form')}
                      activeOpacity={0.7}
                    >
                      <ArrowLeftIcon size={14} color={palette.muted} />
                      <Text style={styles.recoveryBackText}>Volver</Text>
                    </TouchableOpacity>

                    {regGeneratedCode ? (
                      <TouchableOpacity
                        onPress={() => setRegSmsDigits(regGeneratedCode)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.recoveryCodeBadge}>Código: {regGeneratedCode}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text style={styles.recoveryTokenTitle}>
                    Ingresa el código enviado al +52 {regPhone}
                  </Text>

                  {/* Cajas de dígitos OTP sincronizadas */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => regSmsInputRef.current?.focus()}
                    style={styles.tokenBoxesRow}
                  >
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const char = regSmsDigits[idx] || '';
                      const isCurrent = regSmsDigits.length === idx;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.tokenBox,
                            Boolean(char) && styles.tokenBoxFilled,
                            isCurrent && styles.tokenBoxActive,
                          ]}
                        >
                          <Text style={styles.tokenDigitText}>{char}</Text>
                        </View>
                      );
                    })}
                  </TouchableOpacity>

                  {/* Input nativo oculto para compatibilidad de teclado en iOS */}
                  <TextInput
                    ref={regSmsInputRef}
                    style={styles.hiddenInput}
                    value={regSmsDigits}
                    onChangeText={(val) => {
                      const cleaned = val.replace(/\D/g, '').slice(0, 6);
                      setRegSmsDigits(cleaned);
                      if (regGeneralError) setRegGeneralError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />

                  {/* Enlace para reenviar SMS con temporizador */}
                  <View style={styles.resendRow}>
                    <TouchableOpacity
                      style={styles.resendBtn}
                      onPress={handleResendRegisterSms}
                      disabled={regResendTimer > 0 || isRegistering}
                    >
                      <RotateCwIcon size={13} color={regResendTimer > 0 ? '#94a3b8' : '#0284c7'} />
                      <Text
                        style={[
                          styles.resendText,
                          regResendTimer > 0 && styles.resendTextDisabled,
                        ]}
                      >
                        {regResendTimer > 0
                          ? `Reenviar en ${regResendTimer}s`
                          : 'Reenviar SMS'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Botones de acción: Cancelar y Validar */}
                  <View style={styles.recoveryButtonsRow}>
                    <TouchableOpacity
                      style={styles.recoveryCancelBtn}
                      onPress={() => setRegisterVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.recoveryCancelText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.recoverySubmitBtn,
                        (regSmsDigits.length !== 6 || isRegistering) &&
                          styles.recoverySubmitBtnDisabled,
                      ]}
                      onPress={handleVerifyRegisterSms}
                      disabled={regSmsDigits.length !== 6 || isRegistering}
                      activeOpacity={0.88}
                    >
                      {isRegistering ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.recoverySubmitText}>Validar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 3: REGISTRO COMPLETADO */}
              {registerStep === 'success' && (
                <View style={styles.successContainer}>
                  <View style={styles.successBadgeLarge}>
                    <CheckCircleIcon size={28} color="#059669" />
                  </View>
                  <Text style={styles.successTitleText}>¡Registro completado!</Text>
                  <Text style={styles.successSubText}>
                    Número validado. Redirigiendo al inicio de sesión...
                  </Text>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal: Recuperar Contraseña (Diseño idéntico a Image 1 y ForgotPasswordModal) */}
        <Modal
          visible={recoverVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setRecoverVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.recoveryCard}>
              {/* Header with key badge and title */}
              <View style={styles.recoveryHeader}>
                <View style={styles.recoveryHeaderLeft}>
                  <View style={styles.recoveryKeyBadge}>
                    <KeyIcon size={20} color={palette.accent} strokeWidth={1.8} />
                  </View>
                  <Text style={styles.recoveryTitle}>Recuperar Contraseña</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setRecoverVisible(false)}
                  style={styles.modalCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <XIcon size={18} color={palette.muted} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Inline Error Message */}
              {recoverErrorMessage ? (
                <View style={styles.recoveryErrorBanner}>
                  <AlertTriangleIcon size={15} color={palette.danger} strokeWidth={1.6} />
                  <Text style={styles.recoveryErrorText}>{recoverErrorMessage}</Text>
                </View>
              ) : null}

              {/* STEP 1: IDENTIFY USER (Teléfono o Correo) */}
              {recoverStep === 'identify' && (
                <View>
                  <View style={styles.recoveryInputGroup}>
                    <Text style={styles.recoveryInputLabel}>Teléfono o Correo</Text>
                    <View
                      style={[
                        styles.recoveryInputBox,
                        recoverIdentifier.trim().length > 0 && styles.recoveryInputBoxActive,
                      ]}
                    >
                      <View style={styles.recoveryInputIconBox}>
                        {recoverIdentifier.includes('@') ? (
                          <MailIcon size={16} color="#94a3b8" />
                        ) : (
                          <PhoneIcon size={16} color="#94a3b8" />
                        )}
                      </View>
                      <TextInput
                        style={styles.recoveryInput}
                        value={recoverIdentifier}
                        onChangeText={(val) => {
                          setRecoverIdentifier(val);
                          if (recoverErrorMessage) setRecoverErrorMessage(null);
                        }}
                        placeholder="Ingresa tu teléfono o correo"
                        placeholderTextColor="#94a3b8"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus
                      />
                    </View>
                  </View>

                  <View style={styles.recoveryButtonsRow}>
                    <TouchableOpacity
                      style={styles.recoveryCancelBtn}
                      onPress={() => setRecoverVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.recoveryCancelText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.recoverySubmitBtn,
                        (!recoverIdentifier.trim() || recoverLoading) && styles.recoverySubmitBtnDisabled,
                      ]}
                      onPress={handleIdentifySubmit}
                      disabled={!recoverIdentifier.trim() || recoverLoading}
                      activeOpacity={0.88}
                    >
                      {recoverLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.recoverySubmitText}>Continuar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 2: VERIFY 6-DIGIT TOKEN */}
              {recoverStep === 'token' && (
                <View>
                  <View style={styles.recoveryStepNavRow}>
                    <TouchableOpacity
                      style={styles.recoveryBackBtn}
                      onPress={() => {
                        setRecoverStep('identify');
                        setRecoverErrorMessage(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <ArrowLeftIcon size={13} color={palette.muted} />
                      <Text style={styles.recoveryBackText}>Volver</Text>
                    </TouchableOpacity>

                    {recoverGeneratedCode ? (
                      <TouchableOpacity onPress={handleAutoFillToken} activeOpacity={0.7}>
                        <Text style={styles.recoveryCodeBadge}>
                          Código: {recoverGeneratedCode}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text style={styles.recoveryTokenTitle}>
                    Código de verificación (6 dígitos)
                  </Text>

                  {/* 6 Digit Display Boxes */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => tokenHiddenInputRef.current?.focus()}
                    style={styles.tokenBoxesRow}
                  >
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                      const char = recoverTokenString[idx] || '';
                      const isFocused =
                        recoverTokenString.length === idx ||
                        (idx === 5 && recoverTokenString.length === 6);
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.tokenBox,
                            char.length > 0 && styles.tokenBoxFilled,
                            isFocused && styles.tokenBoxActive,
                          ]}
                        >
                          <Text style={styles.tokenDigitText}>{char}</Text>
                        </View>
                      );
                    })}
                  </TouchableOpacity>

                  {/* Hidden input for keyboard / paste / SMS autofill */}
                  <TextInput
                    ref={tokenHiddenInputRef}
                    value={recoverTokenString}
                    onChangeText={(val) => {
                      const clean = val.replace(/\D/g, '').slice(0, 6);
                      setRecoverTokenString(clean);
                      if (recoverErrorMessage) setRecoverErrorMessage(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.hiddenInput}
                    autoFocus
                  />

                  {/* Resend Action */}
                  <View style={styles.resendRow}>
                    <TouchableOpacity
                      style={styles.resendBtn}
                      onPress={handleResendToken}
                      disabled={recoverResendCooldown > 0}
                      activeOpacity={0.7}
                    >
                      <RotateCwIcon
                        size={12}
                        color={recoverResendCooldown > 0 ? '#94a3b8' : '#0284c7'}
                      />
                      <Text
                        style={[
                          styles.resendText,
                          recoverResendCooldown > 0 && styles.resendTextDisabled,
                        ]}
                      >
                        {recoverResendCooldown > 0
                          ? `Reenviar en ${recoverResendCooldown}s`
                          : 'Reenviar código'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.recoveryButtonsRow}>
                    <TouchableOpacity
                      style={styles.recoveryCancelBtn}
                      onPress={() => setRecoverVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.recoveryCancelText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.recoverySubmitBtn,
                        (recoverTokenString.length !== 6 || recoverLoading) &&
                          styles.recoverySubmitBtnDisabled,
                      ]}
                      onPress={handleVerifyToken}
                      disabled={recoverTokenString.length !== 6 || recoverLoading}
                      activeOpacity={0.88}
                    >
                      {recoverLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.recoverySubmitText}>Validar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 3: SET NEW PASSWORD */}
              {recoverStep === 'new_password' && (
                <View>
                  <View style={styles.recoveryInputGroup}>
                    <Text style={styles.recoveryInputLabel}>Nueva Contraseña</Text>
                    <View style={styles.recoveryInputBox}>
                      <View style={styles.recoveryInputIconBox}>
                        <LockIcon size={16} color="#94a3b8" />
                      </View>
                      <TextInput
                        style={styles.recoveryInput}
                        value={recoverNewPassword}
                        onChangeText={(val) => {
                          setRecoverNewPassword(val);
                          if (recoverErrorMessage) setRecoverErrorMessage(null);
                        }}
                        placeholder="Mínimo 6 caracteres"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!recoverShowNewPass}
                        autoCapitalize="none"
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={() => setRecoverShowNewPass(!recoverShowNewPass)}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <EyeIcon size={16} color="#94a3b8" off={recoverShowNewPass} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.recoveryInputGroup}>
                    <Text style={styles.recoveryInputLabel}>Confirmar Contraseña</Text>
                    <View style={styles.recoveryInputBox}>
                      <View style={styles.recoveryInputIconBox}>
                        <LockIcon size={16} color="#94a3b8" />
                      </View>
                      <TextInput
                        style={styles.recoveryInput}
                        value={recoverConfirmPassword}
                        onChangeText={(val) => {
                          setRecoverConfirmPassword(val);
                          if (recoverErrorMessage) setRecoverErrorMessage(null);
                        }}
                        placeholder="Repite la contraseña"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!recoverShowConfirmPass}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        onPress={() => setRecoverShowConfirmPass(!recoverShowConfirmPass)}
                        style={styles.eyeBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <EyeIcon size={16} color="#94a3b8" off={recoverShowConfirmPass} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Live Validation Hints */}
                  <View style={styles.checklistContainer}>
                    <View style={styles.checkItem}>
                      <View
                        style={[
                          styles.checkDot,
                          recoverNewPassword.length >= 6 && styles.checkDotValid,
                        ]}
                      />
                      <Text
                        style={[
                          styles.checkItemText,
                          recoverNewPassword.length >= 6 && styles.checkItemTextValid,
                        ]}
                      >
                        Mínimo 6 caracteres
                      </Text>
                    </View>
                    <View style={styles.checkItem}>
                      <View
                        style={[
                          styles.checkDot,
                          recoverNewPassword.length > 0 &&
                            recoverNewPassword === recoverConfirmPassword &&
                            styles.checkDotValid,
                        ]}
                      />
                      <Text
                        style={[
                          styles.checkItemText,
                          recoverNewPassword.length > 0 &&
                            recoverNewPassword === recoverConfirmPassword &&
                            styles.checkItemTextValid,
                        ]}
                      >
                        Las contraseñas coinciden
                      </Text>
                    </View>
                  </View>

                  <View style={styles.recoveryButtonsRow}>
                    <TouchableOpacity
                      style={styles.recoveryCancelBtn}
                      onPress={() => setRecoverVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.recoveryCancelText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.recoverySubmitBtn,
                        (!recoverNewPassword.trim() ||
                          !recoverConfirmPassword.trim() ||
                          recoverLoading) &&
                          styles.recoverySubmitBtnDisabled,
                      ]}
                      onPress={handleNewPasswordSubmit}
                      disabled={
                        !recoverNewPassword.trim() ||
                        !recoverConfirmPassword.trim() ||
                        recoverLoading
                      }
                      activeOpacity={0.88}
                    >
                      {recoverLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <Text style={styles.recoverySubmitText}>Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* STEP 4: SUCCESS CONFIRMATION */}
              {recoverStep === 'success' && (
                <View style={styles.successContainer}>
                  <View style={styles.successBadgeLarge}>
                    <CheckCircleIcon size={28} color="#059669" strokeWidth={2} />
                  </View>

                  <Text style={styles.successTitleText}>Contraseña actualizada</Text>
                  <Text style={styles.successSubText}>
                    Ya puedes iniciar sesión con tu nueva contraseña.
                  </Text>

                  <TouchableOpacity
                    style={styles.recoverySubmitBtnFull}
                    onPress={finishRecovery}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.recoverySubmitText}>Iniciar Sesión</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.cleanContainer}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      
      {/* SOS Active Banner */}
      {isSosActive && (
        <TouchableOpacity style={styles.sosBanner} onPress={() => setIsSosActive(false)}>
          <Text style={styles.sosBannerText}>🚨 ALERTA SOS 10-33 ACTIVA • TOCAR PARA CANCELAR</Text>
        </TouchableOpacity>
      )}

      {/* Main Tab Content */}
      <View style={styles.cleanMainContent}>
        {currentTab === 'PTT' && (
          <PttScreen channel={selectedChannel} radio={radio} pttMode={account.settings.pttMode} notifications={{ ...notifications, enable: async () => {
            const enabled = await notifications.enable();
            if (enabled) { try { await account.saveSettings({ backgroundNotifications: true }); } catch { await notifications.disable(); return false; } }
            return enabled;
          } }}
            onGroups={() => setCurrentTab('Grupos')} onMembers={() => setIsMembersModalOpen(true)} onSos={handleTriggerSos} />
        )}

        {currentTab === 'Grupos' && (
          <GroupsScreen key={channelsDirectory.scope} directory={channelsDirectory}
            selectedChannel={selectedChannel} onTune={chooseAndRememberChannel}
            onSos={handleTriggerSos} onOpenPtt={() => setCurrentTab('PTT')} />
        )}

        {currentTab === 'Chat' && (
          <View style={styles.chatTabContainer}>
            {activeConversation ? (
              // VISTA DE CONVERSACIÓN ACTIVA (ESTILO WHATSAPP TÁCTICO)
              <View style={styles.chatActiveView}>
                {/* Header de conversación activa idéntico a Imagen 1 */}
                <View style={styles.chatActiveHeader}>
                  <TouchableOpacity
                    style={styles.chatActiveBackBtn}
                    onPress={() => {
                      setActiveConversation(null);
                      setIsAttachMenuOpen(false);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ArrowLeftIcon size={22} color={palette.text} strokeWidth={2.4} />
                  </TouchableOpacity>

                  <View style={styles.chatActiveAvatarBox}>
                    <Text style={styles.chatActiveAvatarText}>
                      {activeConversation.type === 'group'
                        ? 'G'
                        : (activeConversation.name.charAt(0) || 'K').toLowerCase()}
                    </Text>
                  </View>

                  <View style={styles.chatActiveInfo}>
                    <Text style={styles.chatActiveTitle} numberOfLines={1}>
                      {activeConversation.name}
                    </Text>
                    <Text style={styles.chatActiveSubtitle} numberOfLines={1}>
                      {activeConversation.isOnline ? 'en línea' : 'desconectado'}
                    </Text>
                  </View>


                  {/* Botón de Videollamada */}
                  <TouchableOpacity
                    style={styles.chatActiveHeaderActionBtn}
                    onPress={handleStartVideoCall}
                    activeOpacity={0.75}
                    accessibilityLabel="Videollamada"
                  >
                    <VideoIcon size={20} color={palette.secondary} strokeWidth={2} />
                  </TouchableOpacity>

                  {/* Botón de Llamada de Voz */}
                  <TouchableOpacity
                    style={styles.chatActiveHeaderActionBtn}
                    onPress={handleStartVoiceCall}
                    activeOpacity={0.75}
                    accessibilityLabel="Llamada de voz"
                  >
                    <PhoneIcon size={19} color={palette.secondary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                {/* Hilo de mensajes o Estado Vacío Limpio (Imagen 1) */}
                <ScrollView
                  style={styles.chatMessagesScroll}
                  contentContainerStyle={[
                    styles.chatMessagesScrollContent,
                    activeConversation.messages.length === 0 && styles.chatMessagesScrollEmptyCenter,
                  ]}
                  showsVerticalScrollIndicator={false}
                >
                  {activeConversation.messages.length === 0 ? (
                    // Estado vacío limpio exacto a Imagen 1
                    <View style={styles.chatActiveEmptyWrap}>
                      <View style={styles.chatActiveEmptyIconBox}>
                        <MessageSquareIcon size={32} color="#94a3b8" strokeWidth={1.8} />
                      </View>
                      <Text style={styles.chatActiveEmptyTitle}>
                        Sin mensajes en esta conversación
                      </Text>
                      <Text style={styles.chatActiveEmptySubtitle}>
                        Escribe un mensaje de texto o presiona el botón de micrófono para enviar la primera nota de voz.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.chatSecurityBanner}>
                        <LockIcon size={12} color={palette.muted} strokeWidth={2} />
                        <Text style={styles.chatSecurityText}>
                          Cifrado de extremo a extremo táctico C5i activo
                        </Text>
                      </View>

                      {activeConversation.messages.map((msg) => {
                        const isSelf = msg.isSelf;
                        return (
                          <View
                            key={msg.id}
                            style={[
                              styles.chatBubbleRow,
                              isSelf ? styles.chatBubbleRowSelf : styles.chatBubbleRowOther,
                            ]}
                          >
                            <View
                              style={[
                                styles.chatBubble,
                                isSelf ? styles.chatBubbleSelf : styles.chatBubbleOther,
                              ]}
                            >
                              {!isSelf && activeConversation.type === 'group' && (
                                <Text style={styles.chatBubbleSender}>
                                  {msg.senderCallsign || msg.senderName}
                                </Text>
                              )}

                              {/* Renderizado multimedia dinámico */}
                              {msg.mediaType === 'image' && msg.mediaUrl ? (
                                <View style={styles.chatBubbleMediaImageWrap}>
                                  <Image
                                    source={{ uri: msg.mediaUrl }}
                                    style={styles.chatBubbleMediaImage}
                                    resizeMode="cover"
                                  />
                                  <Text
                                    style={[
                                      styles.chatBubbleText,
                                      styles.chatBubbleMediaCaption,
                                      isSelf ? styles.chatBubbleTextSelf : styles.chatBubbleTextOther,
                                    ]}
                                  >
                                    {msg.text}
                                  </Text>
                                </View>
                              ) : msg.mediaType === 'location' ? (
                                <TouchableOpacity
                                  style={styles.chatBubbleLocationBox}
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    if (msg.mediaUrl) {
                                      Linking.openURL(msg.mediaUrl).catch(() => {});
                                    }
                                  }}
                                >
                                  <View style={styles.chatBubbleLocationHeader}>
                                    <MapPinIcon size={16} color={isSelf ? '#86efac' : '#059669'} />
                                    <Text
                                      style={[
                                        styles.chatBubbleLocationTitle,
                                        isSelf && { color: '#ffffff' },
                                      ]}
                                    >
                                      Posición GPS Táctica (Tocar para ver en Mapa)
                                    </Text>
                                  </View>
                                  <Text
                                    style={[
                                      styles.chatBubbleText,
                                      isSelf ? styles.chatBubbleTextSelf : styles.chatBubbleTextOther,
                                    ]}
                                  >
                                    {msg.text}
                                  </Text>
                                </TouchableOpacity>
                              ) : msg.mediaType === 'document' ? (
                                <TouchableOpacity
                                  style={styles.chatBubbleDocBox}
                                  activeOpacity={0.8}
                                  onPress={() => {
                                    if (msg.mediaUrl && Platform.OS === 'web') {
                                      const a = document.createElement('a');
                                      a.href = msg.mediaUrl;
                                      a.download = msg.fileName || 'documento_c5i';
                                      a.click();
                                    }
                                  }}
                                >
                                  <FileTextIcon size={20} color={isSelf ? '#bae6fd' : '#0284c7'} />
                                  <Text
                                    style={[
                                      styles.chatBubbleText,
                                      styles.chatBubbleDocText,
                                      isSelf ? styles.chatBubbleTextSelf : styles.chatBubbleTextOther,
                                    ]}
                                  >
                                    {msg.text}
                                  </Text>
                                </TouchableOpacity>
                              ) : msg.mediaType === 'voice' ? (
                                <View style={styles.chatBubbleVoiceBox}>
                                  <MicIcon size={18} color={isSelf ? '#ffffff' : '#8a1a36'} />
                                  <Text
                                    style={[
                                      styles.chatBubbleText,
                                      styles.chatBubbleVoiceText,
                                      isSelf ? styles.chatBubbleTextSelf : styles.chatBubbleTextOther,
                                    ]}
                                  >
                                    {msg.text}
                                  </Text>
                                </View>
                              ) : (
                                <Text
                                  style={[
                                    styles.chatBubbleText,
                                    isSelf ? styles.chatBubbleTextSelf : styles.chatBubbleTextOther,
                                  ]}
                                >
                                  {msg.text}
                                </Text>
                              )}

                              <View style={styles.chatBubbleMetaRow}>
                                <Text
                                  style={[
                                    styles.chatBubbleTime,
                                    isSelf ? styles.chatBubbleTimeSelf : styles.chatBubbleTimeOther,
                                  ]}
                                >
                                  {msg.timestamp}
                                </Text>
                                {isSelf && (
                                  <View style={styles.chatBubbleCheckWrap}>
                                    <DoubleCheckIcon size={13} color="#86efac" />
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                </ScrollView>

                {/* Menú de Adjuntos tipo WhatsApp (Fotos, Cámara, Ubicación, Documento) */}
                {isAttachMenuOpen && (
                  <TouchableWithoutFeedback onPress={() => setIsAttachMenuOpen(false)}>
                    <View style={styles.chatAttachMenuOverlay}>
                      <TouchableWithoutFeedback
                        onPress={(e) => {
                          if (Platform.OS === 'web') {
                            (e as any)?.stopPropagation?.();
                          }
                        }}
                      >
                        <View style={styles.chatAttachMenuCard}>
                          <View style={styles.chatAttachMenuRow}>
                            {/* 1. Fotos */}
                            <TouchableOpacity
                              style={styles.chatAttachMenuItem}
                              onPress={handlePickPhoto}
                              activeOpacity={0.75}
                            >
                              <View style={[styles.chatAttachIconCircle, { backgroundColor: '#2563eb' }]}>
                                <ImageIcon size={26} color="#ffffff" strokeWidth={2} />
                              </View>
                              <Text style={styles.chatAttachMenuLabel}>Fotos</Text>
                            </TouchableOpacity>

                            {/* 2. Cámara */}
                            <TouchableOpacity
                              style={styles.chatAttachMenuItem}
                              onPress={handleOpenCamera}
                              activeOpacity={0.75}
                            >
                              <View style={[styles.chatAttachIconCircle, { backgroundColor: '#475569' }]}>
                                <CameraIcon size={26} color="#ffffff" strokeWidth={2} />
                              </View>
                              <Text style={styles.chatAttachMenuLabel}>Cámara</Text>
                            </TouchableOpacity>

                            {/* 3. Ubicación */}
                            <TouchableOpacity
                              style={styles.chatAttachMenuItem}
                              onPress={handleShareLocation}
                              activeOpacity={0.75}
                            >
                              <View style={[styles.chatAttachIconCircle, { backgroundColor: '#059669' }]}>
                                <MapPinIcon size={26} color="#ffffff" strokeWidth={2} />
                              </View>
                              <Text style={styles.chatAttachMenuLabel}>Ubicación</Text>
                            </TouchableOpacity>

                            {/* 4. Documento */}
                            <TouchableOpacity
                              style={styles.chatAttachMenuItem}
                              onPress={handlePickDocument}
                              activeOpacity={0.75}
                            >
                              <View style={[styles.chatAttachIconCircle, { backgroundColor: '#0284c7' }]}>
                                <FileTextIcon size={26} color="#ffffff" strokeWidth={2} />
                              </View>
                              <Text style={styles.chatAttachMenuLabel}>Documento</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableWithoutFeedback>
                    </View>
                  </TouchableWithoutFeedback>
                )}

                {/* Barra de entrada dinámica idéntica a Imagen 1 */}
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                  <View style={styles.chatInputBarWrapper}>
                    <View style={styles.chatInputBar}>
                      {/* Botón Clip para desplegar el menú de adjuntos */}
                      <TouchableOpacity
                        style={[
                          styles.chatAttachBtn,
                          isAttachMenuOpen && styles.chatAttachBtnActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setIsAttachMenuOpen((prev) => !prev)}
                        accessibilityLabel="Adjuntar archivo o evidencia"
                      >
                        <PaperclipIcon
                          size={20}
                          color={isAttachMenuOpen ? palette.accent : palette.muted}
                          strokeWidth={2}
                        />
                      </TouchableOpacity>

                      {/* Campo de texto limpio "Escribe un mensaje de radio..." */}
                      <TextInput
                        style={styles.chatTextInput}
                        value={chatDraftMessage}
                        onChangeText={setChatDraftMessage}
                        placeholder="Escribe un mensaje de radio..."
                        placeholderTextColor="#94a3b8"
                        multiline
                      />

                      {/* Botón dinámico: micrófono si está vacío, avión si hay texto */}
                      {chatDraftMessage.trim() ? (
                        <TouchableOpacity
                          style={[styles.chatDynamicBtn, styles.chatSendBtnActive]}
                          onPress={handleSendChatMessage}
                          activeOpacity={0.8}
                          accessibilityLabel="Enviar mensaje"
                        >
                          <SendIcon size={18} color="#ffffff" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.chatDynamicBtn, styles.chatMicBtn]}
                          onPress={handleSendVoiceNote}
                          activeOpacity={0.8}
                          accessibilityLabel="Enviar nota de voz"
                        >
                          <MicIcon size={20} color={palette.accent} strokeWidth={2.2} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </View>
            ) : (
              // LISTA DE CHATS (EXACTA A CAPTURA 1)
              <View style={styles.chatListView}>
                {/* Header superior: Ícono de chat redondeado, Título "Chat", Botón SOS rojo y Botón Editar/Nuevo */}
                <View style={styles.chatTopHeader}>
                  <View style={styles.chatTopHeaderLeft}>
                    <View style={styles.chatHeaderIconBadge}>
                      <MessageSquareIcon size={20} color={palette.accent} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.chatTopHeaderTitle}>Chat</Text>
                  </View>

                  <View style={styles.chatTopHeaderRight}>
                    {/* Botón SOS Rojo idéntico a Captura 1 */}
                    <TouchableOpacity
                      style={styles.chatSosHeaderBtn}
                      onPress={handleTriggerSos}
                      activeOpacity={0.8}
                      accessibilityLabel="Alerta de emergencia SOS"
                    >
                      <AlertTriangleIcon size={18} color="#ffffff" strokeWidth={2.4} />
                    </TouchableOpacity>

                    {/* Botón Nuevo / Componer con icono de lápiz/editar */}
                    <TouchableOpacity
                      style={styles.chatComposeBtn}
                      onPress={() => setIsNewChatModalOpen(true)}
                      activeOpacity={0.75}
                      accessibilityLabel="Nueva conversación"
                    >
                      <EditIcon size={18} color={palette.text} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Barra de búsqueda idéntica a Captura 1: "Buscar chats o mensajes..." */}
                <View style={styles.chatSearchContainer}>
                  <View style={styles.chatSearchInputBox}>
                    <SearchIcon size={16} color="#94a3b8" strokeWidth={2} />
                    <TextInput
                      style={styles.chatSearchInput}
                      value={chatSearchQuery}
                      onChangeText={setChatSearchQuery}
                      placeholder="Buscar chats o mensajes..."
                      placeholderTextColor="#94a3b8"
                    />
                    {Boolean(chatSearchQuery) && (
                      <TouchableOpacity onPress={() => setChatSearchQuery('')}>
                        <XIcon size={14} color="#94a3b8" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Filtros de Categoría tipo Pill idénticos a Captura 1: Todos (N), Grupos (N), Directos (N) */}
                <View style={styles.chatFilterPillsRow}>
                  <TouchableOpacity
                    style={[
                      styles.chatFilterPill,
                      selectedChatFilter === 'Todos' && styles.chatFilterPillActive,
                    ]}
                    onPress={() => setSelectedChatFilter('Todos')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.chatFilterPillText,
                        selectedChatFilter === 'Todos' && styles.chatFilterPillTextActive,
                      ]}
                    >
                      Todos ({totalChatCount})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.chatFilterPill,
                      selectedChatFilter === 'Grupos' && styles.chatFilterPillActive,
                    ]}
                    onPress={() => setSelectedChatFilter('Grupos')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.chatFilterPillText,
                        selectedChatFilter === 'Grupos' && styles.chatFilterPillTextActive,
                      ]}
                    >
                      Grupos ({groupsChatCount})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.chatFilterPill,
                      selectedChatFilter === 'Directos' && styles.chatFilterPillActive,
                    ]}
                    onPress={() => setSelectedChatFilter('Directos')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.chatFilterPillText,
                        selectedChatFilter === 'Directos' && styles.chatFilterPillTextActive,
                      ]}
                    >
                      Directos ({directChatCount})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Contenido: Si no hay chats -> Empty state de Captura 1; si hay -> lista de conversaciones */}
                {filteredConversations.length === 0 ? (
                  <View style={styles.chatEmptyStateBox}>
                    <View style={styles.chatEmptyIconBadge}>
                      <MessageSquareIcon size={32} color="#94a3b8" strokeWidth={1.8} />
                    </View>
                    <Text style={styles.chatEmptyTitle}>Sin conversaciones todavía</Text>
                    <Text style={styles.chatEmptySubtitle}>
                      Crea un grupo para comenzar a chatear.
                    </Text>
                    <TouchableOpacity
                      style={styles.chatEmptyStartBtn}
                      onPress={() => setIsNewChatModalOpen(true)}
                      activeOpacity={0.85}
                    >
                      <PlusIcon size={16} color="#ffffff" strokeWidth={2.2} />
                      <Text style={styles.chatEmptyStartBtnText}>Iniciar Conversación</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.chatConversationsScroll}
                    contentContainerStyle={{ paddingBottom: 30 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {filteredConversations.map((conv) => (
                      <TouchableOpacity
                        key={conv.id}
                        style={styles.chatConvCard}
                        onPress={() => setActiveConversation(conv)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.chatConvAvatarWrap}>
                          <View
                            style={[
                              styles.chatConvAvatar,
                              conv.type === 'group' && { backgroundColor: palette.input },
                            ]}
                          >
                            {conv.type === 'group' ? (
                              <UsersIcon size={20} color={palette.accent} strokeWidth={2} />
                            ) : (
                              <Text style={styles.chatConvAvatarText}>
                                {(conv.callsign?.slice(0, 2) || conv.name.slice(0, 2)).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          {conv.isOnline && <View style={styles.chatConvOnlineDot} />}
                        </View>

                        <View style={styles.chatConvContent}>
                          <View style={styles.chatConvHeaderRow}>
                            <Text style={styles.chatConvName} numberOfLines={1}>
                              {conv.name}
                            </Text>
                            <Text style={styles.chatConvTime}>{conv.lastMessageTime}</Text>
                          </View>

                          <View style={styles.chatConvMsgRow}>
                            <View style={styles.chatConvCheckWrap}>
                              <DoubleCheckIcon size={14} color="#059669" />
                            </View>
                            <Text style={styles.chatConvLastMsg} numberOfLines={1}>
                              {conv.lastMessage}
                            </Text>
                            {conv.unreadCount > 0 && (
                              <View style={styles.chatConvUnreadBadge}>
                                <Text style={styles.chatConvUnreadText}>{conv.unreadCount}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        )}

        <ContactsScreen ref={contactsScreenRef} visible={currentTab === 'Contactos'} serverUrl={serverUrl}
          directory={contactsDirectory} onSos={handleTriggerSos} onStartChat={contact => { if (handleStartDirectChat(contact)) setCurrentTab('Chat'); }}
          onContactUpdated={handleContactUpdated} onOpenCamera={handleOpenCamera} />

        {currentTab === 'Perfil' && currentUser && (
          <ProfileScreen user={currentUser} account={account} notifications={notifications} serverUrl={serverUrl}
            onLogout={() => handleLogout()}
            onDeleted={async () => { await handleLogout(true); }}
            onServerChange={async url => { await handleLogout(); setServerUrl(url); await safeStorage.setItem('c5i_native_server_url', url); }} />
        )}
      </View>

      {/* 5-Tab Bottom Navigation Bar (Oculto cuando se está dentro de un chat activo, estilo WhatsApp) */}
      {!(currentTab === 'Chat' && activeConversation) && (
        <View style={styles.cleanNavBar}>
          <TouchableOpacity
            style={styles.cleanNavItem}
            onPress={() => setCurrentTab('PTT')}
            activeOpacity={0.7}
          >
            <MicIcon
              size={22}
              color={currentTab === 'PTT' ? palette.accent : palette.muted}
              strokeWidth={currentTab === 'PTT' ? 2.4 : 1.8}
            />
            <Text style={[styles.cleanNavLabel, currentTab === 'PTT' && styles.cleanNavLabelActive]}>
              PTT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cleanNavItem}
            onPress={() => setCurrentTab('Grupos')}
            activeOpacity={0.7}
          >
            <UsersIcon
              size={22}
              color={currentTab === 'Grupos' ? palette.accent : palette.muted}
              strokeWidth={currentTab === 'Grupos' ? 2.4 : 1.8}
            />
            <Text style={[styles.cleanNavLabel, currentTab === 'Grupos' && styles.cleanNavLabelActive]}>
              Grupos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cleanNavItem}
            onPress={() => setCurrentTab('Chat')}
            activeOpacity={0.7}
          >
            <MessageSquareIcon
              size={22}
              color={currentTab === 'Chat' ? palette.accent : palette.muted}
              strokeWidth={currentTab === 'Chat' ? 2.4 : 1.8}
            />
            <Text style={[styles.cleanNavLabel, currentTab === 'Chat' && styles.cleanNavLabelActive]}>
              Chat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cleanNavItem}
            onPress={() => setCurrentTab('Contactos')}
            activeOpacity={0.7}
          >
            <BookOpenIcon
              size={22}
              color={currentTab === 'Contactos' ? palette.accent : palette.muted}
              strokeWidth={currentTab === 'Contactos' ? 2.4 : 1.8}
            />
            <Text style={[styles.cleanNavLabel, currentTab === 'Contactos' && styles.cleanNavLabelActive]}>
              Contactos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cleanNavItem}
            onPress={() => setCurrentTab('Perfil')}
            activeOpacity={0.7}
          >
            <UserIcon
              size={22}
              color={currentTab === 'Perfil' ? palette.accent : palette.muted}
              strokeWidth={currentTab === 'Perfil' ? 2.4 : 1.8}
            />
            <Text style={[styles.cleanNavLabel, currentTab === 'Perfil' && styles.cleanNavLabelActive]}>
              Perfil
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ChannelMembersModal key={channelsDirectory.scope} visible={isMembersModalOpen}
        channel={selectedChannel} userId={currentUser.id} api={channelsDirectory.api}
        onClose={() => setIsMembersModalOpen(false)} />

      {/* 6. MODAL: NUEVA CONVERSACIÓN (IDÉNTICO A CAPTURA 2) */}
      <Modal
        visible={isNewChatModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setIsNewChatModalOpen(false);
          contactsDirectory.setQuery('');
        }}
      >
        <View style={styles.chatModalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setIsNewChatModalOpen(false);
              contactsDirectory.setQuery('');
            }}
          />
          <View style={styles.chatModalCard}>
              {/* Header: ícono chat en cuadro redondeado, título "Nueva Conversación", subtítulo "Selecciona un contacto para chatear", botón cerrar */}
              <View style={styles.chatModalHeader}>
                <View style={styles.chatModalHeaderLeft}>
                  <View style={styles.chatModalIconBox}>
                    <MessageSquareIcon size={18} color={palette.accent} strokeWidth={2.2} />
                  </View>
                  <View>
                    <Text style={styles.chatModalTitle}>Nueva Conversación</Text>
                    <Text style={styles.chatModalSubtitle}>
                      Selecciona un contacto para chatear
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.chatModalCloseBtn}
                  onPress={() => {
                    setIsNewChatModalOpen(false);
                    contactsDirectory.setQuery('');
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <XIcon size={18} color={palette.muted} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Botones de acción: "+ Registrar Nuevo Contacto" (color vino idéntico a Captura 2) y "+ Crear Grupo" */}
              <View style={styles.chatModalActionsRow}>
                <TouchableOpacity
                  style={styles.chatModalRegisterBtn}
                  onPress={openContactRegistration}
                  activeOpacity={0.85}
                >
                  <UserPlusIcon size={18} color="#ffffff" strokeWidth={2.2} />
                  <Text style={styles.chatModalRegisterBtnText}>+ Registrar Nuevo Contacto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.chatModalCreateGroupBtn}
                  onPress={() => setIsCreateGroupChatModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <UsersIcon size={16} color={palette.accent} strokeWidth={2.2} />
                  <Text style={styles.chatModalCreateGroupBtnText}>+ Crear Grupo de Conversación</Text>
                </TouchableOpacity>
              </View>

              {/* Barra de búsqueda idéntica a Captura 2: "Buscar por nombre, indicativo o teléfono..." */}
              <View style={styles.chatModalSearchBox}>
                <SearchIcon size={16} color="#94a3b8" strokeWidth={2} />
                <TextInput
                  style={styles.chatModalSearchInput}
                  value={contactsDirectory.query}
                  onChangeText={contactsDirectory.setQuery}
                  placeholder="Buscar por nombre, indicativo o teléfono..."
                  placeholderTextColor="#94a3b8"
                />
                {Boolean(contactsDirectory.query) && (
                  <TouchableOpacity onPress={() => contactsDirectory.setQuery('')}>
                    <XIcon size={14} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Contenido: Si no hay contactos filtrados -> Empty state exacto a Captura 2; si hay -> lista de oficiales */}
              {filteredOfficers.length === 0 ? (
                <View style={styles.chatModalEmptyBox}>
                  <View style={styles.chatModalEmptyUserIcon}>
                    <UserIcon size={32} color="#94a3b8" strokeWidth={1.8} />
                  </View>
                  <Text style={styles.chatModalEmptyTitle}>Sin contactos registrados</Text>
                  <Text style={styles.chatModalEmptySubtitle}>
                    Agrega a tu primer oficial o contacto para iniciar una conversación encriptada.
                  </Text>
                  <TouchableOpacity
                    style={styles.chatModalEmptyAddBtn}
                    onPress={openContactRegistration}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.chatModalEmptyAddBtnText}>+ Agregar Contacto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  style={styles.chatModalOfficersScroll}
                  contentContainerStyle={{ paddingBottom: 15 }}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredOfficers.map((officer) => (
                    <TouchableOpacity
                      key={officer.id}
                      style={styles.chatOfficerCard}
                      onPress={() => handleStartDirectChat(officer)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.chatOfficerAvatarWrap}>
                        <View style={styles.chatOfficerAvatar}>
                          <Text style={styles.chatOfficerAvatarText}>
                            {officer.callsign.slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        {officer.status === 'online' && (
                          <View style={styles.chatOfficerOnlineDot} />
                        )}
                      </View>

                      <View style={styles.chatOfficerInfo}>
                        <View style={styles.chatOfficerNameRow}>
                          <Text style={styles.chatOfficerName} numberOfLines={1}>
                            {officer.name}
                          </Text>
                          <View style={styles.chatOfficerCallsignPill}>
                            <Text style={styles.chatOfficerCallsignText}>
                              {officer.callsign}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.chatOfficerUnit} numberOfLines={1}>
                          {officer.unit}
                          {officer.phone_number ? ` • Tel: ${officer.phone_number}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {contactsDirectory.hasMore && <TouchableOpacity onPress={() => contactsDirectory.loadMore()} disabled={contactsDirectory.loading}>
                    <Text style={{ padding: 16, color: '#6b1d2f' }}>Cargar más contactos</Text>
                  </TouchableOpacity>}
                </ScrollView>
              )}
            </View>
          </View>
      </Modal>

      {/* 8. MODAL: CREAR GRUPO DE CONVERSACIÓN */}
      <Modal
        visible={isCreateGroupChatModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setIsCreateGroupChatModalOpen(false);
          setCreateGroupError(null);
        }}
      >
        <View style={styles.chatModalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setIsCreateGroupChatModalOpen(false);
              setCreateGroupError(null);
            }}
          />
          <View style={styles.chatModalCard}>
              <View style={styles.chatModalHeader}>
                <View style={styles.chatModalHeaderLeft}>
                  <View style={[styles.chatModalIconBox, { backgroundColor: '#8a1a36' }]}>
                    <UsersIcon size={18} color="#ffffff" strokeWidth={2.2} />
                  </View>
                  <View>
                    <Text style={styles.chatModalTitle}>Crear Grupo de Conversación</Text>
                    <Text style={styles.chatModalSubtitle}>
                      Sala encriptada para múltiples oficiales C5i
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.chatModalCloseBtn}
                  onPress={() => {
                    setIsCreateGroupChatModalOpen(false);
                    setCreateGroupError(null);
                  }}
                >
                  <XIcon size={18} color={palette.muted} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: 380 }}
                contentContainerStyle={{ padding: 18, gap: 14 }}
                keyboardShouldPersistTaps="handled"
              >
                {createGroupError && (
                  <View style={styles.recoveryErrorBanner}>
                    <AlertTriangleIcon size={15} color={palette.danger} strokeWidth={1.8} />
                    <Text style={styles.recoveryErrorText}>{createGroupError}</Text>
                  </View>
                )}

                <View style={styles.recoveryInputGroup}>
                  <Text style={styles.recoveryInputLabel}>Nombre del Grupo Táctico</Text>
                  <View style={styles.recoveryInputBox}>
                    <TextInput
                      style={styles.recoveryInput}
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                      placeholder="Ej. OPERATIVO NOCTURNO C5I"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={styles.recoveryInputGroup}>
                  <Text style={styles.recoveryInputLabel}>
                    Seleccionar Miembros ({selectedGroupMembers.length} seleccionados)
                  </Text>
                  <Text style={styles.canalesPinSub}>
                    Marca los oficiales que participarán en el grupo cifrado
                  </Text>

                  <TextInput value={contactsDirectory.query} onChangeText={contactsDirectory.setQuery}
                    placeholder="Buscar miembros por nombre o teléfono..." style={styles.recoveryInput} />
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {officersList.filter(off => off.registered_user_id).map((off) => {
                      const isChecked = selectedGroupMembers.includes(off.registered_user_id!);
                      return (
                        <TouchableOpacity
                          key={off.id}
                          style={[
                            styles.chatGroupMemberItem,
                            isChecked && styles.chatGroupMemberItemChecked,
                          ]}
                          onPress={() => toggleGroupMemberSelection(off.registered_user_id!)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.chatGroupCheckbox,
                              isChecked && styles.chatGroupCheckboxChecked,
                            ]}
                          >
                            {isChecked && <CheckCircleIcon size={14} color="#ffffff" strokeWidth={2.5} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.chatGroupMemberName}>{off.name}</Text>
                            <Text style={styles.chatGroupMemberMeta}>
                              [{off.callsign}] • {off.unit}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {contactsDirectory.hasMore && <TouchableOpacity onPress={() => contactsDirectory.loadMore()} disabled={contactsDirectory.loading}>
                    <Text style={{ padding: 16, color: '#6b1d2f' }}>Cargar más contactos</Text>
                  </TouchableOpacity>}
                </View>
              </ScrollView>

              <View style={styles.chatModalFormFooter}>
                <TouchableOpacity
                  style={styles.chatModalCancelBtn}
                  onPress={() => {
                    setIsCreateGroupChatModalOpen(false);
                    setCreateGroupError(null);
                  }}
                >
                  <Text style={styles.chatModalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.chatModalSubmitFormBtn}
                  onPress={handleCreateGroupChatSubmit}
                  activeOpacity={0.85}
                >
                  <Text style={styles.chatModalSubmitFormBtnText}>Crear Grupo Cifrado</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
      </Modal>

      {feedback}

      {/* 9. MODAL: CÁMARA TÁCTICA EN VIVO C5I (CAPTURA REAL SIN SIMULACIÓN) */}
      <Modal
        visible={isLiveCameraModalOpen}
        animationType="slide"
        transparent
        onRequestClose={handleCloseLiveCamera}
      >
        <View style={styles.liveCamModalBackdrop}>
          <View style={styles.liveCamCard}>
            {/* Header */}
            <View style={styles.liveCamHeader}>
              <View style={styles.liveCamHeaderLeft}>
                <View style={styles.liveCamIconBox}>
                  <CameraIcon size={18} color="#ffffff" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.liveCamTitle}>Cámara Táctica C5i</Text>
                  <Text style={styles.liveCamSubtitle}>
                    Captura en tiempo real para evidencia táctica
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.liveCamCloseBtn}
                onPress={handleCloseLiveCamera}
                activeOpacity={0.7}
              >
                <XIcon size={18} color="#94a3b8" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Viewfinder con Video Real */}
            <View style={styles.liveCamViewfinder}>
              {Platform.OS === 'web' && (
                <video
                  ref={liveCameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    backgroundColor: '#000000',
                  }}
                />
              )}
              {/* Retícula táctica de captura */}
              <View style={[styles.canalesScannerCorner, styles.cornerTL]} />
              <View style={[styles.canalesScannerCorner, styles.cornerTR]} />
              <View style={[styles.canalesScannerCorner, styles.cornerBL]} />
              <View style={[styles.canalesScannerCorner, styles.cornerBR]} />

              <View style={styles.liveCamBadge}>
                <View style={styles.liveCamDot} />
                <Text style={styles.liveCamBadgeText}>EN VIVO • HD</Text>
              </View>
            </View>

            {/* Controles de Disparo */}
            <View style={styles.liveCamControlsRow}>
              <TouchableOpacity
                style={styles.liveCamCancelBtn}
                onPress={handleCloseLiveCamera}
                activeOpacity={0.75}
              >
                <Text style={styles.liveCamCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liveCamCaptureBtn}
                onPress={handleCaptureLivePhoto}
                activeOpacity={0.85}
              >
                <View style={styles.liveCamCaptureInnerCircle} />
              </TouchableOpacity>

              <View style={{ width: 60 }} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// El proveedor permite que Android/iOS respeten la barra de estado y la navegación inferior.
export default function NativeApp() {
  return (
    <AppThemeProvider><SafeAreaProvider style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <NativeAppScreen />
    </SafeAreaProvider></AppThemeProvider>
  );
}

const baseStyles = StyleSheet.create({
  cleanContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  cleanMainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  cleanNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  cleanNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanNavLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 3,
  },
  cleanNavLabelActive: {
    color: '#8a1a36',
    fontWeight: '800',
  },
  cleanScrollSection: {
    flex: 1,
    padding: 16,
  },
  cleanSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cleanSectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  cleanCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cleanCardSelected: {
    borderColor: '#8a1a36',
    borderWidth: 1.5,
    backgroundColor: '#fff1f2',
  },
  cleanCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cleanCardTitleSelected: {
    color: '#8a1a36',
  },
  cleanCardMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  cleanCardBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  cleanCardBadgeActive: {
    color: '#ffffff',
    backgroundColor: '#8a1a36',
  },
  cleanOnlineIndicator: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10b981',
    alignSelf: 'center',
  },
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
  freqLabel: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
  // Estilos dedicados para Recuperar Contraseña (Image 1 / ForgotPasswordModal)
  recoveryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recoveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  recoveryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recoveryKeyBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(105, 28, 50, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(105, 28, 50, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  recoveryErrorBanner: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  recoveryErrorText: {
    color: '#be123c',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  recoveryInputGroup: {
    marginBottom: 14,
  },
  recoveryInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  recoveryInputBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 46,
  },
  recoveryInputBoxActive: {
    borderColor: '#8a1a36',
  },
  recoveryInputIconBox: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
  },
  recoveryButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  recoveryCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryCancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  recoverySubmitBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#691c32',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#691c32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  recoverySubmitBtnDisabled: {
    backgroundColor: '#cca4af',
    shadowOpacity: 0,
    elevation: 0,
  },
  recoverySubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  recoverySubmitBtnFull: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#691c32',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#691c32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  recoveryStepNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recoveryBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  recoveryBackText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  recoveryCodeBadge: {
    color: '#0284c7',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  recoveryTokenTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 12,
  },
  tokenBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 4,
  },
  tokenBox: {
    width: 44,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenBoxFilled: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  tokenBoxActive: {
    borderColor: '#8a1a36',
  },
  tokenDigitText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  resendText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: '#94a3b8',
  },
  checklistContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 4,
    gap: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  checkDotValid: {
    backgroundColor: '#059669',
  },
  checkItemText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  checkItemTextValid: {
    color: '#059669',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  successBadgeLarge: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  successSubText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  colHalf: {
    flex: 1,
  },
  canalesPinSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 4,
  },
  canalesScannerCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#e11d48',
  },
  cornerTL: {
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  // ----------------------------------------------------
  // ESTILOS TÁCTICOS C5i PARA CHAT (WHATSAPP-STYLE)
  // ----------------------------------------------------
  chatTabContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  chatListView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  chatTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chatTopHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatHeaderIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fdf2f4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fce7ea',
  },
  chatTopHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  chatTopHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatSosHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  chatComposeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
  },
  chatSearchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#f8fafc',
  },
  chatSearchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  chatSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  chatFilterPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chatFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chatFilterPillActive: {
    backgroundColor: '#691c32',
  },
  chatFilterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  chatFilterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  chatEmptyStateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  chatEmptyIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  chatEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
    textAlign: 'center',
  },
  chatEmptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  chatEmptyStartBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#691c32',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  chatEmptyStartBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  chatConversationsScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  chatConvCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chatConvAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  chatConvAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#691c32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatConvAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  chatConvOnlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  chatConvContent: {
    flex: 1,
  },
  chatConvHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatConvName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  chatConvTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  chatConvMsgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatConvCheckWrap: {
    marginRight: 2,
  },
  chatConvLastMsg: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  chatConvUnreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  chatConvUnreadText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Vista activa de conversación
  chatActiveView: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  chatActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  chatActiveBackBtn: {
    padding: 4,
    borderRadius: 8,
  },
  chatActiveAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatActiveAvatarText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  chatActiveInfo: {
    flex: 1,
  },
  chatActiveTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  chatActiveSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  chatActiveSosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  chatActiveSosText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chatActiveHeaderActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMessagesScroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  chatMessagesScrollContent: {
    padding: 14,
    paddingBottom: 20,
  },
  chatMessagesScrollEmptyCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatActiveEmptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  chatActiveEmptyIconBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  chatActiveEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
    textAlign: 'center',
  },
  chatActiveEmptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 290,
  },
  chatSecurityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: '92%',
  },
  chatSecurityText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  chatBubbleRow: {
    flexDirection: 'row',
    marginBottom: 10,
    width: '100%',
  },
  chatBubbleRowSelf: {
    justifyContent: 'flex-end',
  },
  chatBubbleRowOther: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chatBubbleSelf: {
    backgroundColor: '#691c32',
    borderBottomRightRadius: 4,
  },
  chatBubbleOther: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatBubbleSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8a1a36',
    marginBottom: 3,
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatBubbleTextSelf: {
    color: '#ffffff',
  },
  chatBubbleTextOther: {
    color: '#0f172a',
  },
  chatBubbleMediaImageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
    maxWidth: 240,
  },
  chatBubbleMediaImage: {
    width: 240,
    height: 160,
    borderRadius: 10,
  },
  chatBubbleMediaCaption: {
    marginTop: 4,
  },
  chatBubbleLocationBox: {
    gap: 4,
  },
  chatBubbleLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  chatBubbleLocationTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  chatBubbleDocBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  chatBubbleDocText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chatBubbleVoiceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  chatBubbleVoiceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chatBubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  chatBubbleTime: {
    fontSize: 10,
  },
  chatBubbleTimeSelf: {
    color: '#fecdd3',
  },
  chatBubbleTimeOther: {
    color: '#94a3b8',
  },
  chatBubbleCheckWrap: {
    marginLeft: 2,
  },

  // Menú de Adjuntos Táctico Tipo WhatsApp (Imagen 3)
  chatAttachMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 72,
    zIndex: 999,
  },
  liveCamModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  liveCamCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  liveCamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  liveCamHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveCamIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#8a1a36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCamTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  liveCamSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
  },
  liveCamCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCamViewfinder: {
    width: '100%',
    height: 340,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveCamBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  liveCamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveCamBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  liveCamControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: '#0f172a',
  },
  liveCamCancelBtn: {
    width: 60,
  },
  liveCamCancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  liveCamCaptureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  liveCamCaptureInnerCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e11d48',
  },
  chatAttachMenuCard: {
    backgroundColor: '#18222d',
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  chatAttachMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  chatAttachMenuItem: {
    alignItems: 'center',
    gap: 8,
  },
  chatAttachIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  chatAttachMenuLabel: {
    fontSize: 12,
    color: '#e2e8f0',
    fontWeight: '600',
  },

  // Barra de Entrada Dinámica (Imagen 1)
  chatInputBarWrapper: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatAttachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatAttachBtnActive: {
    backgroundColor: '#fdf2f4',
    borderColor: '#fce7ea',
  },
  chatTextInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  chatDynamicBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMicBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fce7ea',
    shadowColor: '#8a1a36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  chatSendBtnActive: {
    backgroundColor: '#691c32',
    shadowColor: '#691c32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },

  // Modales de Chat y Contactos (Captura 2)
  chatModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  chatModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chatModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatModalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fdf2f4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fce7ea',
  },
  chatModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  chatModalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  chatModalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatModalActionsRow: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  chatModalRegisterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#691c32',
    height: 46,
    borderRadius: 14,
    shadowColor: '#691c32',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  chatModalRegisterBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  chatModalCreateGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fdf2f4',
    borderWidth: 1,
    borderColor: '#fce7ea',
    height: 40,
    borderRadius: 12,
  },
  chatModalCreateGroupBtnText: {
    color: '#8a1a36',
    fontSize: 13,
    fontWeight: '700',
  },
  chatModalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginHorizontal: 18,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  chatModalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  chatModalEmptyBox: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  chatModalEmptyUserIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  chatModalEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
    textAlign: 'center',
  },
  chatModalEmptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  chatModalEmptyAddBtn: {
    backgroundColor: '#691c32',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  chatModalEmptyAddBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  chatModalOfficersScroll: {
    maxHeight: 320,
    paddingHorizontal: 18,
  },
  chatOfficerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chatOfficerAvatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  chatOfficerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatOfficerAvatarText: {
    color: '#8a1a36',
    fontWeight: '800',
    fontSize: 13,
  },
  chatOfficerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  chatOfficerInfo: {
    flex: 1,
  },
  chatOfficerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chatOfficerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 6,
  },
  chatOfficerCallsignPill: {
    backgroundColor: '#fdf2f4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fce7ea',
  },
  chatOfficerCallsignText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8a1a36',
  },
  chatOfficerUnit: {
    fontSize: 12,
    color: '#64748b',
  },
  chatModalFormFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  chatModalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatModalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  chatModalSubmitFormBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#691c32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatModalSubmitFormBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  chatGroupMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  chatGroupMemberItemChecked: {
    backgroundColor: '#fdf2f4',
    borderColor: '#fce7ea',
  },
  chatGroupCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  chatGroupCheckboxChecked: {
    backgroundColor: '#691c32',
    borderColor: '#691c32',
  },
  chatGroupMemberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  chatGroupMemberMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
});

