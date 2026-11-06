import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Modal, SafeAreaView, ActivityIndicator, Platform, Clipboard, Linking } from 'react-native';
import { UserIcon, UsersIcon, UserPlusIcon, AlertTriangleIcon, SearchIcon, XIcon, CheckIcon, PhoneIcon, MailIcon, ArrowLeftIcon, MicIcon, MessageSquareIcon, CopyIcon, ShieldIcon, TrashIcon, VideoIcon } from '../icons';
import type { DirectoryContact as ContactOfficer } from '../../services/contactsApi';
import type { ContactsDirectory } from './useContactsDirectory';
import { useNativeFeedback } from '../components/NativeFeedback';

export interface ContactsScreenHandle { openCreate(): void; }
interface Props {
  visible: boolean;
  serverUrl: string;
  directory: ContactsDirectory;
  onSos(): void;
  onStartChat(contact: ContactOfficer): void;
  onContactUpdated(contact: ContactOfficer): void;
  onOpenCamera(): void;
}

export const ContactsScreen = forwardRef<ContactsScreenHandle, Props>(function ContactsScreen(
  { visible, serverUrl, directory, onSos: handleTriggerSos, onStartChat, onContactUpdated, onOpenCamera }, ref
) {
  const officersList = directory.contacts;
  const contactsError = directory.error;
  const isLoadingContacts = directory.loading;
  const serverRef = useRef(serverUrl);
  serverRef.current = serverUrl;
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const { showTacticalAlert, showTacticalToast, closeAlert, feedback } = useNativeFeedback(isDeletingContact);
  // Modal: Registrar Nuevo Contacto
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [addContactError, setAddContactError] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Modal: Detalle de Contacto / Perfil (Diseño exacto Imagen Captura 11.27.13)
  const [selectedContactForDetail, setSelectedContactForDetail] = useState<ContactOfficer | null>(null);
  const [isContactDetailModalOpen, setIsContactDetailModalOpen] = useState(false);
  const [copiedDetailField, setCopiedDetailField] = useState<string | null>(null);

  // Modal: Editar Contacto (CRUD)
  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState(false);
  const [editContactName, setEditContactName] = useState('');
  const [editContactLastName, setEditContactLastName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactCallsign, setEditContactCallsign] = useState('');
  const [editContactError, setEditContactError] = useState<string | null>(null);
  const [isSavingEditContact, setIsSavingEditContact] = useState(false);


  useImperativeHandle(ref, () => ({ openCreate() { setAddContactError(null); setIsAddContactModalOpen(true); } }), []);
  useEffect(() => {
    setIsAddContactModalOpen(false);
    setIsEditContactModalOpen(false);
    setIsContactDetailModalOpen(false);
    setSelectedContactForDetail(null);
  }, [serverUrl]);
  const filteredOfficers = useMemo(() => officersList.filter(contact => {
    const query = contactSearchQuery.trim().toLowerCase();
    return !query || [contact.name, contact.callsign, contact.phone_number, contact.email, contact.unit]
      .some(value => value?.toLowerCase().includes(query));
  }), [officersList, contactSearchQuery]);
  // Agrupación alfabética de contactos por letra (ej. A -> Alex, V -> Valeria)
  const groupedOfficers = useMemo(() => {
    const map = new Map<string, ContactOfficer[]>();
    const sorted = [...filteredOfficers].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );

    for (const officer of sorted) {
      const trimmed = officer.name.trim();
      const firstChar = trimmed ? trimmed[0].toUpperCase() : '#';
      const letter = /^[A-ZÁÉÍÓÚÑ]$/.test(firstChar) ? firstChar : '#';
      if (!map.has(letter)) {
        map.set(letter, []);
      }
      map.get(letter)!.push(officer);
    }

    const sortedLetters = Array.from(map.keys()).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b, 'es');
    });

    return sortedLetters.map((letter) => ({
      letter,
      contacts: map.get(letter)!,
    }));
  }, [filteredOfficers]);

  const handleSaveContactSubmit = async () => {
    if (directory.isMutating()) return;
    setIsSavingContact(true);
    setAddContactError(null);
    const base = serverUrl;
    try {
      const saved = await directory.create({
        name: [newContactName.trim(), newContactLastName.trim()].filter(Boolean).join(' '),
        phone_number: newContactPhone, email: newContactEmail,
      });
      if (base !== serverRef.current) return;
      setIsAddContactModalOpen(false);
      setNewContactName(''); setNewContactLastName(''); setNewContactPhone(''); setNewContactEmail('');
      showTacticalToast(`Contacto "${saved.name}" guardado en la BD`, 'success');
    } catch (error) {
      if (base === serverRef.current) setAddContactError(error instanceof Error ? error.message : 'No se pudo guardar el contacto.');
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleOpenContactDetail = (contact: ContactOfficer) => {
    setSelectedContactForDetail(contact);
    setCopiedDetailField(null);
    setIsContactDetailModalOpen(true);
  };

  const handleOpenEditContact = (contact: ContactOfficer) => {
    const parts = contact.name.trim().split(' ');
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ');
    setEditContactName(first);
    setEditContactLastName(last);
    setEditContactPhone(contact.phone_number || '');
    setEditContactEmail(contact.email || '');
    setEditContactCallsign(contact.callsign || '');
    setEditContactError(null);
    setIsContactDetailModalOpen(false);
    setIsEditContactModalOpen(true);
  };

  const handleSaveEditContactSubmit = async () => {
    if (!selectedContactForDetail || directory.isMutating()) return;
    const contact = selectedContactForDetail;
    const base = serverUrl;
    setIsSavingEditContact(true);
    setEditContactError(null);
    try {
      const saved = await directory.update(contact.id, {
        name: [editContactName.trim(), editContactLastName.trim()].filter(Boolean).join(' '),
        phone_number: editContactPhone, email: editContactEmail,
        callsign: editContactCallsign.trim().toUpperCase(), unit: contact.unit,
      });
      if (base !== serverRef.current) return;
      setSelectedContactForDetail(saved);
      onContactUpdated(saved);
      setIsEditContactModalOpen(false);
      setIsContactDetailModalOpen(true);
      showTacticalToast(`Contacto "${saved.name}" actualizado en la BD`, 'success');
    } catch (error) {
      if (base === serverRef.current) setEditContactError(error instanceof Error ? error.message : 'No se pudo actualizar el contacto.');
    } finally {
      setIsSavingEditContact(false);
    }
  };

  const handleDeleteContact = (contact: ContactOfficer) => {
    if (!contact || directory.isMutating()) return;
    const base = serverUrl;
    const executeDelete = async () => {
      if (directory.isMutating() || base !== serverRef.current) return;
      setIsDeletingContact(true);
      try {
        await directory.remove(contact.id);
        if (base !== serverRef.current) return;
        setIsContactDetailModalOpen(false);
        setIsEditContactModalOpen(false);
        setSelectedContactForDetail(null);
        closeAlert();
        showTacticalToast(`Contacto "${contact.name}" eliminado de la BD`, 'success');
      } catch (error) {
        if (base === serverRef.current) showTacticalAlert('No se pudo eliminar el contacto',
          error instanceof Error ? error.message : 'Verifica la conexión e inténtalo de nuevo.', { type: 'warning' });
      } finally {
        setIsDeletingContact(false);
      }
    };
    showTacticalAlert('¿Eliminar Contacto C5i?',
      `Se eliminará a "${contact.name}" del directorio de contactos.`, {
        type: 'confirm_delete', confirmText: 'Eliminar Contacto', cancelText: 'Cancelar', onConfirm: executeDelete,
      });
  };

  return (<>
        {visible && (
          <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            {/* Header exacto a Imagen 1 */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: '#ffffff',
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
            }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: '#fdf2f4',
                borderWidth: 1,
                borderColor: '#fecdd3',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <UsersIcon size={22} color="#8a1a36" strokeWidth={2.2} />
              </View>

              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: '#0f172a',
                marginLeft: 14,
                flex: 1,
              }}>
                Contactos
              </Text>

              {/* Botón SOS Rojo */}
              <TouchableOpacity
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: '#dc2626',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  shadowColor: '#dc2626',
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                onPress={handleTriggerSos}
                activeOpacity={0.8}
              >
                <AlertTriangleIcon size={20} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Botón Agregar Contacto Granate */}
              <TouchableOpacity
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: '#6b1d2f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6b1d2f',
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                onPress={() => {
                  setAddContactError(null);
                  setIsAddContactModalOpen(true);
                }}
                activeOpacity={0.8}
              >
                <UserPlusIcon size={20} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Barra de Búsqueda de Contactos */}
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: '#ffffff',
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 44,
              }}>
                <SearchIcon size={18} color="#94a3b8" strokeWidth={2} />
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: 10,
                    fontSize: 14,
                    color: '#0f172a',
                    paddingVertical: 0,
                  }}
                  value={contactSearchQuery}
                  onChangeText={setContactSearchQuery}
                  placeholder="Buscar por nombre, indicativo, teléfono o correo..."
                  placeholderTextColor="#94a3b8"
                />
                {contactSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setContactSearchQuery('')}>
                    <XIcon size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: contactsError ? '#fff1f2' : '#ffffff' }}>
              <Text accessibilityLiveRegion="polite" style={{ color: contactsError ? '#be123c' : '#64748b', fontSize: 13 }}>
                {contactsError || (isLoadingContacts ? 'Consultando contactos…' : `${officersList.length} contactos en la BD`)}
              </Text>
              <TouchableOpacity accessibilityLabel="Actualizar contactos" onPress={() => directory.refresh()}
                disabled={isLoadingContacts || isSavingContact || isSavingEditContact || isDeletingContact}>
                <Text style={{ color: '#6b1d2f', fontWeight: '700', paddingVertical: 8 }}>Actualizar contactos</Text>
              </TouchableOpacity>
            </View>

            {/* Lista de Contactos Tácticos C5i: Dividido solo por una línea entre uno y otro, división por letra, solo nombre */}
            <ScrollView
              style={{ flex: 1, backgroundColor: '#ffffff' }}
              contentContainerStyle={{ paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
            >
              {filteredOfficers.length === 0 ? (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 60,
                  paddingHorizontal: 20,
                }}>
                  <View style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: '#f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    <UserIcon size={36} color="#94a3b8" strokeWidth={1.8} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 6 }}>
                    {isLoadingContacts ? 'Cargando contactos…' : contactsError ? 'No se pudo actualizar el directorio' : contactSearchQuery ? 'Sin coincidencias' : 'Sin contactos registrados'}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20, maxWidth: 280 }}>
                    Agrega a tu primer oficial o contacto para iniciar una conversación encriptada.
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#6b1d2f',
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 12,
                      gap: 8,
                    }}
                    onPress={() => {
                      setAddContactError(null);
                      setIsAddContactModalOpen(true);
                    }}
                  >
                    <UserPlusIcon size={18} color="#ffffff" strokeWidth={2.2} />
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
                      + Agregar Contacto
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                groupedOfficers.map((group) => (
                  <View key={group.letter}>
                    {/* División por letra (ej. A, V) */}
                    <View style={{
                      backgroundColor: '#f8fafc',
                      paddingHorizontal: 20,
                      paddingVertical: 8,
                      borderTopWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: '#f1f5f9',
                    }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: '800',
                        color: '#6b1d2f',
                        letterSpacing: 0.5,
                      }}>
                        {group.letter}
                      </Text>
                    </View>

                    {/* Contactos bajo esta letra: solo el nombre, divididos por una sola línea */}
                    {group.contacts.map((cnt, idx) => (
                      <React.Fragment key={cnt.id}>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 16,
                            backgroundColor: '#ffffff',
                          }}
                          onPress={() => handleOpenContactDetail(cnt)}
                          activeOpacity={0.6}
                        >
                          <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: '#0f172a',
                          }}>
                            {cnt.name}
                          </Text>
                        </TouchableOpacity>

                        {/* Línea divisoria simple entre uno y otro */}
                        {idx < group.contacts.length - 1 && (
                          <View style={{ height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 20 }} />
                        )}
                      </React.Fragment>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}

      {/* 7. MODAL: REGISTRAR NUEVO CONTACTO (Diseño exacto a Imagen 2) */}
      {isAddContactModalOpen && (
      <Modal
        visible={isAddContactModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (isSavingContact) return;
          setIsAddContactModalOpen(false);
          setAddContactError(null);
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}>
          {/* Backdrop que cierra al tocar fuera sin interceptar clics dentro de la tarjeta */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (isSavingContact) return;
              setIsAddContactModalOpen(false);
              setAddContactError(null);
            }}
          />

          <View style={{
            backgroundColor: '#ffffff',
            borderRadius: 28,
            width: '100%',
            maxWidth: 420,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 24,
            shadowColor: '#000000',
            shadowOpacity: 0.15,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}>
            {/* Header con dos circulitos para Cancelar y Guardar */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
            }}>
              {/* Botón Circular Izquierdo: Cancelar */}
              <TouchableOpacity
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: '#e2e8f0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  if (isSavingContact) return;
                  setIsAddContactModalOpen(false);
                  setAddContactError(null);
                }}
                activeOpacity={0.8}
              >
                <XIcon size={18} color="#475569" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Título Central */}
              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: '#0f172a',
                textAlign: 'center',
              }}>
                Nuevo Contacto
              </Text>

              {/* Botón Circular Derecho: Guardar */}
              <TouchableOpacity
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: '#6b1d2f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6b1d2f',
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                accessibilityLabel="Guardar contacto"
                disabled={isSavingContact}
                onPress={handleSaveContactSubmit}
                activeOpacity={0.8}
              >
                {isSavingContact ? <ActivityIndicator color="#ffffff" size="small" /> : <CheckIcon size={18} color="#ffffff" strokeWidth={2.6} />}
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 460 }}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 6 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Círculo con Icono de Persona (sin agregar foto, solo persona) */}
              <View style={{
                alignSelf: 'center',
                width: 86,
                height: 86,
                borderRadius: 43,
                backgroundColor: '#f8fafc',
                borderWidth: 2,
                borderColor: '#fbcfe8',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                <UserIcon size={42} color="#94a3b8" strokeWidth={1.8} />
              </View>

              {addContactError && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#ffe4e6',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  marginBottom: 14,
                  gap: 8,
                }}>
                  <AlertTriangleIcon size={16} color="#be123c" strokeWidth={2} />
                  <Text style={{ color: '#be123c', fontSize: 13, fontWeight: '600', flex: 1 }}>
                    {addContactError}
                  </Text>
                </View>
              )}

              {/* Tarjeta 1: Nombre(s) y Apellidos (Opcional) */}
              <View style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginBottom: 14,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Nombre(s) *
                </Text>
                <TextInput
                  editable={!isSavingContact}
                  style={{
                    fontSize: 15,
                    color: '#0f172a',
                    paddingVertical: 4,
                  }}
                  value={newContactName}
                  onChangeText={setNewContactName}
                  placeholder="Ej. Juan Carlos"
                  placeholderTextColor="#94a3b8"
                />

                <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />

                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Apellidos (Opcional)
                </Text>
                <TextInput
                  editable={!isSavingContact}
                  style={{
                    fontSize: 15,
                    color: '#0f172a',
                    paddingVertical: 4,
                  }}
                  value={newContactLastName}
                  onChangeText={setNewContactLastName}
                  placeholder="Ej. Perez Hernandez"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Tarjeta 2: Número de Teléfono (directo sin selector de país) */}
              <View style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginBottom: 14,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Número de Teléfono
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                  editable={!isSavingContact}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: '#0f172a',
                      paddingVertical: 4,
                    }}
                    value={newContactPhone}
                    onChangeText={setNewContactPhone}
                    placeholder="771 123 4567"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                  />
                  <PhoneIcon size={18} color="#94a3b8" strokeWidth={1.8} />
                </View>
              </View>

              {/* Tarjeta 3: Correo Electrónico (Opcional) */}
              <View style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginBottom: 8,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Correo Electrónico (Opcional)
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                  editable={!isSavingContact}
                    style={{
                      flex: 1,
                      fontSize: 15,
                      color: '#0f172a',
                      paddingVertical: 4,
                    }}
                    value={newContactEmail}
                    onChangeText={setNewContactEmail}
                    placeholder="ejemplo@c5i.gob.mx"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <MailIcon size={18} color="#94a3b8" strokeWidth={1.8} />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}

      {/* 7b. MODAL: DETALLE DE CONTACTO / PERFIL (Diseño exacto a Imagen Captura 11.27.13) */}
      {isContactDetailModalOpen && !!selectedContactForDetail && (
      <Modal
        visible={isContactDetailModalOpen && !!selectedContactForDetail}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsContactDetailModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          {/* Barra Superior con botón circular <, SOS y botón Editar */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#f1f5f9',
          }}>
            {/* Botón Circular Izquierdo: Volver atrás */}
            <TouchableOpacity
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => setIsContactDetailModalOpen(false)}
              activeOpacity={0.7}
            >
              <ArrowLeftIcon size={20} color="#334155" strokeWidth={2.2} />
            </TouchableOpacity>

            {/* Botones Derecha: SOS y Editar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* Botón SOS Pill Rojo */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#ef4444',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  gap: 4,
                  shadowColor: '#ef4444',
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                onPress={handleTriggerSos}
                activeOpacity={0.8}
              >
                <AlertTriangleIcon size={16} color="#ffffff" strokeWidth={2.4} />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>
                  SOS
                </Text>
              </TouchableOpacity>

              {/* Botón Editar Pill Granate */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#6b1d2f',
                  paddingHorizontal: 18,
                  paddingVertical: 7,
                  borderRadius: 20,
                  shadowColor: '#6b1d2f',
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                onPress={() => {
                  if (selectedContactForDetail) {
                    handleOpenEditContact(selectedContactForDetail);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
                  Editar
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar Central Grande con Inicial */}
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: '#e0f2fe',
                borderWidth: 2.5,
                borderColor: '#fbcfe8',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000000',
                shadowOpacity: 0.08,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 3,
              }}>
                <Text style={{
                  fontSize: 44,
                  fontWeight: '800',
                  color: '#6b1d2f',
                }}>
                  {(selectedContactForDetail?.name.trim()[0] || 'K').toUpperCase()}
                </Text>
              </View>

              {/* Nombre del Contacto */}
              <Text style={{
                fontSize: 22,
                fontWeight: '800',
                color: '#0f172a',
                marginTop: 12,
                textAlign: 'center',
              }}>
                {selectedContactForDetail?.name}
              </Text>

              {/* Indicativo de Radio Pill */}
              <View style={{
                backgroundColor: '#f1f5f9',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 12,
                marginTop: 6,
              }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#7a1c30',
                  letterSpacing: 0.5,
                }}>
                  {selectedContactForDetail?.callsign || 'RADIO-654'}
                </Text>
              </View>
            </View>

            {/* 4 Botones Circulares de Acción Rápida Granate */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              marginVertical: 18,
            }}>
              {/* 1. Chat */}
              <TouchableOpacity
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: '#6b1d2f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6b1d2f',
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 3,
                }}
                onPress={() => {
                  if (selectedContactForDetail) {
                    setIsContactDetailModalOpen(false);
                    onStartChat(selectedContactForDetail);
                  }
                }}
                activeOpacity={0.8}
              >
                <MessageSquareIcon size={22} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* 2. Llamada */}
              <TouchableOpacity
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: '#6b1d2f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6b1d2f',
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 3,
                }}
                onPress={() => {
                  if (selectedContactForDetail?.phone_number) {
                    if (Platform.OS === 'web') {
                      window.open(`tel:${selectedContactForDetail.phone_number}`);
                    } else {
                      Linking.openURL(`tel:${selectedContactForDetail.phone_number}`).catch(() => {});
                    }
                  } else {
                    showTacticalAlert('Llamada Telefónica', 'Este oficial o contacto no tiene un número celular registrado en la red C5i.', { type: 'warning' });
                  }
                }}
                activeOpacity={0.8}
              >
                <PhoneIcon size={22} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* 3. Video */}
              <TouchableOpacity
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: '#6b1d2f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6b1d2f',
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 3,
                }}
                onPress={() => {
                  setIsContactDetailModalOpen(false);
                  if (selectedContactForDetail) {
                    onStartChat(selectedContactForDetail);
                  }
                  onOpenCamera();
                }}
                activeOpacity={0.8}
              >
                <VideoIcon size={22} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* 4. Correo */}
              <TouchableOpacity
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: '#6b1d2f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6b1d2f',
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                  elevation: 3,
                }}
                onPress={() => {
                  if (selectedContactForDetail?.email) {
                    if (Platform.OS === 'web') {
                      window.open(`mailto:${selectedContactForDetail.email}`);
                    } else {
                      Linking.openURL(`mailto:${selectedContactForDetail.email}`).catch(() => {});
                    }
                  } else {
                    showTacticalAlert('Correo Institucional', 'Este oficial o contacto no tiene un correo institucional registrado.', { type: 'warning' });
                  }
                }}
                activeOpacity={0.8}
              >
                <MailIcon size={22} color="#ffffff" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* 4 Tarjetas de Información */}

            {/* Tarjeta 1: móvil (red celular) */}
            <View style={{
              backgroundColor: '#ffffff',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 12,
              shadowColor: '#000000',
              shadowOpacity: 0.03,
              shadowRadius: 4,
              elevation: 1,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#8a1a36',
                marginBottom: 4,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              }}>
                móvil (red celular)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
                  {selectedContactForDetail?.phone_number || 'Sin número registrado'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {/* Copiar */}
                  <TouchableOpacity
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#f8fafc',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => {
                      if (selectedContactForDetail?.phone_number) {
                        Clipboard.setString(selectedContactForDetail.phone_number);
                        setCopiedDetailField('phone');
                        setTimeout(() => setCopiedDetailField(null), 2000);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {copiedDetailField === 'phone' ? (
                      <CheckIcon size={16} color="#16a34a" strokeWidth={2.4} />
                    ) : (
                      <CopyIcon size={16} color="#64748b" strokeWidth={2} />
                    )}
                  </TouchableOpacity>

                  {/* Llamar */}
                  <TouchableOpacity
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#fdf2f4',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => {
                      if (selectedContactForDetail?.phone_number) {
                        if (Platform.OS === 'web') {
                          window.open(`tel:${selectedContactForDetail.phone_number}`);
                        } else {
                          Linking.openURL(`tel:${selectedContactForDetail.phone_number}`).catch(() => {});
                        }
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <PhoneIcon size={16} color="#8a1a36" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Tarjeta 2: correo institucional */}
            <View style={{
              backgroundColor: '#ffffff',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 12,
              shadowColor: '#000000',
              shadowOpacity: 0.03,
              shadowRadius: 4,
              elevation: 1,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#8a1a36',
                marginBottom: 4,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              }}>
                correo institucional
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: selectedContactForDetail?.email ? '#0f172a' : '#94a3b8',
                  flex: 1,
                  marginRight: 8,
                }}>
                  {selectedContactForDetail?.email || 'Sin correo registrado'}
                </Text>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#fdf2f4',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <MailIcon size={16} color="#8a1a36" strokeWidth={2} />
                </View>
              </View>
            </View>

            {/* Tarjeta 3: indicativo de radio (callsign) */}
            <View style={{
              backgroundColor: '#ffffff',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 12,
              shadowColor: '#000000',
              shadowOpacity: 0.03,
              shadowRadius: 4,
              elevation: 1,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#8a1a36',
                marginBottom: 4,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              }}>
                indicativo de radio (callsign)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>
                  {selectedContactForDetail?.callsign || 'RADIO-654'}
                </Text>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#fdf2f4',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ShieldIcon size={16} color="#8a1a36" strokeWidth={2} />
                </View>
              </View>
            </View>

            {/* Botón Eliminar Contacto con estilo C5i */}
            {selectedContactForDetail && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#fef2f2',
                  borderWidth: 1,
                  borderColor: '#fecdd3',
                  paddingVertical: 13,
                  borderRadius: 16,
                  gap: 8,
                  marginTop: 10,
                }}
                onPress={() => handleDeleteContact(selectedContactForDetail)}
                activeOpacity={0.8}
              >
                <TrashIcon size={18} color="#dc2626" strokeWidth={2.2} />
                <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 14 }}>
                  Eliminar Contacto
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      )}

      {/* 7c. MODAL: EDITAR CONTACTO (CRUD CON BASE DE DATOS C5i) */}
      {isEditContactModalOpen && (
      <Modal
        visible={isEditContactModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          if (isSavingEditContact) return;
          setIsEditContactModalOpen(false);
          setIsContactDetailModalOpen(true);
          setEditContactError(null);
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}>
          {/* Backdrop que cierra al tocar fuera */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (isSavingEditContact) return;
              setIsEditContactModalOpen(false);
              setIsContactDetailModalOpen(true);
              setEditContactError(null);
            }}
          />

          <View style={{
            backgroundColor: '#ffffff',
            borderRadius: 28,
            width: '100%',
            maxWidth: 420,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 24,
            shadowColor: '#000000',
            shadowOpacity: 0.15,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}>
            {/* Header con botón Cancelar y Guardar */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#f1f5f9',
            }}>
              <TouchableOpacity
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: '#e2e8f0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  if (isSavingEditContact) return;
                  setIsEditContactModalOpen(false);
                  setIsContactDetailModalOpen(true);
                  setEditContactError(null);
                }}
                activeOpacity={0.8}
              >
                <XIcon size={18} color="#475569" strokeWidth={2.2} />
              </TouchableOpacity>

              <Text style={{
                fontSize: 18,
                fontWeight: '700',
                color: '#0f172a',
                textAlign: 'center',
              }}>
                Editar Contacto
              </Text>

              <TouchableOpacity
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: '#6b1d2f',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#6b1d2f',
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                accessibilityLabel="Guardar contacto"
                disabled={isSavingEditContact}
                onPress={handleSaveEditContactSubmit}
                activeOpacity={0.8}
              >
                {isSavingEditContact ? <ActivityIndicator color="#ffffff" size="small" /> : <CheckIcon size={18} color="#ffffff" strokeWidth={2.6} />}
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 460 }}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 6 }}
              keyboardShouldPersistTaps="handled"
            >
              {editContactError && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#ffe4e6',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  marginBottom: 14,
                  gap: 8,
                }}>
                  <AlertTriangleIcon size={16} color="#be123c" strokeWidth={2} />
                  <Text style={{ color: '#be123c', fontSize: 13, fontWeight: '600', flex: 1 }}>
                    {editContactError}
                  </Text>
                </View>
              )}

              {/* Nombre y Apellidos */}
              <View style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginBottom: 14,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Nombre(s) *
                </Text>
                <TextInput
                  editable={!isSavingEditContact}
                  style={{ fontSize: 15, color: '#0f172a', paddingVertical: 4 }}
                  value={editContactName}
                  onChangeText={setEditContactName}
                  placeholder="Ej. Juan Carlos"
                  placeholderTextColor="#94a3b8"
                />

                <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 }} />

                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Apellidos (Opcional)
                </Text>
                <TextInput
                  editable={!isSavingEditContact}
                  style={{ fontSize: 15, color: '#0f172a', paddingVertical: 4 }}
                  value={editContactLastName}
                  onChangeText={setEditContactLastName}
                  placeholder="Ej. Perez Hernandez"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* Teléfono */}
              <View style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginBottom: 14,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Número de Teléfono
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                  editable={!isSavingEditContact}
                    style={{ flex: 1, fontSize: 15, color: '#0f172a', paddingVertical: 4 }}
                    value={editContactPhone}
                    onChangeText={(text) => {
                      setEditContactPhone(text);
                      const digits = text.replace(/\D/g, '');
                      if (digits.length >= 4) {
                        setEditContactCallsign(`RADIO-${digits.slice(-4)}`);
                      } else if (digits.length > 0) {
                        setEditContactCallsign(`RADIO-${digits.padStart(4, '0')}`);
                      }
                    }}
                    placeholder="771 123 4567"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                  />
                  <PhoneIcon size={18} color="#94a3b8" strokeWidth={1.8} />
                </View>
              </View>

              {/* Correo */}
              <View style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginBottom: 14,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Correo Electrónico (Opcional)
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                  editable={!isSavingEditContact}
                    style={{ flex: 1, fontSize: 15, color: '#0f172a', paddingVertical: 4 }}
                    value={editContactEmail}
                    onChangeText={setEditContactEmail}
                    placeholder="ejemplo@c5i.gob.mx"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <MailIcon size={18} color="#94a3b8" strokeWidth={1.8} />
                </View>
              </View>

              {/* Indicativo de Radio */}
              <View style={{
                backgroundColor: '#ffffff',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                paddingHorizontal: 16,
                paddingVertical: 10,
                marginBottom: 18,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 2 }}>
                  Indicativo de Radio (Callsign)
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                  editable={!isSavingEditContact}
                    style={{ flex: 1, fontSize: 15, color: '#0f172a', paddingVertical: 4 }}
                    value={editContactCallsign}
                    onChangeText={setEditContactCallsign}
                    placeholder="RADIO-654"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                  />
                  <ShieldIcon size={18} color="#94a3b8" strokeWidth={1.8} />
                </View>
              </View>

              {/* Botón Eliminar Contacto (CRUD Delete) */}
              {selectedContactForDetail && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#fef2f2',
                    borderWidth: 1,
                    borderColor: '#fecdd3',
                    paddingVertical: 12,
                    borderRadius: 14,
                    gap: 8,
                    marginTop: 6,
                  }}
                  onPress={() => handleDeleteContact(selectedContactForDetail)}
                  activeOpacity={0.8}
                >
                  <TrashIcon size={18} color="#dc2626" strokeWidth={2} />
                  <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 14 }}>
                    Eliminar Contacto
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}

{feedback}
  </>);
});
