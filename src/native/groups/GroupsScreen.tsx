import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard, Platform, Clipboard, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { RadioIcon, AlertTriangleIcon, LogInIcon, PlusIcon, SearchIcon, XIcon, UsersIcon,
  QrCodeIcon, CameraIcon, CopyIcon, LogOutIcon, TrashIcon, CheckCircleIcon } from '../icons';
import QRCode from 'qrcode';
import { soundEngine } from '../../services/soundEngine';
import type { Channel } from '../../services/channelsApi';
import type { ChannelsDirectory } from './useChannelsDirectory';
import { ChannelQrScanner } from './ChannelQrScanner';
import { groupStyles as styles } from './groupStyles';

interface Props {
  directory: ChannelsDirectory;
  selectedChannel: Channel | null;
  onTune: (channel: Channel | null) => void;
  onSos: () => void;
  onOpenPtt: () => void;
}
export function GroupsScreen({ directory, selectedChannel, onTune, onSos, onOpenPtt }: Props) {
  const { channels } = directory;
  const { height: viewportHeight } = useWindowDimensions();
  const [configError, setConfigError] = useState<string | null>(null);
  // Búsqueda y ventanas del grupo.
  const [channelSearchText, setChannelSearchText] = useState('');

  // Modal: Unirse a Canal
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinPinDigits, setJoinPinDigits] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoinScanning, setIsJoinScanning] = useState(false);
  const joinPinInputRef = useRef<any>(null);

  // Modal: Crear Canal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createChannelName, setCreateChannelName] = useState('');
  const [createChannelPin, setCreateChannelPin] = useState('');
  const [createChannelError, setCreateChannelError] = useState<string | null>(null);
  const createChannelPinInputRef = useRef<any>(null);

  // Modal: Configuración y QR del Canal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configChannel, setConfigChannel] = useState<Channel | null>(null);
  const [configQrUrl, setConfigQrUrl] = useState<string | null>(null);
  const [configQrMatrix, setConfigQrMatrix] = useState<boolean[][]>([]);
  const [hasCopiedPin, setHasCopiedPin] = useState(false);

  // Modal de éxito táctico personalizado (reemplaza Alert.alert del sistema con colorimetría C5i)
  const [scanSuccessModal, setScanSuccessModal] = useState<{
    isOpen: boolean;
    channel: Channel | null;
    pin: string;
    source: 'qr' | 'pin' | 'tune' | 'leave' | 'delete' | 'create';
    customTitle?: string;
    customSubtitle?: string;
  }>({
    isOpen: false,
    channel: null,
    pin: '',
    source: 'qr',
  });


  const filteredChannels = useMemo(() => {
    const query = channelSearchText.trim().toLocaleLowerCase();
    return channels.filter(ch => !query || [ch.name, ch.pin].some(value => value.toLocaleLowerCase().includes(query)))
      .sort((a, b) => Number(b.id === selectedChannel?.id) - Number(a.id === selectedChannel?.id));
  }, [channels, channelSearchText, selectedChannel?.id]);
  const confirmChannel = (channel: Channel, source: 'create' | 'pin' | 'qr' | 'tune') => {
    onTune(channel);
    setIsJoinScanning(false); setIsJoinModalOpen(false); setIsCreateModalOpen(false);
    setJoinPinDigits('');
    try { soundEngine.playIncomingChirp(); } catch {}
    setScanSuccessModal({ isOpen: true, channel, pin: channel.pin, source });
  };
  const handleTuneChannel = (channel: Channel) => confirmChannel(channel, 'tune');
  const handleJoinChannelSubmit = async () => {
    Keyboard.dismiss(); setJoinError(null);
    if (!/^\d{4}$/.test(joinPinDigits)) { setJoinError('Ingresa los 4 dígitos del PIN.'); return; }
    try { confirmChannel(await directory.join(joinPinDigits), 'pin'); }
    catch (error) { setJoinError(error instanceof Error ? error.message : 'No se pudo unir al grupo.'); }
  };
  const handleCreateChannelSubmit = async () => {
    Keyboard.dismiss(); setCreateChannelError(null);
    if (!createChannelName.trim()) { setCreateChannelError('Ingresa el nombre del grupo.'); return; }
    if (createChannelPin && !/^\d{4}$/.test(createChannelPin)) { setCreateChannelError('El PIN debe tener 4 dígitos o dejarse vacío para generar uno.'); return; }
    try { confirmChannel(await directory.create(createChannelName, createChannelPin), 'create'); }
    catch (error) { setCreateChannelError(error instanceof Error ? error.message : 'No se pudo guardar el grupo.'); }
  };
  const handleLeaveChannel = async (channel: Channel) => {
    setConfigError(null);
    try {
      await directory.leave(channel.id);
      if (selectedChannel?.id === channel.id) onTune(null);
      setIsConfigModalOpen(false);
      setScanSuccessModal({ isOpen: true, channel, pin: channel.pin, source: 'leave' });
    } catch (error) { setConfigError(error instanceof Error ? error.message : 'No se pudo salir del grupo.'); }
  };
  const handleDeleteChannel = async (channel: Channel) => {
    setConfigError(null);
    try {
      await directory.remove(channel.id);
      if (selectedChannel?.id === channel.id) onTune(null);
      setIsConfigModalOpen(false);
      setScanSuccessModal({ isOpen: true, channel, pin: channel.pin, source: 'delete' });
    } catch (error) { setConfigError(error instanceof Error ? error.message : 'No se pudo eliminar el grupo.'); }
  };
  const scanBusy = useRef(false);
  const joinRef = useRef(directory.join); joinRef.current = directory.join;
  const confirmRef = useRef(confirmChannel); confirmRef.current = confirmChannel;
  const handleScannedQrPayload = useCallback(async (raw: string) => {
    if (scanBusy.current) return;
    scanBusy.current = true; setJoinError(null);
    try {
      const pin = raw.trim().match(/PIN[-:]?(\d{4})(?!\d)/i)?.[1] || (/^\d{4}$/.test(raw.trim()) ? raw.trim() : null);
      if (!pin) throw new Error('El QR no contiene un PIN de grupo válido.');
      const id = raw.match(/^C5I-CANAL:(chan-[^:]+):PIN-/i)?.[1];
      confirmRef.current(await joinRef.current(pin, id), 'qr');
    } catch (error) { setJoinError(error instanceof Error ? error.message : 'No se pudo consultar el grupo del QR.'); }
    finally { setTimeout(() => { scanBusy.current = false; }, 2000); }
  }, []);
  // Abrir modal de configuración y QR de un canal (Seguro para iPhone y Web sin error de canvas)
  const openChannelConfig = (ch: Channel) => {
    setConfigChannel(ch);
    setHasCopiedPin(false);
    const pin = ch.pin || '';
    const qrText = `C5I-CANAL:${ch.id}:PIN-${pin}`;
    setConfigError(null);
    setConfigQrMatrix([]);
    setConfigQrUrl(null);

    try {
      // Generación de matriz pura en memoria sin requerir elemento HTML5 <canvas>
      const qr = QRCode.create(qrText, { errorCorrectionLevel: 'M' });
      const size = qr.modules.size;
      const matrix: boolean[][] = [];
      for (let r = 0; r < size; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < size; c++) {
          row.push(Boolean(qr.modules.get(r, c)));
        }
        matrix.push(row);
      }
      setConfigQrMatrix(matrix);
    } catch (e) {
      console.warn('Error generating QR matrix', e);
    }

    // En navegador web se puede generar dataURL opcionalmente
    if (Platform.OS === 'web') {
      try {
        QRCode.toDataURL(qrText, {
          width: 240,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
        })
          .then((url) => setConfigQrUrl(url))
          .catch(() => {});
      } catch {}
    }

    setIsConfigModalOpen(true);
  };


  // Copiar ÚNICAMENTE el PIN al portapapeles (compatible nativo con iPhone y Web)
  const copyToClipboard = async (pinText: string) => {
    const pinOnly = String(pinText || '').trim();

    // 1. Portapapeles Nativo de iOS y Android en React Native
    try {
      if (Clipboard && typeof Clipboard.setString === 'function') {
        Clipboard.setString(pinOnly);
      }
    } catch (e) {
      console.warn('Clipboard setString failed', e);
    }

    // 2. Portapapeles Web si se ejecuta en navegador
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(pinOnly);
      } catch {}
    }

    setHasCopiedPin(true);
    setTimeout(() => setHasCopiedPin(false), 2500);
  };

  return <>
          <View style={styles.canalesMainWrapper}>
            <View style={styles.canalesHeader}>
              <View style={styles.canalesHeaderLeft}>
                <View style={styles.canalesHeaderIconBox}>
                  <RadioIcon size={22} color="#8a1a36" strokeWidth={2.2} />
                </View>
                <Text style={styles.canalesHeaderTitle}>Canales</Text>
              </View>

              <View style={styles.canalesHeaderActions}>
                {/* 1. Botón SOS */}
                <TouchableOpacity
                  style={styles.cleanSosBtn}
                  onPress={onSos}
                  activeOpacity={0.85}
                  accessibilityLabel="Llamada de Emergencia SOS"
                >
                  <AlertTriangleIcon size={18} color="#ffffff" strokeWidth={2.2} />
                </TouchableOpacity>

                {/* 2. Botón Unirse a Canal */}
                <TouchableOpacity
                  style={styles.canalesHeaderActionBtn}
                  onPress={() => {
                    setJoinPinDigits('');
                    setJoinError(null);
                    setIsJoinModalOpen(true);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="Unirse a un canal con PIN o QR"
                >
                  <LogInIcon size={20} color="#334155" strokeWidth={2} />
                </TouchableOpacity>

                {/* 3. Botón Crear Canal */}
                <TouchableOpacity
                  style={styles.canalesHeaderCreateBtn}
                  onPress={() => {
                    setCreateChannelName('');
                    setCreateChannelPin('');
                    setCreateChannelError(null);
                    setIsCreateModalOpen(true);
                  }}
                  activeOpacity={0.85}
                  accessibilityLabel="Crear un nuevo canal táctico"
                >
                  <PlusIcon size={20} color="#ffffff" strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            </View>

            {/* BARRA DE BÚSQUEDA */}
            <View style={styles.canalesSearchContainer}>
              <View style={styles.canalesSearchBox}>
                <SearchIcon size={18} color="#94a3b8" strokeWidth={2} />
                <TextInput
                  style={styles.canalesSearchInput}
                  value={channelSearchText}
                  onChangeText={setChannelSearchText}
                  placeholder="Buscar grupo o PIN..."
                  placeholderTextColor="#94a3b8"
                />
                {channelSearchText.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setChannelSearchText('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <XIcon size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* LISTADO DE CANALES O ESTADO VACÍO */}
            <ScrollView
              style={styles.canalesListScroll}
              contentContainerStyle={styles.canalesListContent}
              showsVerticalScrollIndicator={false}
            >
              {directory.error && <View style={styles.recoveryErrorBanner}>
                <Text style={styles.recoveryErrorText}>{directory.error}</Text>
                <TouchableOpacity onPress={() => directory.refresh()} accessibilityLabel="Actualizar grupos"><Text>Reintentar</Text></TouchableOpacity>
              </View>}
              {directory.loading && !directory.synced && <ActivityIndicator color="#691c32" accessibilityLabel="Cargando grupos" />}
              {(!directory.loading || directory.synced) && !directory.error && filteredChannels.length === 0 ? (
                /* ESTADO VACÍO EXACTO A LA IMAGEN 1 */
                <View style={styles.canalesEmptyContainer}>
                  <View style={styles.canalesEmptyIconBox}>
                    <RadioIcon size={32} color="#8a1a36" strokeWidth={2} />
                  </View>
                  <Text style={styles.canalesEmptyTitle}>{channelSearchText.trim() ? 'Sin resultados' : 'Sin ningún grupo registrado'}</Text>
                  <Text style={styles.canalesEmptySubtext}>
                    {channelSearchText.trim() ? 'Prueba otro nombre o PIN.' : 'Crea un grupo o únete a uno existente mediante su PIN o QR.'}
                  </Text>

                  <View style={styles.canalesEmptyButtonsRow}>
                    <TouchableOpacity
                      style={styles.canalesEmptyCreateBtn}
                      onPress={() => {
                        setCreateChannelName('');
                        setCreateChannelPin('');
                        setCreateChannelError(null);
                        setIsCreateModalOpen(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <PlusIcon size={16} color="#ffffff" strokeWidth={2.4} />
                      <Text style={styles.canalesEmptyCreateBtnText}>Crear Canal</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.canalesEmptyJoinBtn}
                      onPress={() => {
                        setJoinPinDigits('');
                        setJoinError(null);
                        setIsJoinModalOpen(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <LogInIcon size={16} color="#8a1a36" strokeWidth={2} />
                      <Text style={styles.canalesEmptyJoinBtnText}>Unirse a Canal</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* TARJETAS DE CANALES EXACTAS A LA IMAGEN 2 */
                filteredChannels.map((ch: Channel) => {
                  const isSelected = ch.id === selectedChannel?.id;
                  return (
                    <View
                      key={ch.id}
                      style={[
                        styles.canalesCard,
                        isSelected && styles.canalesCardSelected,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.canalesCardLeft}
                        onPress={() => handleTuneChannel(ch)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.canalesCardRadioBadge,
                            isSelected && styles.canalesCardRadioBadgeActive,
                          ]}
                        >
                          <RadioIcon size={20} color="#ffffff" strokeWidth={2.2} />
                        </View>

                        <View style={styles.canalesCardInfo}>
                          <View style={styles.canalesCardTitleRow}>
                            <Text
                              style={[
                                styles.canalesCardName,
                                isSelected && styles.canalesCardNameActive,
                              ]}
                              numberOfLines={1}
                            >
                              {ch.name}
                            </Text>
                            {isSelected && (
                              <View style={styles.canalesActivePill}>
                                <View style={styles.canalesActiveDot} />
                                <Text style={styles.canalesActivePillText}>ACTIVO</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.canalesCardMetaRow}>
                            <View style={styles.canalesCardMembers}>
                              <UsersIcon size={13} color="#64748b" strokeWidth={1.8} />
                              <Text style={styles.canalesCardMembersText}>
                                {ch.memberCount} {ch.memberCount === 1 ? 'miembro' : 'miembros'}
                              </Text>
                            </View>

                            <View style={styles.canalesCardCategoryBadge}>
                              <Text style={styles.canalesCardCategoryText}>
                                {(ch.category || 'TÁCTICO').toUpperCase()}
                              </Text>
                            </View>

                            <Text style={styles.canalesCardPinText}>
                              PIN: {ch.pin || ''}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.canalesCardRight}>
                        {/* Botón QR / Configuración */}
                        <TouchableOpacity
                          style={styles.canalesCardQrBtn}
                          onPress={() => openChannelConfig(ch)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Ver código QR y configuración del canal"
                        >
                          <QrCodeIcon size={20} color="#64748b" strokeWidth={1.8} />
                        </TouchableOpacity>

                        {/* Botón Sintonizado / Sintonizar */}
                        <TouchableOpacity
                          style={[
                            styles.canalesCardSintonizarBtn,
                            isSelected && styles.canalesCardSintonizarBtnActive,
                          ]}
                          onPress={() => handleTuneChannel(ch)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.canalesCardSintonizarText,
                              isSelected && styles.canalesCardSintonizarTextActive,
                            ]}
                          >
                            {isSelected ? 'SINTONIZADO' : 'SINTONIZAR'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
      {/* 1. MODAL: UNIRSE A CANAL (PIN O ESCÁNER QR INTEGRADO EN UN SOLO MODAL PARA COMPATIBILIDAD CON IOS) */}
      <Modal
        visible={isJoinModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          setIsJoinScanning(false);
          setIsJoinModalOpen(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.channelModalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[styles.channelModalCard, { maxHeight: viewportHeight * 0.9 }]}>
                  {/* Header */}
                  <View style={styles.channelModalHeader}>
                    <View style={styles.channelModalHeaderLeft}>
                      <View style={styles.channelModalIconBox}>
                        {isJoinScanning ? (
                          <CameraIcon size={20} color="#8a1a36" strokeWidth={2} />
                        ) : (
                          <LogInIcon size={20} color="#8a1a36" strokeWidth={2} />
                        )}
                      </View>
                      <View>
                        <Text style={styles.channelModalTitle}>
                          {isJoinScanning ? 'Escanear QR de Canal' : 'Unirse a Canal'}
                        </Text>
                        <Text style={styles.channelModalSubtitle}>
                          {isJoinScanning
                            ? 'Apunta la cámara al código QR táctico'
                            : 'Ingresa el PIN de 4 dígitos o escanea el QR'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setIsJoinScanning(false);
                        setIsJoinModalOpen(false);
                      }}
                      style={styles.channelModalCloseBtn}
                      accessibilityLabel="Cerrar ventana del grupo"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <XIcon size={18} color="#64748b" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  {isJoinScanning ? (
                    /* VISTA ESCÁNER QR (DENTRO DEL MISMO MODAL: 100% FUNCIONAL EN IOS) */
                    <ScrollView contentContainerStyle={styles.canalesScannerBody}>
                      <ChannelQrScanner onScan={handleScannedQrPayload} />
                      {joinError && <Text style={styles.recoveryErrorText}>{joinError}</Text>}
                      <TouchableOpacity
                        style={styles.channelCloseBtn}
                        onPress={() => setIsJoinScanning(false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.channelCloseBtnText}>Volver a ingresar PIN</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  ) : (
                    /* VISTA INGRESO DE PIN */
                    <ScrollView
                      style={{ maxHeight: 480 }}
                      contentContainerStyle={styles.canalesModalBody}
                      keyboardShouldPersistTaps="handled"
                    >
                      {joinError && (
                        <View style={styles.recoveryErrorBanner}>
                          <AlertTriangleIcon size={15} color="#be123c" strokeWidth={1.8} />
                          <Text style={styles.recoveryErrorText}>{joinError}</Text>
                        </View>
                      )}

                      <Text style={styles.canalesPinLabel}>PIN O NÚMERO DE ASIGNACIÓN</Text>
                      <Text style={styles.canalesPinSub}>
                        Ingresa el código numérico de 4 dígitos proporcionado por el oficial
                      </Text>

                      {/* Cajas de dígitos PIN sincronizadas (Misma estructura del Registro) */}
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => joinPinInputRef.current?.focus()}
                        style={styles.canalesTokenRow}
                      >
                        {[0, 1, 2, 3].map((idx) => {
                          const char = joinPinDigits[idx] || '';
                          const isCurrent = joinPinDigits.length === idx;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.canalesTokenBox,
                                Boolean(char) && styles.canalesTokenBoxFilled,
                                isCurrent && styles.canalesTokenBoxActive,
                              ]}
                            >
                              <Text style={styles.canalesTokenDigit}>{char}</Text>
                            </View>
                          );
                        })}
                      </TouchableOpacity>

                      {/* Input nativo oculto (sin autoFocus para no tapar la pantalla de inmediato) */}
                      <TextInput
                        accessibilityLabel="PIN para unirse al grupo"
                        ref={joinPinInputRef}
                        style={styles.hiddenInput}
                        value={joinPinDigits}
                        onChangeText={(val) => {
                          const cleaned = val.replace(/\D/g, '').slice(0, 4);
                          setJoinPinDigits(cleaned);
                          if (joinError) setJoinError(null);
                          if (cleaned.length === 4) {
                            Keyboard.dismiss();
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={4}
                        autoFocus={false}
                      />

                      {/* Botón de envío */}
                      <TouchableOpacity
                        style={[
                          styles.canalesModalSubmitBtn,
                          joinPinDigits.length !== 4 && styles.canalesModalSubmitBtnDisabled,
                        ]}
                        onPress={handleJoinChannelSubmit}
                        disabled={joinPinDigits.length !== 4 || directory.writing}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.canalesModalSubmitBtnText}>{directory.writing ? 'UNIENDO...' : 'UNIRME AL CANAL'}</Text>
                      </TouchableOpacity>

                      {/* Divisor */}
                      <View style={styles.canalesDividerRow}>
                        <View style={styles.canalesDividerLine} />
                        <Text style={styles.canalesDividerText}>O BIEN</Text>
                        <View style={styles.canalesDividerLine} />
                      </View>

                      {/* Botón para Escanear Código QR */}
                      <TouchableOpacity
                        style={styles.canalesScanQrBtn}
                        onPress={() => {
                          Keyboard.dismiss();
                          setIsJoinScanning(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <CameraIcon size={18} color="#8a1a36" strokeWidth={2} />
                        <Text style={styles.canalesScanQrBtnText}>Escanear Código QR del Canal</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 3. MODAL: CREAR CANAL TÁCTICO (SIMPLIFICADO: SOLO NOMBRE Y PIN) */}
      <Modal
        visible={isCreateModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          Keyboard.dismiss();
          setIsCreateModalOpen(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.channelModalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={[styles.channelModalCard, { maxHeight: viewportHeight * 0.9 }]}>
                  {/* Header */}
                  <View style={styles.channelModalHeader}>
                    <View style={styles.channelModalHeaderLeft}>
                      <View style={[styles.channelModalIconBox, { backgroundColor: '#8a1a36' }]}>
                        <PlusIcon size={20} color="#ffffff" strokeWidth={2.4} />
                      </View>
                      <View>
                        <Text style={styles.channelModalTitle}>Crear Canal Táctico</Text>
                        <Text style={styles.channelModalSubtitle}>
                          Crea un grupo para comunicarte con tu equipo
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        Keyboard.dismiss();
                        setIsCreateModalOpen(false);
                      }}
                      style={styles.channelModalCloseBtn}
                      accessibilityLabel="Cerrar ventana del grupo"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <XIcon size={18} color="#64748b" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    style={{ maxHeight: 420 }}
                    contentContainerStyle={styles.canalesModalBody}
                    keyboardShouldPersistTaps="handled"
                  >
                    {createChannelError && (
                      <View style={styles.recoveryErrorBanner}>
                        <AlertTriangleIcon size={15} color="#be123c" strokeWidth={1.8} />
                        <Text style={styles.recoveryErrorText}>{createChannelError}</Text>
                      </View>
                    )}

                    {/* Nombre del Canal */}
                    <View style={styles.recoveryInputGroup}>
                      <Text style={styles.recoveryInputLabel}>Nombre del Canal</Text>
                      <View style={styles.recoveryInputBox}>
                        <View style={styles.recoveryInputIconBox}>
                          <RadioIcon size={16} color="#94a3b8" />
                        </View>
                        <TextInput
                          style={styles.recoveryInput}
                          value={createChannelName}
                          onChangeText={setCreateChannelName}
                          placeholder="Ej. SECTOR PACHUCA SUR"
                          maxLength={100}
                          accessibilityLabel="Nombre del grupo"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                        />
                      </View>
                    </View>

                    {/* PIN de Acceso (4 dígitos) */}
                    <View style={styles.recoveryInputGroup}>
                      <Text style={styles.recoveryInputLabel}>PIN o Código de Acceso (4 dígitos)</Text>
                      <Text style={styles.canalesPinSub}>
                        Los oficiales usarán este PIN para sintonizarse
                      </Text>

                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => createChannelPinInputRef.current?.focus()}
                        style={styles.canalesTokenRow}
                      >
                        {[0, 1, 2, 3].map((idx) => {
                          const char = createChannelPin[idx] || '';
                          const isCurrent = createChannelPin.length === idx;
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.canalesTokenBox,
                                Boolean(char) && styles.canalesTokenBoxFilled,
                                isCurrent && styles.canalesTokenBoxActive,
                              ]}
                            >
                              <Text style={styles.canalesTokenDigit}>{char}</Text>
                            </View>
                          );
                        })}
                      </TouchableOpacity>

                      <TextInput
                        accessibilityLabel="PIN del nuevo grupo"
                        ref={createChannelPinInputRef}
                        style={styles.hiddenInput}
                        value={createChannelPin}
                        onChangeText={(val) => {
                          const cleaned = val.replace(/\D/g, '').slice(0, 4);
                          setCreateChannelPin(cleaned);
                          if (cleaned.length === 4) {
                            Keyboard.dismiss();
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={4}
                      />
                    </View>

                    {/* Botón Crear */}
                    <TouchableOpacity
                      style={styles.canalesModalSubmitBtn}
                      onPress={handleCreateChannelSubmit}
                      disabled={directory.writing}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.canalesModalSubmitBtnText}>{directory.writing ? 'GUARDANDO...' : 'CREAR Y SINTONIZAR CANAL'}</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 4. MODAL: CONFIGURACIÓN Y QR DEL CANAL (QR COMPATIBLE NATIVO + SOLO PIN) */}
      <Modal
        visible={isConfigModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsConfigModalOpen(false)}
      >
        <View style={styles.channelModalOverlay}>
          <View style={[styles.channelModalCard, { maxHeight: viewportHeight * 0.9 }]}>
            {/* Header */}
            <View style={styles.channelModalHeader}>
              <View style={styles.channelModalHeaderLeft}>
                <View style={styles.channelModalIconBox}>
                  <RadioIcon size={20} color="#8a1a36" strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.channelModalTitle}>Configuración del Canal</Text>
                  <Text style={styles.channelModalSubtitle} numberOfLines={1}>
                    {configChannel?.name || 'Canal Táctico'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsConfigModalOpen(false)}
                accessibilityLabel="Cerrar configuración del grupo"
                style={styles.channelModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <XIcon size={18} color="#64748b" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.canalesModalBody}>
              {configError && <Text style={styles.recoveryErrorText}>{configError}</Text>}
              {/* Contenedor del Código QR (Matriz pura en Views para iPhone y Web) */}
              <View style={styles.canalesQrBox}>
                {configQrMatrix.length > 0 ? (
                  <View style={styles.canalesQrMatrixBox}>
                    {configQrMatrix.map((row, rIdx) => (
                      <View key={rIdx} style={{ flexDirection: 'row' }}>
                        {row.map((dark, cIdx) => (
                          <View
                            key={cIdx}
                            style={{
                              width: Math.max(5, Math.floor(180 / configQrMatrix.length)),
                              height: Math.max(5, Math.floor(180 / configQrMatrix.length)),
                              backgroundColor: dark ? '#0f172a' : '#ffffff',
                            }}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                ) : configQrUrl ? (
                  <Image
                    source={{ uri: configQrUrl }}
                    style={styles.canalesQrImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.canalesQrPlaceholder}>
                    <QrCodeIcon size={64} color="#94a3b8" />
                    <Text style={styles.canalesQrPlaceholderText}>Generando QR...</Text>
                  </View>
                )}
              </View>

              {/* Debajo del QR: PIN de Asignación en Grande (Sin código ni frecuencia) */}
              <View style={styles.canalesQrCodeInfo}>
                <Text style={styles.canalesQrCodeLabel}>PIN DE ASIGNACIÓN</Text>
                <Text style={styles.canalesQrPinBig}>
                  {configChannel?.pin || ''}
                </Text>
              </View>

              {/* Botón para Copiar ÚNICAMENTE el PIN del Canal */}
              <TouchableOpacity
                style={styles.canalesCopyBtn}
                onPress={() => copyToClipboard(configChannel?.pin || '')}
                activeOpacity={0.75}
              >
                <CopyIcon size={16} color={hasCopiedPin ? '#059669' : '#8a1a36'} />
                <Text
                  style={[
                    styles.canalesCopyBtnText,
                    hasCopiedPin && { color: '#059669' },
                  ]}
                >
                  {hasCopiedPin ? '¡PIN Copiado al Portapapeles!' : 'Copiar PIN del Canal'}
                </Text>
              </TouchableOpacity>

              {/* Acciones del Canal: Sintonizar, Salir del Grupo y Eliminar Grupo */}
              <View style={styles.canalesModalActionsStack}>
                <TouchableOpacity
                  style={styles.canalesModalSubmitBtn}
                  onPress={() => {
                    if (configChannel) {
                      setIsConfigModalOpen(false);
                      handleTuneChannel(configChannel);
                    }
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.canalesModalSubmitBtnText}>SINTONIZAR ESTE CANAL</Text>
                </TouchableOpacity>

                {/* Fila con los dos botones solicitados: Salir del Grupo y Eliminar Grupo */}
                <View style={styles.canalesDangerRow}>
                  <TouchableOpacity
                    style={styles.canalesLeaveBtn}
                    disabled={directory.writing}
                    onPress={() => {
                      if (configChannel) {
                        handleLeaveChannel(configChannel);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <LogOutIcon size={15} color="#b45309" strokeWidth={2.2} />
                    <Text style={styles.canalesLeaveBtnText}>Salir del Grupo</Text>
                  </TouchableOpacity>

                  {configChannel?.isOwner && <TouchableOpacity
                    style={styles.canalesDeleteBtn}
                    disabled={directory.writing}
                    onPress={() => {
                      if (configChannel) {
                        handleDeleteChannel(configChannel);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <TrashIcon size={15} color="#e11d48" strokeWidth={2.2} />
                    <Text style={styles.canalesDeleteBtnText}>Eliminar Grupo</Text>
                  </TouchableOpacity>}
                </View>


              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 5. MODAL DE ÉXITO TÁCTICO AL DETECTAR QR O ENLAZAR CANAL (DISEÑO ARMONIOSO C5i) */}
      <Modal
        visible={scanSuccessModal.isOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setScanSuccessModal((prev) => ({ ...prev, isOpen: false }))}
      >
        <View style={styles.channelModalOverlay}>
          <View style={styles.scanSuccessCard}>
            {/* Glow ambient de fondo con tono vino */}
            <View style={styles.scanSuccessGlow} />

            {/* Ícono de confirmación dinámico según la acción */}
            <View
              style={[
                styles.scanSuccessIconBox,
                scanSuccessModal.source === 'leave' && {
                  backgroundColor: '#fffbeb',
                  borderColor: '#fde68a',
                  shadowColor: '#d97706',
                },
                scanSuccessModal.source === 'delete' && {
                  backgroundColor: '#fef2f2',
                  borderColor: '#fecdd3',
                  shadowColor: '#e11d48',
                },
              ]}
            >
              {scanSuccessModal.source === 'leave' ? (
                <LogOutIcon size={30} color="#d97706" strokeWidth={2.2} />
              ) : scanSuccessModal.source === 'delete' ? (
                <TrashIcon size={30} color="#e11d48" strokeWidth={2.2} />
              ) : (
                <CheckCircleIcon size={34} color="#059669" strokeWidth={2.5} />
              )}
            </View>

            <Text style={styles.scanSuccessTitle}>
              {scanSuccessModal.customTitle ||
                (scanSuccessModal.source === 'qr'
                  ? 'Código QR Detectado'
                  : scanSuccessModal.source === 'pin'
                  ? 'Canal Enlazado'
                  : scanSuccessModal.source === 'leave'
                  ? 'Has Salido del Grupo'
                  : scanSuccessModal.source === 'delete'
                  ? 'Canal Eliminado'
                  : scanSuccessModal.source === 'create'
                  ? 'Canal Creado'
                  : 'Canal Sintonizado')}
            </Text>
            <Text style={styles.scanSuccessSubtitle}>
              {scanSuccessModal.customSubtitle ||
                (scanSuccessModal.source === 'qr'
                  ? 'Canal reconocido y autenticado con éxito en la red táctica C5i.'
                  : scanSuccessModal.source === 'pin'
                  ? 'Te has unido exitosamente al canal táctico en la red C5i.'
                  : scanSuccessModal.source === 'leave'
                  ? 'Te has desconectado de este canal táctico.'
                  : scanSuccessModal.source === 'delete'
                  ? 'El canal táctico ha sido removido de la red C5i.'
                  : `Radio enlazado a ${scanSuccessModal.channel?.name || 'Canal'}.`)}
            </Text>

            {/* Tarjeta con los datos del canal y colorimetría C5i */}
            {scanSuccessModal.channel && (
              <View style={styles.scanSuccessChannelBox}>
                <View style={styles.scanSuccessRadioBadge}>
                  <RadioIcon size={20} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scanSuccessChannelName} numberOfLines={1}>
                    {scanSuccessModal.channel.name}
                  </Text>
                  <View style={styles.scanSuccessMetaRow}>
                    <View style={styles.scanSuccessPinPill}>
                      <Text style={styles.scanSuccessPinText}>
                        PIN: {scanSuccessModal.channel.pin || ''}
                      </Text>
                    </View>
                    <Text style={styles.scanSuccessFreqText}>
                      {scanSuccessModal.channel.frequency}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Botón de acción con estilo vino institucional */}
            <TouchableOpacity
              style={styles.scanSuccessActionBtn}
              onPress={() => {
                setScanSuccessModal((prev) => ({ ...prev, isOpen: false }));
                if (
                  scanSuccessModal.source === 'tune' ||
                  scanSuccessModal.source === 'qr' ||
                  scanSuccessModal.source === 'pin' ||
                  scanSuccessModal.source === 'create'
                ) {
                  onOpenPtt();
                }
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.scanSuccessActionBtnText}>
                {scanSuccessModal.source === 'leave' || scanSuccessModal.source === 'delete'
                  ? 'ENTENDIDO'
                  : 'COMENZAR A TRANSMITIR'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

  </>;
}
