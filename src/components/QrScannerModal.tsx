import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { X, QrCode, Flashlight, Camera, KeyRound, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (scannedValue: string) => void;
  onOpenManualCode: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  visible,
  onClose,
  onScanSuccess,
  onOpenManualCode,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Reset al abrir el modal
  useEffect(() => {
    if (visible) {
      setHasScanned(false);
      setTorchEnabled(false);
      // Solicita permiso automáticamente si aún no ha sido determinado
      if (!permission) {
        requestPermission();
      }
    }
  }, [visible]);

  // Animación del láser escáner táctico
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (visible && !hasScanned) {
      scanLineAnim.setValue(0);
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      scanLineAnim.setValue(0);
    }

    return () => {
      if (anim) anim.stop();
    };
  }, [visible, hasScanned]);

  if (!visible) return null;

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 200],
  });

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasScanned) return;
    const data = result.data;
    if (!data) return;

    setHasScanned(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    // Pequeño delay táctico para feedback visual
    setTimeout(() => {
      onScanSuccess(data);
    }, 300);
  };

  const isCameraAvailable = permission?.granted;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBadge}>
                <Camera color="#eb527c" size={18} />
              </View>
              <Text style={styles.title}>Escanear Código QR</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color="#94a3b8" size={20} />
            </Pressable>
          </View>

          {/* Subtítulo */}
          <Text style={styles.subtitle}>
            Apunta la cámara del dispositivo al código QR para sincronizar el canal automáticamente.
          </Text>

          {/* Visor de Cámara con Retícula y Láser */}
          <View style={styles.cameraViewport}>
            {isCameraAvailable ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                enableTorch={torchEnabled}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
              />
            ) : (
              <View style={styles.permissionContainer}>
                <Camera color="#94a3b8" size={38} style={{ opacity: 0.6, marginBottom: 12 }} />
                <Text style={styles.permissionTitle}>Permiso de Cámara Requerido</Text>
                <Text style={styles.permissionSubtitle}>
                  Para escanear códigos QR tácticos se requiere acceso a la cámara.
                </Text>
                <Pressable
                  onPress={requestPermission}
                  style={styles.permissionBtn}
                >
                  <Text style={styles.permissionBtnText}>Habilitar Cámara</Text>
                </Pressable>
              </View>
            )}

            {/* Capa superpuesta con visor táctico y marco de enfoque */}
            <View style={styles.scannerOverlay}>
              <View style={styles.focusFrame}>
                {/* Esquinas tácticas */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {/* Línea láser de escaneo animada */}
                {!hasScanned && isCameraAvailable && (
                  <Animated.View
                    style={[
                      styles.laserLine,
                      {
                        transform: [{ translateY }],
                      },
                    ]}
                  />
                )}

                {hasScanned && (
                  <View style={styles.scannedSuccessBadge}>
                    <CheckCircle2 color="#10b981" size={42} />
                    <Text style={styles.scannedSuccessText}>¡Código Detectado!</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Controles de linterna si la cámara está activa */}
            {isCameraAvailable && (
              <View style={styles.cameraControls}>
                <Pressable
                  onPress={() => {
                    setTorchEnabled(!torchEnabled);
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                  }}
                  style={[
                    styles.controlBtn,
                    torchEnabled && styles.controlBtnActive,
                  ]}
                >
                  <Flashlight
                    color={torchEnabled ? '#f59e0b' : '#ffffff'}
                    size={16}
                  />
                  <Text style={styles.controlBtnText}>
                    {torchEnabled ? 'Linterna ON' : 'Linterna'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Botones inferiores */}
          <View style={styles.footerActions}>
            <Pressable
              onPress={() => {
                onClose();
                onOpenManualCode();
              }}
              style={styles.manualEntryBtn}
            >
              <KeyRound color="#8a1a36" size={16} />
              <Text style={styles.manualEntryBtnText}>
                Ingresar Código PIN Manualmente
              </Text>
            </Pressable>

            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 12, 22, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0b1320',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(235, 82, 124, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 16,
  },
  cameraViewport: {
    width: '100%',
    height: 270,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#1e293b',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070d18',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#8a1a36',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  focusFrame: {
    width: 210,
    height: 210,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#eb527c',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },
  laserLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2.5,
    backgroundColor: '#eb527c',
    shadowColor: '#eb527c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  scannedSuccessBadge: {
    backgroundColor: 'rgba(11, 19, 32, 0.9)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  scannedSuccessText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  controlBtnActive: {
    borderColor: '#f59e0b',
  },
  controlBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  footerActions: {
    marginTop: 16,
    gap: 10,
  },
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  manualEntryBtnText: {
    color: '#8a1a36',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
});
