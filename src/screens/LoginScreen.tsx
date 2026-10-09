import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Keyboard,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  UserPlus,
  X,
  CheckCircle2,
  AlertTriangle,
  Phone,
} from 'lucide-react-native';
import { RegisterModal } from '../components/RegisterModal';

export function LoginScreen() {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados de validación idénticos a la versión Web
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [inlineWarning, setInlineWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Refs para inputs
  const identifierInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Escuchar estado del teclado para centrado natural cuando no está activo
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Modal de Registro
  const [registerVisible, setRegisterVisible] = useState(false);

  // Modal de Recuperación
  const [recoverVisible, setRecoverVisible] = useState(false);
  const [recoverPhone, setRecoverPhone] = useState('');
  const [recoverSuccess, setRecoverSuccess] = useState(false);

  // Función de validación de formato (10 dígitos en teléfono o correo con dominio válido)
  const validateIdentifier = (id: string): { valid: boolean; errorMsg: string; warningMsg: string } => {
    const clean = id.trim();
    if (!clean) {
      return { valid: false, errorMsg: 'Campo requerido', warningMsg: 'Por favor ingresa tu teléfono o correo.' };
    }
    if (clean.includes('@')) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(clean)) {
        return {
          valid: false,
          errorMsg: 'Dominio inválido',
          warningMsg: 'Ingresa un correo con un dominio válido (ej. usuario@dominio.com).',
        };
      }
      return { valid: true, errorMsg: '', warningMsg: '' };
    }
    // Si contiene dígitos o no tiene @, validamos como número celular
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length > 0 || /^\d+$/.test(clean)) {
      if (digitsOnly.length !== 10) {
        return {
          valid: false,
          errorMsg: 'Debe tener 10 dígitos',
          warningMsg: 'El teléfono debe contener exactamente 10 dígitos numéricos.',
        };
      }
      return { valid: true, errorMsg: '', warningMsg: '' };
    }
    if (clean.length < 3) {
      return {
        valid: false,
        errorMsg: 'Mínimo 3 caracteres',
        warningMsg: 'El usuario debe contener al menos 3 caracteres.',
      };
    }
    return { valid: true, errorMsg: '', warningMsg: '' };
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
      identifierInputRef.current?.focus();
      return;
    }

    if (!cleanIdentifier) {
      setIdentifierError('Campo requerido');
      setInlineWarning('Por favor ingresa tu teléfono celular o correo institucional.');
      identifierInputRef.current?.focus();
      return;
    }

    if (!cleanPassword) {
      setPasswordError('Campo requerido');
      setInlineWarning('Por favor ingresa tu contraseña de acceso.');
      passwordInputRef.current?.focus();
      return;
    }

    // 2. Validar formato previo (10 dígitos exactos o correo válido con dominio)
    const formatCheck = validateIdentifier(cleanIdentifier);
    if (!formatCheck.valid) {
      setIdentifierError(formatCheck.errorMsg);
      setInlineWarning(formatCheck.warningMsg);
      identifierInputRef.current?.focus();
      return;
    }

    // 3. Ejecutar autenticación
    setLoading(true);
    try {
      const res = await login(cleanIdentifier, cleanPassword);

      if (!res.success) {
        const errorCode = res.code || '';
        const msg = res.message || '';

        // CASO A: Usuario no registrado o no encontrado (Imagen 2)
        if (
          errorCode === 'USER_NOT_FOUND' ||
          msg.toLowerCase().includes('no se encuentra registrado') ||
          msg.toLowerCase().includes('no encontrado') ||
          msg.toLowerCase().includes('inexistente')
        ) {
          setIdentifierError('Usuario no registrado');
          setInlineWarning(`El usuario «${cleanIdentifier}» no se encuentra registrado en el sistema.`);
          identifierInputRef.current?.focus();
          return;
        }

        // CASO B: Contraseña incorrecta
        if (
          errorCode === 'INVALID_PASSWORD' ||
          msg.toLowerCase().includes('contraseña incorrecta') ||
          msg.toLowerCase().includes('contraseña errónea')
        ) {
          setPasswordError('Contraseña incorrecta');
          setInlineWarning('Contraseña incorrecta. Verifica tu contraseña o solicítala nuevamente.');
          setPassword('');
          passwordInputRef.current?.focus();
          return;
        }

        // CASO C: Límite de intentos excedido
        if (
          errorCode === 'RATE_LIMITED' ||
          msg.toLowerCase().includes('bloqueado') ||
          msg.toLowerCase().includes('intentos')
        ) {
          setInlineWarning('Acceso temporalmente suspendido por múltiples intentos fallidos.');
          return;
        }

        // CASO D: Error genérico
        setInlineWarning(msg || 'Error al validar credenciales en el sistema.');
      }
    } catch (err: any) {
      setInlineWarning(err?.message || 'Error de conexión al servidor de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverSubmit = () => {
    if (!recoverPhone.trim()) {
      Alert.alert('Atención', 'Ingresa tu teléfono o correo registrado.');
      return;
    }
    setRecoverSuccess(true);
    setTimeout(() => {
      setRecoverSuccess(false);
      setRecoverVisible(false);
      setSuccessMessage('Se ha enviado el enlace de restablecimiento. Verifica tu bandeja.');
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isKeyboardVisible ? styles.scrollContentActive : styles.scrollContentCentered,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Floating Minimalist Card (Image 2 design exact) */}
        <View style={styles.card}>
          {/* Logo C5i */}
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/c5i-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Titles */}
          <Text style={styles.title}>C5i Walkiet</Text>
          <Text style={styles.subtitle}>Sistema de Radiocomunicación Táctica</Text>

          {/* Banner de Éxito */}
          {successMessage && (
            <View style={styles.successBanner}>
              <CheckCircle2 size={16} color="#059669" style={{ marginTop: 1 }} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* Banner de Alerta Idéntico a la Web (Imagen 2) */}
          {inlineWarning && (
            <View style={styles.warningBanner}>
              <AlertTriangle size={16} color="#e11d48" style={{ marginTop: 1 }} />
              <Text style={styles.warningText}>{inlineWarning}</Text>
            </View>
          )}

          {/* Campo: Teléfono o Correo con validación idéntica a Web */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Teléfono o Correo</Text>
              {identifierError && (
                <Text style={styles.fieldErrorText}>{identifierError}</Text>
              )}
            </View>
            <View
              style={[
                styles.inputWrapper,
                identifierError ? styles.inputWrapperError : null,
              ]}
            >
              <UserIcon
                size={18}
                color={identifierError ? '#e11d48' : '#94a3b8'}
              />
              <TextInput
                ref={identifierInputRef}
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (identifierError) setIdentifierError(null);
                  if (inlineWarning) setInlineWarning(null);
                }}
                placeholder="Ingresa tu teléfono o correo"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
            </View>
          </View>

          {/* Campo: Contraseña con validación idéntica a Web */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Contraseña</Text>
              {passwordError && (
                <Text style={styles.fieldErrorText}>{passwordError}</Text>
              )}
            </View>
            <View
              style={[
                styles.inputWrapper,
                passwordError ? styles.inputWrapperError : null,
              ]}
            >
              <Lock
                size={18}
                color={passwordError ? '#e11d48' : '#94a3b8'}
              />
              <TextInput
                ref={passwordInputRef}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError(null);
                  if (inlineWarning) setInlineWarning(null);
                }}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#94a3b8" />
                ) : (
                  <Eye size={18} color="#94a3b8" />
                )}
              </Pressable>
            </View>
          </View>

          {/* Botón Iniciar Sesión */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[styles.loginButton, loading && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
            )}
          </Pressable>

          {/* Enlaces de pie de tarjeta */}
          <View style={styles.footerLinks}>
            <Pressable
              onPress={() => setRecoverVisible(true)}
              style={styles.linkButton}
            >
              <KeyRound size={15} color="#475569" />
              <Text style={styles.recoverText}>Recuperar acceso</Text>
            </Pressable>

            <Pressable
              onPress={() => setRegisterVisible(true)}
              style={styles.linkButton}
            >
              <UserPlus size={15} color="#691c32" />
              <Text style={styles.registerText}>Registrarse</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Registro Idéntico a Web (Paso 1 Formulario + Paso 2 SMS OTP + Paso 3 Éxito) */}
      <RegisterModal
        visible={registerVisible}
        onClose={() => setRegisterVisible(false)}
        onSuccess={(registeredPhone, msg) => {
          setIdentifier(registeredPhone);
          setSuccessMessage(msg);
        }}
      />

      {/* Modal Recuperar Acceso */}
      <Modal
        visible={recoverVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRecoverVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: '#fdf2f4',
                    borderWidth: 1,
                    borderColor: '#fce7eb',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <KeyRound size={18} color="#691c32" />
                </View>
                <Text style={styles.modalTitle}>Recuperar acceso</Text>
              </View>
              <Pressable onPress={() => setRecoverVisible(false)} hitSlop={10}>
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Ingresa tu teléfono o correo registrado para recibir asistencia o restablecimiento.
            </Text>

            <View style={styles.modalField}>
              <Text style={styles.label}>Teléfono o Correo</Text>
              <View style={styles.inputWrapper}>
                <Phone size={18} color="#94a3b8" />
                <TextInput
                  value={recoverPhone}
                  onChangeText={setRecoverPhone}
                  placeholder="Teléfono (10 dígitos) o correo"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                />
              </View>
            </View>

            {recoverSuccess && (
              <View style={styles.modalSuccessBanner}>
                <CheckCircle2 size={16} color="#10b981" />
                <Text style={styles.modalSuccessText}>Instrucciones enviadas con éxito</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setRecoverVisible(false)}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: '#f1f5f9',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                onPress={handleRecoverSubmit}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: '#691c32',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                  Enviar Código
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9', // Fondo gris perla minimalista exacto a Web
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  scrollContentCentered: {
    justifyContent: 'center',
    paddingTop: 20,
  },
  scrollContentActive: {
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 36 : 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 24,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoImage: {
    width: 140,
    height: 100,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    fontWeight: '400',
  },

  // Alerta idéntica a Web (Imagen 2)
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff1f2', // bg-rose-50
    borderWidth: 1,
    borderColor: '#fecdd3', // border-rose-200
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: '#9f1239', // text-rose-800
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },

  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ecfdf5', // bg-emerald-50
    borderWidth: 1,
    borderColor: '#a7f3d0', // border-emerald-200
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  successText: {
    flex: 1,
    color: '#065f46',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },

  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  fieldErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e11d48', // rose-600 exacto
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff', // Fondo blanco puro idéntico a Web
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  inputWrapperError: {
    borderColor: '#f43f5e', // Solo el borde se pone en rosa/rojo
    backgroundColor: '#ffffff', // Fondo estrictamente blanco
  },
  input: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    marginLeft: 10,
    paddingVertical: 0,
  },

  loginButton: {
    backgroundColor: '#691c32', // Vino C5i exacto
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#691c32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    paddingTop: 4,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  recoverText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  registerText: {
    fontSize: 12,
    color: '#691c32',
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 16,
  },
  modalField: {
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: '#0f172a',
  },
  modalButton: {
    backgroundColor: '#691c32',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    gap: 6,
  },
  modalSuccessText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600',
  },
});
