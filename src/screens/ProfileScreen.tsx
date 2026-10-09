import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  User,
  Shield,
  Lock,
  Phone,
  LogOut,
  Sun,
  Moon,
  Monitor,
  CheckCircle,
} from 'lucide-react-native';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Deseas cerrar tu sesión activa de C5i?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerLabel, { color: colors.textMuted }]}>CUENTA</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Perfil y Ajustes</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {/* Credencial Operativa Minimalista (Exacto a Web) */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View
            style={[
              styles.avatarContainer,
              {
                backgroundColor: isDark
                  ? 'rgba(235, 82, 124, 0.15)'
                  : '#fff1f2',
                borderColor: colors.primary,
              },
            ]}
          >
            <User color={colors.primary} size={38} />
          </View>

          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.name || 'Oficial Operativo'}
          </Text>
          <Text style={[styles.userCallsign, { color: colors.primary }]}>
            {user?.callsign || 'PATRULLA'}
          </Text>
          <Text style={[styles.userUnit, { color: colors.textSecondary }]}>
            {user?.unit || 'Sector Operativo Hidalgo'}
          </Text>

          <View
            style={[
              styles.verifiedBadge,
              {
                backgroundColor: isDark
                  ? 'rgba(16, 185, 129, 0.15)'
                  : '#ecfdf5',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0',
              },
            ]}
          >
            <CheckCircle color="#10b981" size={13} />
            <Text style={styles.verifiedBadgeText}>ENLACE ACTIVO C5i</Text>
          </View>
        </View>

        {/* SELECTOR DE TEMA: CLARO / OSCURO / SISTEMA (IDÉNTICO A WEB) */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View style={styles.sectionTitleRow}>
            <Sun color="#f59e0b" size={16} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Tema de la Aplicación
            </Text>
          </View>

          <View style={styles.themeSelectorRow}>
            {/* Modo Claro */}
            <Pressable
              onPress={() => setThemeMode('light')}
              style={[
                styles.themeOption,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    themeMode === 'light' ? colors.primary : colors.cardBorder,
                },
                themeMode === 'light' && {
                  backgroundColor: isDark
                    ? 'rgba(235, 82, 124, 0.1)'
                    : '#fff1f2',
                  borderWidth: 1.5,
                },
              ]}
            >
              <Sun
                color={themeMode === 'light' ? colors.primary : colors.textSecondary}
                size={20}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  {
                    color:
                      themeMode === 'light' ? colors.primary : colors.textSecondary,
                  },
                ]}
              >
                Claro
              </Text>
            </Pressable>

            {/* Modo Oscuro */}
            <Pressable
              onPress={() => setThemeMode('dark')}
              style={[
                styles.themeOption,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    themeMode === 'dark' ? colors.primary : colors.cardBorder,
                },
                themeMode === 'dark' && {
                  backgroundColor: isDark
                    ? 'rgba(235, 82, 124, 0.1)'
                    : '#fff1f2',
                  borderWidth: 1.5,
                },
              ]}
            >
              <Moon
                color={themeMode === 'dark' ? colors.primary : colors.textSecondary}
                size={20}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  {
                    color:
                      themeMode === 'dark' ? colors.primary : colors.textSecondary,
                  },
                ]}
              >
                Oscuro
              </Text>
            </Pressable>

            {/* Modo Sistema */}
            <Pressable
              onPress={() => setThemeMode('system')}
              style={[
                styles.themeOption,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    themeMode === 'system' ? colors.primary : colors.cardBorder,
                },
                themeMode === 'system' && {
                  backgroundColor: isDark
                    ? 'rgba(235, 82, 124, 0.1)'
                    : '#fff1f2',
                  borderWidth: 1.5,
                },
              ]}
            >
              <Monitor
                color={themeMode === 'system' ? colors.primary : colors.textSecondary}
                size={20}
              />
              <Text
                style={[
                  styles.themeOptionText,
                  {
                    color:
                      themeMode === 'system' ? colors.primary : colors.textSecondary,
                  },
                ]}
              >
                Sistema
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Parámetros de Enlace */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View style={styles.sectionTitleRow}>
            <Shield color={colors.primary} size={16} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Parámetros de Seguridad
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View
              style={[
                styles.iconMiniBadge,
                { backgroundColor: colors.badgeBackground },
              ]}
            >
              <Lock color={colors.textSecondary} size={15} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                Cifrado Táctico
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                AES-256 GCM
              </Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginTop: 12 }]}>
            <View
              style={[
                styles.iconMiniBadge,
                { backgroundColor: colors.badgeBackground },
              ]}
            >
              <Phone color={colors.textSecondary} size={15} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
                Línea Registrada
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {user?.phone_number || 'No vinculada'}
              </Text>
            </View>
          </View>
        </View>

        {/* Botón Cerrar Sesión */}
        <Pressable
          onPress={handleLogout}
          style={[
            styles.logoutButton,
            {
              backgroundColor: isDark
                ? 'rgba(239, 68, 68, 0.15)'
                : '#fef2f2',
              borderColor: isDark
                ? 'rgba(239, 68, 68, 0.3)'
                : '#fecaca',
            },
          ]}
        >
          <LogOut color="#ef4444" size={17} />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
  profileCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userCallsign: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  userUnit: {
    fontSize: 12,
    marginTop: 3,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
    marginTop: 14,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconMiniBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
    marginBottom: 30,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
});
