import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contact } from '../types';
import { useTheme } from '../context/ThemeContext';
import { User, Phone, Plus, X, Search, Radio } from 'lucide-react-native';

export function ContactsScreen({ navigation }: any) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [phone, setPhone] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { colors, isDark } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('c5i_contacts');
        if (stored) {
          setContacts(JSON.parse(stored));
        } else {
          setContacts([]);
        }
      } catch (err) {
        console.warn('Error leyendo contactos:', err);
      }
    })();
  }, []);

  const handleAddContact = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Datos requeridos', 'Por favor ingresa nombre y número telefónico.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '').trim();
    if (cleanPhone.length !== 10) {
      Alert.alert('Teléfono inválido', 'El número celular debe contener 10 dígitos.');
      return;
    }

    const newContact: Contact = {
      id: `cnt-${Date.now()}`,
      name: name.trim(),
      phone_number: cleanPhone,
      callsign: callsign.trim().toUpperCase() || `PATRULLA-${cleanPhone.slice(-3)}`,
      unit: 'Sector Operativo Hidalgo',
      status: 'online',
    };

    const updated = [...contacts, newContact];
    setContacts(updated);
    await AsyncStorage.setItem('c5i_contacts', JSON.stringify(updated));
    setModalVisible(false);
    setName('');
    setCallsign('');
    setPhone('');
  };

  const handlePttDirect = (c: Contact) => {
    Alert.alert(
      'Enlace PTT Directo',
      `¿Deseas iniciar enlace de radio directo con ${c.callsign} (${c.name})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Conectar Radio', onPress: () => navigation.navigate('PTT') },
      ]
    );
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.callsign.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone_number.includes(searchTerm)
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerLabel, { color: colors.textMuted }]}>DIRECTORIO</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Contactos C5i</Text>
        </View>

        <Pressable
          onPress={() => setModalVisible(true)}
          style={[styles.createButton, { backgroundColor: colors.primary }]}
        >
          <Plus color="#ffffff" size={16} />
          <Text style={styles.createButtonText}>Agregar</Text>
        </Pressable>
      </View>

      {/* Barra de Búsqueda */}
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
            placeholder="Buscar por nombre, indicativo o teléfono..."
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

      {/* Lista de Contactos */}
      {filteredContacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: colors.badgeBackground, borderColor: colors.badgeBorder },
            ]}
          >
            <User color={colors.textMuted} size={32} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {searchTerm ? 'No se encontraron contactos' : 'Sin contactos guardados'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {searchTerm
              ? 'Intenta con otro término o agrega un nuevo contacto.'
              : 'Agrega compañeros operativos para llamadas directas y PTT.'}
          </Text>
          <Pressable
            onPress={() => setModalVisible(true)}
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
          >
            <Plus color="#ffffff" size={15} />
            <Text style={styles.emptyButtonText}>Agregar Contacto</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePttDirect(item)}
              style={[
                styles.contactCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.avatarBadge,
                  { backgroundColor: colors.badgeBackground },
                ]}
              >
                <User color={colors.primary} size={20} />
              </View>

              <View style={styles.contactDetails}>
                <Text style={[styles.contactName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.contactCallsign, { color: colors.primary }]}>
                  {item.callsign}
                </Text>
                <Text style={[styles.contactPhone, { color: colors.textMuted }]}>
                  {item.phone_number}
                </Text>
              </View>

              <Pressable
                onPress={() => handlePttDirect(item)}
                style={[
                  styles.callButton,
                  {
                    backgroundColor: isDark
                      ? 'rgba(235, 82, 124, 0.15)'
                      : '#fff1f2',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Radio color={colors.primary} size={16} />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      {/* Modal Agregar Contacto */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Nuevo Contacto Operativo
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <X color={colors.textMuted} size={20} />
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              NOMBRE COMPLETO *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej. Oficial Ramírez"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 12 }]}>
              INDICATIVO / CALLSIGN
            </Text>
            <TextInput
              value={callsign}
              onChangeText={setCallsign}
              placeholder="Ej. PATRULLA-448"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              autoCapitalize="characters"
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 12 }]}>
              TELÉFONO CELULAR (10 DÍGITOS) *
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Ej. 7711234567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={[
                  styles.cancelBtn,
                  { borderColor: colors.cardBorder, backgroundColor: colors.badgeBackground },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                onPress={handleAddContact}
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.confirmBtnText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: Platform.OS === 'ios' ? 14 : 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 2,
    letterSpacing: -0.4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
  },
  contactCallsign: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  contactPhone: {
    fontSize: 11,
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
