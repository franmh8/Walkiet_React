import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useRadio } from '../context/RadioContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Channel } from '../types';
import {
  Radio,
  Users,
  ShieldCheck,
  Plus,
  X,
  Search,
  Lock,
  LogIn,
  KeyRound,
  FolderPlus,
  QrCode,
  Share2,
  Copy,
  Check,
  CheckCircle2,
  Trash2,
  Camera,
  ChevronDown,
  AlertTriangle,
  LogOut,
  Shield,
} from 'lucide-react-native';
import { QrCodeView } from '../components/QrCodeView';
import { QrScannerModal } from '../components/QrScannerModal';

const CATEGORIES = [
  { id: 'todos', label: 'Todos' },
  { id: 'general', label: 'General' },
  { id: 'emergencia', label: 'Emergencia' },
  { id: 'tactico', label: 'Tactico' },
  { id: 'vialidad', label: 'Vialidad' },
  { id: 'inteligencia', label: 'Inteligencia' },
  { id: 'privados', label: 'Privados' },
];

const CATEGORY_OPTIONS = [
  { id: 'tactico', label: 'Operaciones Especiales Tácticas' },
  { id: 'general', label: 'General / Despacho Central' },
  { id: 'emergencia', label: 'Emergencias 911' },
  { id: 'vialidad', label: 'Vialidad y Tránsito' },
  { id: 'inteligencia', label: 'Inteligencia y Monitoreo' },
];

export function ChannelsScreen({ navigation }: any) {
  const { user } = useAuth();
  const {
    channels,
    selectedChannel,
    setSelectedChannel,
    createChannel,
    joinChannel,
    joinChannelByCode,
    deleteChannel,
    leaveChannel,
    availableNetworkChannels,
    refreshNetworkChannels,
  } = useRadio();
  const { colors, isDark } = useTheme();

  // Búsqueda y categoría
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');

  // Modal: Crear nuevo canal (estilo Web idéntico)
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newCategory, setNewCategory] = useState('tactico');
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [newIsPrivate, setNewIsPrivate] = useState(false);
  const [createPinDigits, setCreatePinDigits] = useState(['', '', '', '']);
  const createPinRefs = useRef<(TextInput | null)[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Modal: Unirse a canal existente (inicia en blanco)
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [selectedChannelToJoin, setSelectedChannelToJoin] = useState<Channel | null>(null);
  const [joinPinInput, setJoinPinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // Modal: Unirse con código PIN numérico
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const digitInputRefs = useRef<(TextInput | null)[]>([]);

  // Modal: Escáner QR con cámara
  const [qrScannerVisible, setQrScannerVisible] = useState(false);

  // Modal: Configuración minimalista del canal (QR + PIN)
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configChannel, setConfigChannel] = useState<Channel | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Cargar canales de red cuando se abre el modal de unirse
  useEffect(() => {
    if (joinModalVisible) {
      refreshNetworkChannels();
      setJoinError(null);
      setSelectedChannelToJoin(null);
      setJoinPinInput('');
    }
  }, [joinModalVisible]);

  // Selección de canal principal y navegar a PTT
  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    navigation.navigate('PTT');
  };

  // Manejo de PIN de 4 dígitos al crear canal
  const handleCreatePinChange = (index: number, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    const updated = [...createPinDigits];
    updated[index] = cleaned;
    setCreatePinDigits(updated);
    if (cleaned && index < 3) {
      createPinRefs.current[index + 1]?.focus();
    }
  };

  const handleCreatePinKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !createPinDigits[index] && index > 0) {
      createPinRefs.current[index - 1]?.focus();
    }
  };

  // Crear canal
  const handleCreateChannelSubmit = async () => {
    if (!newChannelName.trim()) {
      Alert.alert('Nombre requerido', 'Por favor ingresa un nombre para el nuevo canal.');
      return;
    }

    let finalPin = '';
    if (newIsPrivate) {
      finalPin = createPinDigits.join('').trim();
      if (finalPin.length < 4) {
        Alert.alert('PIN incompleto', 'Ingresa los 4 dígitos del código PIN de acceso.');
        return;
      }
    } else {
      finalPin = String(Math.floor(1000 + Math.random() * 9000));
    }

    setIsCreating(true);
    try {
      const created = await createChannel(
        newChannelName.trim(),
        newIsPrivate,
        newCategory,
        finalPin
      );

      setNewChannelName('');
      setCreatePinDigits(['', '', '', '']);
      setNewIsPrivate(false);
      setCreateModalVisible(false);
      setSelectedChannel(created);
      navigation.navigate('PTT');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No fue posible crear el canal.');
    } finally {
      setIsCreating(false);
    }
  };

  // Manejo de código de 4 dígitos para unirse
  const handleCodeDigitChange = (index: number, val: string) => {
    setCodeError(null);
    const cleaned = val.replace(/[^0-9]/g, '');

    if (cleaned.length > 1) {
      const parts = cleaned.slice(0, 4).split('');
      const updated = [...codeDigits];
      parts.forEach((p, idx) => {
        if (index + idx < 4) updated[index + idx] = p;
      });
      setCodeDigits(updated);
      const nextIdx = Math.min(index + parts.length, 3);
      digitInputRefs.current[nextIdx]?.focus();
      return;
    }

    const updated = [...codeDigits];
    updated[index] = cleaned;
    setCodeDigits(updated);

    if (cleaned && index < 3) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeDigitKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !codeDigits[index] && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCodeSubmit = async () => {
    const fullCode = codeDigits.join('').trim();
    if (fullCode.length < 4) {
      setCodeError('Ingresa los 4 dígitos del código PIN.');
      return;
    }

    setIsVerifyingCode(true);
    setCodeError(null);

    const res = await joinChannelByCode(fullCode);
    setIsVerifyingCode(false);

    if (res.success && res.channel) {
      setPinModalVisible(false);
      setCodeDigits(['', '', '', '']);
      setSelectedChannel(res.channel);
      navigation.navigate('PTT');
    } else {
      setCodeError(res.message || 'Código de canal no encontrado o PIN incorrecto.');
    }
  };

  // Éxito al escanear QR con cámara
  const handleQrScanned = async (scanned: string) => {
    setQrScannerVisible(false);
    let extracted = scanned.trim();

    // Extraer PIN si viene en formato url o esquema c5i://
    if (extracted.includes('pin=')) {
      const match = extracted.match(/pin=([^&]+)/);
      if (match && match[1]) extracted = match[1];
    } else if (extracted.includes('/canal/')) {
      const parts = extracted.split('/canal/');
      if (parts[1]) extracted = parts[1];
    }

    const res = await joinChannelByCode(extracted);
    if (res.success && res.channel) {
      setSelectedChannel(res.channel);
      navigation.navigate('PTT');
    } else {
      Alert.alert('Código QR no reconocido', res.message || 'No fue posible sincronizar el canal.');
    }
  };

  // Abrir configuración minimalista
  const handleOpenConfig = (channel: Channel) => {
    setConfigChannel(channel);
    setCopiedNotice(false);
    setConfigModalVisible(true);
  };

  // Compartir canal
  const handleShareChannel = async () => {
    if (!configChannel) return;
    const channelPin = configChannel.access_code || '7710';
    const channelUrl = `https://c5i.hidalgo.gob.mx/radio/canal/${configChannel.id}`;

    try {
      await Share.share({
        title: `Canal C5i: ${configChannel.name}`,
        message: `🚨 *Canal Táctico C5i*\nCanal: *${configChannel.name}*\nPIN de acceso: *${channelPin}*\nEnlace directo: ${channelUrl}`,
      });
    } catch (e) {
      console.warn('Error al compartir canal:', e);
    }
  };

  // Eliminar canal
  const handleDeleteChannel = (channel: Channel) => {
    Alert.alert(
      'Eliminar Canal',
      `¿Deseas eliminar permanentemente el canal "${channel.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteChannel(channel.id);
            if (configModalVisible && configChannel?.id === channel.id) {
              setConfigModalVisible(false);
            }
          },
        },
      ]
    );
  };

  // Salir / Abandonar canal (para usuarios que no son administradores)
  const handleLeaveChannel = (channel: Channel) => {
    Alert.alert(
      'Salir del Grupo',
      `¿Deseas desconectarte y abandonar el canal "${channel.name}"? Dejarás de recibir el audio de esta frecuencia.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir del Grupo',
          style: 'destructive',
          onPress: async () => {
            await leaveChannel(channel.id);
            if (configModalVisible && configChannel?.id === channel.id) {
              setConfigModalVisible(false);
            }
          },
        },
      ]
    );
  };

  // Filtrado de canales
  const filteredChannels = channels.filter((ch) => {
    const matchesSearch =
      (ch.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ch.access_code || '').includes(searchTerm);

    const matchesCategory =
      selectedCategory === 'todos' ||
      (selectedCategory === 'privados' && Boolean(ch.is_private)) ||
      ch.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const selectedCategoryObj =
    CATEGORY_OPTIONS.find((c) => c.id === newCategory) || CATEGORY_OPTIONS[0];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Header idéntico a la 2da imagen: Icono cuadrado y solo "Grupos" */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.headerBadgeIcon,
              {
                backgroundColor: isDark ? 'rgba(235, 82, 124, 0.12)' : '#fdf2f4',
                borderColor: isDark ? 'rgba(235, 82, 124, 0.25)' : '#fce7eb',
              },
            ]}
          >
            <Radio color={colors.primary} size={18} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Grupos</Text>
        </View>

        {/* Botones cuadrados idénticos a la 2da imagen (Unirse y Nuevo, sin SOS) */}
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setJoinModalVisible(true)}
            style={[
              styles.squareHeaderBtn,
              {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: isDark ? '#334155' : '#e2e8f0',
              },
            ]}
            title="Unirse a Canal"
          >
            <LogIn color={colors.primary} size={18} />
          </Pressable>

          <Pressable
            onPress={() => {
              setNewChannelName('');
              setCreatePinDigits(['', '', '', '']);
              setNewIsPrivate(false);
              setCreateModalVisible(true);
            }}
            style={[styles.squareHeaderBtnPrimary, { backgroundColor: colors.primary }]}
            title="Nuevo Canal"
          >
            <Plus color="#ffffff" size={18} />
          </Pressable>
        </View>
      </View>

      {/* 2. Barra de Búsqueda */}
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <Search color={colors.textMuted} size={16} />
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Buscar canal o frecuencia..."
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchTerm.length > 0 && (
            <Pressable onPress={() => setSearchTerm('')}>
              <X color={colors.textMuted} size={16} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 3. Filtrador por Categorías (Fondo guinda con letra blanca al seleccionar) */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  styles.categoryChip,
                  isSelected
                    ? [styles.categoryChipSelected, { backgroundColor: colors.primary }]
                    : [
                        styles.categoryChipUnselected,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.cardBorder,
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected
                      ? styles.categoryChipTextSelected
                      : { color: colors.textSecondary },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Lista de Canales o Estado Vacío (Sin botones en el espacio, idéntico a 2da imagen) */}
      {filteredChannels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              {
                backgroundColor: isDark ? 'rgba(235, 82, 124, 0.08)' : '#fdf2f4',
                borderColor: isDark ? 'rgba(235, 82, 124, 0.15)' : '#fce7eb',
              },
            ]}
          >
            <Radio color={colors.primary} size={30} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No tienes canales creados todavía
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Crea tu propio canal o únete a uno existente en la red táctica C5i.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredChannels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          renderItem={({ item }) => {
            const isSelected = selectedChannel?.id === item.id;
            const categoryName = (item.category || 'general').toUpperCase();

            return (
              <Pressable
                onPress={() => handleSelectChannel(item)}
                style={[
                  styles.channelCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.primary : colors.cardBorder,
                  },
                  isSelected && styles.channelCardSelected,
                ]}
              >
                <View
                  style={[
                    styles.channelIconBadge,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(235, 82, 124, 0.15)'
                          : '#fff1f2'
                        : colors.badgeBackground,
                    },
                  ]}
                >
                  <Radio
                    color={isSelected ? colors.primary : colors.textSecondary}
                    size={20}
                  />
                </View>

                <View style={styles.channelDetails}>
                  <View style={styles.nameRow}>
                    <Text
                      style={[
                        styles.channelName,
                        { color: isSelected ? colors.primary : colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.is_private ? (
                      <View style={styles.lockBadge}>
                        <Lock color="#f59e0b" size={12} />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={[styles.categoryTag, { color: colors.textMuted }]}>
                      {categoryName}
                    </Text>
                    <Text style={[styles.metaDivider, { color: colors.textMuted }]}>•</Text>
                    <View style={styles.metaBadge}>
                      <Users color={colors.textMuted} size={11} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {item.member_count || 1} activos
                      </Text>
                    </View>
                    <Text style={[styles.metaDivider, { color: colors.textMuted }]}>•</Text>
                    <View style={styles.metaBadge}>
                      <ShieldCheck color="#10b981" size={11} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        E2EE
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Acciones Derecha */}
                <View style={styles.cardRightActions}>
                  {isSelected && (
                    <View
                      style={[
                        styles.activeTag,
                        {
                          backgroundColor: isDark
                            ? 'rgba(235, 82, 124, 0.15)'
                            : '#fff1f2',
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <CheckCircle2 color={colors.primary} size={11} />
                      <Text style={[styles.activeTagText, { color: colors.primary }]}>
                        ACTIVO
                      </Text>
                    </View>
                  )}

                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenConfig(item);
                    }}
                    style={[
                      styles.configIconBtn,
                      {
                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <QrCode color={colors.primary} size={16} />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREAR GRUPO IDÉNTICO A LA VERSIÓN WEB (3ra imagen)*/}
      {/* ======================================================== */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {/* Encabezado con FolderPlus y texto en color guinda exacto */}
            <View style={styles.webModalHeader}>
              <View style={styles.webModalHeaderTitleRow}>
                <FolderPlus color="#8a1a36" size={20} />
                <Text style={styles.webModalTitle}>
                  Nuevo Canal de Radiocomunicación
                </Text>
              </View>
              <Pressable
                onPress={() => setCreateModalVisible(false)}
                style={styles.closeBtn}
              >
                <X color={colors.textMuted} size={18} />
              </Pressable>
            </View>

            <View style={styles.webModalDivider} />

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* Campo 1: Nombre del Canal * */}
              <View style={styles.formGroup}>
                <Text style={[styles.webLabel, { color: colors.text }]}>
                  Nombre del Canal *
                </Text>
                <TextInput
                  value={newChannelName}
                  onChangeText={setNewChannelName}
                  placeholder="Ej. Operativo Huasteca Hidalguense"
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.webInput,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.text,
                    },
                  ]}
                />
              </View>

              {/* Campo 2: Categoría / Propósito (Select box con ChevronDown) */}
              <View style={styles.formGroup}>
                <Text style={[styles.webLabel, { color: colors.text }]}>
                  Categoría / Propósito
                </Text>
                <Pressable
                  onPress={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                  style={[
                    styles.webSelectBox,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <Text style={[styles.webSelectText, { color: colors.text }]}>
                    {selectedCategoryObj.label}
                  </Text>
                  <ChevronDown color={colors.textMuted} size={16} />
                </Pressable>

                {/* Menú desplegable */}
                {isCategoryPickerOpen && (
                  <View
                    style={[
                      styles.categoryDropdownMenu,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.id}
                        onPress={() => {
                          setNewCategory(opt.id);
                          setIsCategoryPickerOpen(false);
                        }}
                        style={[
                          styles.categoryDropdownOption,
                          newCategory === opt.id && {
                            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryDropdownOptionText,
                            {
                              color:
                                newCategory === opt.id ? colors.primary : colors.text,
                              fontWeight: newCategory === opt.id ? '700' : '500',
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Campo 3: Canal Privado con PIN (Tarjeta con checkbox cuadrado) */}
              <Pressable
                onPress={() => setNewIsPrivate(!newIsPrivate)}
                style={[
                  styles.webCheckboxRow,
                  {
                    backgroundColor: isDark ? '#111927' : '#f8fafc',
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.webCheckboxTitle, { color: colors.text }]}>
                    Canal Privado con PIN
                  </Text>
                  <Text style={[styles.webCheckboxSubtitle, { color: colors.textMuted }]}>
                    Requiere código para ingresar
                  </Text>
                </View>

                {/* Checkbox cuadrado idéntico a web */}
                <View
                  style={[
                    styles.webSquareCheckbox,
                    {
                      borderColor: newIsPrivate ? '#8a1a36' : colors.inputBorder,
                      backgroundColor: newIsPrivate ? '#8a1a36' : 'transparent',
                    },
                  ]}
                >
                  {newIsPrivate && <Check color="#ffffff" size={14} />}
                </View>
              </Pressable>

              {/* Si es privado: PIN de 4 dígitos con las casillas individuales tipo SMS */}
              {newIsPrivate && (
                <View style={styles.pinSectionWrapper}>
                  <Text style={[styles.webLabel, { color: colors.text, marginBottom: 8 }]}>
                    Código PIN de Acceso (4 dígitos)
                  </Text>
                  <View style={styles.smsBoxesRow}>
                    {createPinDigits.map((digit, idx) => (
                      <TextInput
                        key={idx}
                        ref={(r) => (createPinRefs.current[idx] = r)}
                        value={digit}
                        onChangeText={(v) => handleCreatePinChange(idx, v)}
                        onKeyPress={({ nativeEvent }) =>
                          handleCreatePinKeyPress(idx, nativeEvent.key)
                        }
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                        style={[
                          styles.smsDigitBox,
                          {
                            backgroundColor: colors.inputBg,
                            borderColor: digit ? '#8a1a36' : colors.inputBorder,
                            color: colors.text,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Botones inferiores: Cancelar y Crear Canal */}
            <View style={styles.webModalActions}>
              <Pressable
                onPress={() => setCreateModalVisible(false)}
                style={[
                  styles.webCancelBtn,
                  { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                ]}
              >
                <Text
                  style={[
                    styles.webCancelBtnText,
                    { color: isDark ? '#e2e8f0' : '#475569' },
                  ]}
                >
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                onPress={handleCreateChannelSubmit}
                disabled={isCreating}
                style={[styles.webConfirmBtn, { backgroundColor: '#8a1a36' }]}
              >
                {isCreating ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.webConfirmBtnText}>Crear Canal</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: UNIRSE A CANAL (En blanco + Botón Código y Cámara)*/}
      {/* ======================================================== */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              styles.joinModalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.webModalHeader}>
              <View style={styles.webModalHeaderTitleRow}>
                <LogIn color="#8a1a36" size={20} />
                <Text style={styles.webModalTitle}>
                  Unirse a Canal de Radio
                </Text>
              </View>
              <Pressable
                onPress={() => setJoinModalVisible(false)}
                style={styles.closeBtn}
              >
                <X color={colors.textMuted} size={18} />
              </Pressable>
            </View>

            <View style={styles.webModalDivider} />

            {joinError && (
              <View style={styles.errorBanner}>
                <AlertTriangle color="#ef4444" size={14} />
                <Text style={styles.errorBannerText}>{joinError}</Text>
              </View>
            )}

            {/* Lista en blanco/limpia sin mock data */}
            <View style={styles.cleanJoinContainer}>
              {availableNetworkChannels.length === 0 ? (
                <View style={styles.blankChannelsBox}>
                  <Radio color={colors.textMuted} size={32} style={{ opacity: 0.4 }} />
                  <Text style={[styles.blankTitle, { color: colors.textSecondary }]}>
                    Sin canales públicos en línea
                  </Text>
                  <Text style={[styles.blankSubtitle, { color: colors.textMuted }]}>
                    Ingresa el código PIN o escanea el código QR proporcionado por tu oficial de radio.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 220 }}>
                  {availableNetworkChannels.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={async () => {
                        const res = await joinChannel(c.id);
                        if (res.success && res.channel) {
                          setSelectedChannel(res.channel);
                          setJoinModalVisible(false);
                          navigation.navigate('PTT');
                        }
                      }}
                      style={[
                        styles.availableItem,
                        {
                          backgroundColor: isDark ? '#111927' : '#f8fafc',
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <Radio color={colors.primary} size={16} />
                      <Text style={[styles.availableItemName, { color: colors.text }]}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Dos botones inferiores lado a lado: Ingresar Código y Escanear QR */}
            <View style={styles.joinBottomDualButtons}>
              <Pressable
                onPress={() => {
                  setJoinModalVisible(false);
                  setCodeDigits(['', '', '', '']);
                  setCodeError(null);
                  setPinModalVisible(true);
                }}
                style={[
                  styles.dualActionBtn,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: '#8a1a36',
                  },
                ]}
              >
                <KeyRound color="#8a1a36" size={16} />
                <Text style={[styles.dualActionBtnText, { color: '#8a1a36' }]}>
                  Ingresar Código
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setJoinModalVisible(false);
                  setQrScannerVisible(true);
                }}
                style={[
                  styles.dualActionBtnPrimary,
                  { backgroundColor: '#8a1a36' },
                ]}
              >
                <Camera color="#ffffff" size={16} />
                <Text style={styles.dualActionBtnPrimaryText}>
                  Escanear QR
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: INGRESO CON CÓDIGO PIN (4 CASILLAS ESTILO SMS)   */}
      {/* ======================================================== */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.webModalHeader}>
              <View style={styles.webModalHeaderTitleRow}>
                <KeyRound color="#8a1a36" size={20} />
                <Text style={styles.webModalTitle}>Ingresar Código del Grupo</Text>
              </View>
              <Pressable
                onPress={() => setPinModalVisible(false)}
                style={styles.closeBtn}
              >
                <X color={colors.textMuted} size={18} />
              </Pressable>
            </View>

            <View style={styles.webModalDivider} />

            <Text style={[styles.smsModalSubtitle, { color: colors.textSecondary }]}>
              Introduce los 4 dígitos del código PIN del canal para acceder a la frecuencia protegida:
            </Text>

            {codeError && (
              <View style={styles.errorBanner}>
                <AlertTriangle color="#ef4444" size={14} />
                <Text style={styles.errorBannerText}>{codeError}</Text>
              </View>
            )}

            {/* 4 casillas individuales tipo SMS */}
            <View style={styles.smsBoxesRow}>
              {codeDigits.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(r) => (digitInputRefs.current[idx] = r)}
                  value={digit}
                  onChangeText={(v) => handleCodeDigitChange(idx, v)}
                  onKeyPress={({ nativeEvent }) =>
                    handleCodeDigitKeyPress(idx, nativeEvent.key)
                  }
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  style={[
                    styles.smsDigitBox,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: digit ? '#8a1a36' : colors.inputBorder,
                      color: colors.text,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.webModalActions}>
              <Pressable
                onPress={() => {
                  setPinModalVisible(false);
                  setJoinModalVisible(true);
                }}
                style={[
                  styles.webCancelBtn,
                  { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                ]}
              >
                <Text style={[styles.webCancelBtnText, { color: colors.textSecondary }]}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                onPress={handleVerifyCodeSubmit}
                disabled={isVerifyingCode}
                style={[styles.webConfirmBtn, { backgroundColor: '#8a1a36' }]}
              >
                {isVerifyingCode ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.webConfirmBtnText}>Unirse al Grupo</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: ESCÁNER QR CON CÁMARA (Láser y retícula táctica) */}
      {/* ======================================================== */}
      <QrScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onScanSuccess={handleQrScanned}
        onOpenManualCode={() => {
          setCodeDigits(['', '', '', '']);
          setPinModalVisible(true);
        }}
      />

      {/* ======================================================== */}
      {/* MODAL 5: CONFIGURACIÓN (ADMINISTRADOR vs USUARIOS)       */}
      {/* ======================================================== */}
      {configChannel && (() => {
        const isConfigAdmin = Boolean(
          user?.role === 'admin' ||
          configChannel.role === 'admin' ||
          (user?.id && configChannel.admin_id === user.id) ||
          (user?.id && configChannel.created_by === user.id) ||
          (user?.phone_number && configChannel.created_by === user.phone_number)
        );
        const channelAdminName = configChannel.admin_name || 'Comandancia C5i Central';

        return (
          <Modal
            visible={configModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setConfigModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalCard,
                  styles.minimalConfigModal,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                {/* Encabezado limpio */}
                <View style={styles.webModalHeader}>
                  <View style={styles.webModalHeaderTitleRow}>
                    <QrCode color="#8a1a36" size={20} />
                    <Text style={styles.webModalTitle}>Configuración del Canal</Text>
                  </View>
                  <Pressable
                    onPress={() => setConfigModalVisible(false)}
                    style={styles.closeBtn}
                  >
                    <X color={colors.textMuted} size={18} />
                  </Pressable>
                </View>

                <View style={styles.webModalDivider} />

                {/* Título y categoría del canal */}
                <View style={styles.minimalHeaderInfo}>
                  <Text style={[styles.minimalChannelName, { color: colors.text }]}>
                    {configChannel.name}
                  </Text>
                  <Text style={[styles.minimalChannelMeta, { color: colors.textMuted }]}>
                    {(configChannel.category || 'general').toUpperCase()} • {configChannel.member_count || 1} miembros
                  </Text>

                  {/* Badge de Nivel de Rol: Administrador vs Usuario */}
                  <View style={styles.roleBadgeContainer}>
                    {isConfigAdmin ? (
                      <View style={styles.adminRoleBadge}>
                        <ShieldCheck color="#10b981" size={13} />
                        <Text style={styles.adminRoleBadgeText}>ROL: ADMINISTRADOR</Text>
                      </View>
                    ) : (
                      <View style={styles.userRoleBadge}>
                        <Users color="#38bdf8" size={13} />
                        <Text style={styles.userRoleBadgeText}>ROL: USUARIO OPERATIVO</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* CONTENIDO EXCLUSIVO SEGÚN EL ROL */}
                {isConfigAdmin ? (
                  // VISTA PARA EL ADMINISTRADOR (Único que ve el PIN y el QR)
                  <View>
                    <Text style={[styles.adminNoticeText, { color: colors.textSecondary }]}>
                      Como Administrador tienes autorización exclusiva para visualizar y compartir las credenciales de este canal.
                    </Text>

                    {/* CÓDIGO QR ESTÁNDAR ISO/IEC 18004 100% ESCANEABLE */}
                    <View style={styles.minimalQrBox}>
                      <QrCodeView
                        value={`https://c5i.hidalgo.gob.mx/radio/canal/${configChannel.access_code || configChannel.id}`}
                        size={185}
                        color="#000000"
                        backgroundColor="#ffffff"
                      />
                      <Text style={[styles.minimalScanInstruction, { color: colors.textMuted }]}>
                        Muestra este código a tus compañeros para sincronizar la frecuencia con su cámara
                      </Text>
                    </View>

                    {/* PIN del Grupo en casillas estilizadas limpias */}
                    <View style={styles.minimalPinRow}>
                      <Text style={[styles.minimalPinLabel, { color: colors.textSecondary }]}>
                        PIN:
                      </Text>
                      {(configChannel.access_code || '7710')
                        .slice(0, 4)
                        .split('')
                        .map((d, i) => (
                          <View
                            key={i}
                            style={[
                              styles.minimalPinCharBox,
                              {
                                backgroundColor: isDark ? '#111927' : '#ffffff',
                                borderColor: '#8a1a36',
                              },
                            ]}
                          >
                            <Text style={styles.minimalPinCharText}>{d}</Text>
                          </View>
                        ))}
                    </View>

                    {/* Acciones de Administrador */}
                    <View style={styles.minimalActionButtons}>
                      <Pressable
                        onPress={handleShareChannel}
                        style={[styles.minimalShareBtn, { backgroundColor: '#8a1a36' }]}
                      >
                        <Share2 color="#ffffff" size={16} />
                        <Text style={styles.minimalShareBtnText}>Compartir Canal</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleDeleteChannel(configChannel)}
                        style={styles.minimalDeleteBtn}
                      >
                        <Trash2 color="#ef4444" size={14} />
                        <Text style={styles.minimalDeleteBtnText}>Eliminar este Canal</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  // VISTA PARA USUARIOS NORMALES (PIN y QR ocultos bajo protección de seguridad)
                  <View>
                    <View
                      style={[
                        styles.restrictedBox,
                        {
                          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.restrictedIconBadge}>
                        <Lock color="#f59e0b" size={24} />
                      </View>
                      <Text style={[styles.restrictedTitle, { color: colors.text }]}>
                        Código y QR Protegidos
                      </Text>
                      <Text style={[styles.restrictedDesc, { color: colors.textSecondary }]}>
                        Solo el Administrador del canal tiene autorización para visualizar el código PIN de acceso y el código QR de sincronización.
                      </Text>

                      <View style={styles.restrictedDivider} />

                      <View style={styles.restrictedRow}>
                        <Text style={[styles.restrictedLabel, { color: colors.textMuted }]}>
                          Administrador:
                        </Text>
                        <Text style={[styles.restrictedValue, { color: colors.text }]}>
                          {channelAdminName}
                        </Text>
                      </View>

                      <View style={styles.restrictedRow}>
                        <Text style={[styles.restrictedLabel, { color: colors.textMuted }]}>
                          Tu Nivel de Acceso:
                        </Text>
                        <Text style={[styles.restrictedValue, { color: '#38bdf8' }]}>
                          Usuario Operativo
                        </Text>
                      </View>

                      <View style={styles.restrictedRow}>
                        <Text style={[styles.restrictedLabel, { color: colors.textMuted }]}>
                          Seguridad:
                        </Text>
                        <Text style={[styles.restrictedValue, { color: '#10b981' }]}>
                          Frecuencia Cifrada E2EE
                        </Text>
                      </View>
                    </View>

                    {/* Botón para que el usuario pueda salir del canal */}
                    <View style={styles.minimalActionButtons}>
                      <Pressable
                        onPress={() => handleLeaveChannel(configChannel)}
                        style={[
                          styles.leaveChannelBtn,
                          {
                            backgroundColor: isDark ? '#1e293b' : '#fef2f2',
                            borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#fecaca',
                          },
                        ]}
                      >
                        <LogOut color="#ef4444" size={16} />
                        <Text style={styles.leaveChannelBtnText}>Salir de este Grupo</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  squareHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareHeaderBtnPrimary: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  categoriesWrapper: {
    paddingVertical: 6,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryChipSelected: {
    borderColor: '#8a1a36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryChipUnselected: {},
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 290,
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  channelCardSelected: {
    borderWidth: 1.5,
  },
  channelIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  channelDetails: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  lockBadge: {
    marginLeft: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  categoryTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metaDivider: {
    fontSize: 10,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  configIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  joinModalCard: {
    maxHeight: '85%',
  },
  closeBtn: {
    padding: 4,
  },
  webModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  webModalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  webModalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#8a1a36',
  },
  webModalDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 14,
  },
  webLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  webInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  webSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  webSelectText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryDropdownMenu: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  categoryDropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  categoryDropdownOptionText: {
    fontSize: 13,
  },
  webCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 4,
  },
  webCheckboxTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  webCheckboxSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  webSquareCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinSectionWrapper: {
    marginTop: 12,
  },
  smsBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 10,
  },
  smsDigitBox: {
    width: 48,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  webModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  webCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  webCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  webConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 110,
  },
  webConfirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  cleanJoinContainer: {
    minHeight: 120,
    justifyContent: 'center',
  },
  blankChannelsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  blankTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  blankSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  availableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  availableItemName: {
    fontSize: 13,
    fontWeight: '600',
  },
  joinBottomDualButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingTop: 14,
  },
  dualActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  dualActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dualActionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  dualActionBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  smsModalSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginBottom: 10,
  },
  errorBannerText: {
    color: '#ef4444',
    fontSize: 11,
    flex: 1,
  },
  minimalConfigModal: {
    padding: 22,
  },
  minimalHeaderInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  minimalChannelName: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  minimalChannelMeta: {
    fontSize: 11,
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  minimalQrBox: {
    alignItems: 'center',
    marginVertical: 10,
  },
  minimalScanInstruction: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 240,
  },
  minimalPinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 10,
  },
  minimalPinLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  minimalPinCharBox: {
    width: 34,
    height: 40,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimalPinCharText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8a1a36',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  minimalActionButtons: {
    gap: 8,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
    paddingTop: 12,
  },
  minimalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
  },
  minimalShareBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  minimalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  minimalDeleteBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  roleBadgeContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  adminRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  adminRoleBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  userRoleBadgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adminNoticeText: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  restrictedBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  restrictedIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  restrictedTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  restrictedDesc: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  restrictedDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    marginBottom: 12,
  },
  restrictedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 4,
  },
  restrictedLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  restrictedValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  leaveChannelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  leaveChannelBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
