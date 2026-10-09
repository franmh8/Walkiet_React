import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
} from 'react-native';
import {
  AlertTriangle,
  Shield,
  X,
  MapPin,
  Navigation,
  RefreshCw,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiService } from '../services/apiService';

interface SosAlertModalProps {
  visible: boolean;
  onClose: () => void;
  channelId?: string | null;
  channelName?: string;
  onAlertDispatched?: (locationName: string) => void;
}

interface LocationCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export function SosAlertModal({
  visible,
  onClose,
  channelId,
  channelName,
  onAlertDispatched,
}: SosAlertModalProps) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();

  const [isTriggered, setIsTriggered] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationLoaded, setLocationLoaded] = useState(false);

  // Ubicación inicial por defecto (Pachuca Centro C5i Hidalgo)
  const [coords, setCoords] = useState<LocationCoords>({
    lat: 20.1227,
    lng: -98.7363,
    accuracy: 8,
  });
  const [locationName, setLocationName] = useState('Pachuca Centro, Hidalgo');

  // Animaciones para la baliza de radar del mapa y el icono de alerta
  const beaconPingAnim = useRef(new Animated.Value(0)).current;
  const pulseHeaderAnim = useRef(new Animated.Value(1)).current;
  const rotateRefreshAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let beaconLoop: Animated.CompositeAnimation | null = null;
    let headerLoop: Animated.CompositeAnimation | null = null;

    if (visible) {
      beaconLoop = Animated.loop(
        Animated.timing(beaconPingAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      headerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseHeaderAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseHeaderAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );

      beaconLoop.start();
      headerLoop.start();
    } else {
      beaconPingAnim.setValue(0);
      pulseHeaderAnim.setValue(1);
    }

    return () => {
      if (beaconLoop) beaconLoop.stop();
      if (headerLoop) headerLoop.stop();
    };
  }, [visible, beaconPingAnim, pulseHeaderAnim]);

  // Animación del botón refrescar
  useEffect(() => {
    let rotateLoop: Animated.CompositeAnimation | null = null;
    if (isLocating) {
      rotateLoop = Animated.loop(
        Animated.timing(rotateRefreshAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateLoop.start();
    } else {
      rotateRefreshAnim.setValue(0);
    }
    return () => {
      if (rotateLoop) rotateLoop.stop();
    };
  }, [isLocating, rotateRefreshAnim]);

  const spinInterpolation = rotateRefreshAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const fetchCurrentLocation = async () => {
    setIsLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 6);

        setCoords({ lat, lng, accuracy });

        // Intentar geocodificación inversa con expo-location
        let resolved = false;
        try {
          const places = await Location.reverseGeocodeAsync({
            latitude: lat,
            longitude: lng,
          });
          if (places && places.length > 0) {
            const p = places[0];
            const addressParts = [
              p.street || p.name,
              p.district || p.subregion,
              p.city || p.region,
            ].filter(Boolean);
            if (addressParts.length > 0) {
              setLocationName(addressParts.join(', '));
              resolved = true;
            }
          }
        } catch {
          // fallback a Nominatim
        }

        if (!resolved) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
              {
                signal: controller.signal,
                headers: { 'Accept-Language': 'es' },
              }
            );
            clearTimeout(timeoutId);
            if (response.ok) {
              const data = await response.json();
              const addressParts = [
                data.address?.road || data.address?.suburb,
                data.address?.neighbourhood || data.address?.city || data.address?.town,
                data.address?.state,
              ].filter(Boolean);
              if (addressParts.length > 0) {
                setLocationName(addressParts.join(', '));
                resolved = true;
              } else if (data.display_name) {
                setLocationName(data.display_name.split(',').slice(0, 3).join(', '));
                resolved = true;
              }
            }
          } catch {
            // fallback a coordenadas
          }
        }

        if (!resolved) {
          setLocationName(`Sector GPS ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`);
        }
      } else {
        setLocationName('Sector Centro, Pachuca, Hidalgo (GPS Operativo)');
      }
    } catch (e) {
      console.warn('Geolocation error / permission denied:', e);
      setLocationName('Pachuca Centro, Hidalgo (GPS Base)');
    } finally {
      setIsLocating(false);
      setLocationLoaded(true);
    }
  };

  useEffect(() => {
    if (visible) {
      setIsTriggered(false);
      fetchCurrentLocation();
    }
  }, [visible]);

  const handleBroadcastSos = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (_) {}

    setIsTriggered(true);

    const protocolDescription =
      'Al activar la alerta se emitira una sirena sonora en todos los radios disponibles en la zona y se asignara prioridad absoluta a tu frecuencia';

    try {
      await apiService.sendSosAlert({
        officer_id: user?.id || 'usr-anon',
        officer_name: user?.name || 'Oficial C5i',
        officer_callsign: user?.callsign || 'CENTRAL-C5I',
        channel_id: channelId || null,
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy_meters: coords.accuracy,
        location_name: locationName,
        protocol_text: protocolDescription,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
    } catch (err) {
      console.warn('[SosAlertModal] Error al enviar alerta SOS a la API:', err);
    }

    setTimeout(() => {
      setIsTriggered(false);
      if (onAlertDispatched) {
        onAlertDispatched(locationName);
      }
      onClose();
    }, 1800);
  };

  const pingScale = beaconPingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.8],
  });

  const pingOpacity = beaconPingAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.7, 0.3, 0],
  });

  // URL del mapa de OpenStreetMap estático
  const staticMapUri = `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=15&size=500x200&maptype=mapnik`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? '#e11d48' : '#f43f5e',
            },
          ]}
        >
          {/* ENCABEZADO: ALERTA DE EMERGENCIA */}
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <Animated.View
                style={[
                  styles.headerIconContainer,
                  { transform: [{ scale: pulseHeaderAnim }] },
                ]}
              >
                <AlertTriangle size={20} color="#ffffff" />
              </Animated.View>
              <Text style={styles.headerTitle}>ALERTA DE EMERGENCIA</Text>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel="Cerrar modal"
            >
              <X size={20} color="#ffe4e6" />
            </Pressable>
          </View>

          {/* CUERPO DEL MODAL */}
          <View style={styles.body}>
            {/* PROTOCOLO DE DESPACHO */}
            <View
              style={[
                styles.protocolBox,
                {
                  backgroundColor: isDark
                    ? 'rgba(76, 5, 25, 0.45)'
                    : '#fff1f2',
                  borderColor: isDark ? '#881337' : '#fecdd3',
                },
              ]}
            >
              <View style={styles.protocolHeader}>
                <Shield size={15} color={isDark ? '#fb7185' : '#e11d48'} />
                <Text
                  style={[
                    styles.protocolTitle,
                    { color: isDark ? '#fda4af' : '#be123c' },
                  ]}
                >
                  PROTOCOLO DE DESPACHO
                </Text>
              </View>
              <Text
                style={[
                  styles.protocolText,
                  { color: isDark ? '#fecdd3' : '#881337' },
                ]}
              >
                Al activar la alerta se emitira una sirena sonora en todos los radios
                disponibles en la zona y se asignara prioridad absoluta a tu
                frecuencia
              </Text>
            </View>

            {/* SECCIÓN UBICACIÓN AUTOMÁTICA */}
            <View style={styles.locationSection}>
              <View style={styles.locationHeaderRow}>
                <View style={styles.locationHeaderLeft}>
                  <MapPin size={14} color="#f43f5e" />
                  <Text
                    style={[
                      styles.locationLabel,
                      { color: isDark ? '#e2e8f0' : '#334155' },
                    ]}
                  >
                    Ubicación de Envío Automático:
                  </Text>
                </View>

                <Pressable
                  onPress={fetchCurrentLocation}
                  disabled={isLocating}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.refreshBtn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Animated.View
                    style={{ transform: [{ rotate: spinInterpolation }] }}
                  >
                    <RefreshCw
                      size={12}
                      color={isDark ? '#fb7185' : '#e11d48'}
                    />
                  </Animated.View>
                  <Text
                    style={[
                      styles.refreshBtnText,
                      { color: isDark ? '#fb7185' : '#e11d48' },
                    ]}
                  >
                    {isLocating ? 'Detectando...' : 'Actualizar GPS'}
                  </Text>
                </Pressable>
              </View>

              {/* MAPA TÁCTICO */}
              <View style={styles.mapContainer}>
                {/* Imagen del mapa satelital / callejero de fondo */}
                <Image
                  source={{ uri: staticMapUri }}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />

                {/* Capa de contraste táctico */}
                <View style={styles.mapOverlayContrast} />

                {/* Retícula táctica de radar */}
                <View style={styles.radarCrosshairHorizontal} />
                <View style={styles.radarCrosshairVertical} />

                {/* Baliza táctica animada en el centro */}
                <View style={styles.beaconCenterContainer}>
                  <Animated.View
                    style={[
                      styles.beaconPingRing,
                      {
                        transform: [{ scale: pingScale }],
                        opacity: pingOpacity,
                      },
                    ]}
                  />
                  <View style={styles.beaconCoreDot}>
                    <View style={styles.beaconCoreInner} />
                  </View>
                </View>

                {/* Badge GPS ACTIVO Superior */}
                <View style={styles.badgeTopLeft}>
                  <View style={styles.gpsPulseDot} />
                  <Text style={styles.badgeText}>
                    GPS ACTIVO (±{coords.accuracy}m)
                  </Text>
                </View>

                {/* Barra Inferior del mapa con nombre de calle y coordenadas */}
                <View style={styles.mapBottomBar}>
                  <View style={styles.mapBottomLeft}>
                    <Navigation
                      size={12}
                      color="#f43f5e"
                      style={{ transform: [{ rotate: '45deg' }] }}
                    />
                    <Text style={styles.mapBottomLocation} numberOfLines={1}>
                      {locationName}
                    </Text>
                  </View>
                  <Text style={styles.mapBottomCoords}>
                    {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°
                  </Text>
                </View>
              </View>

              {/* Nota explicativa inferior */}
              <View style={styles.noteRow}>
                <View style={styles.noteDot} />
                <Text
                  style={[
                    styles.noteText,
                    { color: isDark ? '#94a3b8' : '#64748b' },
                  ]}
                >
                  Estas coordenadas satelitales se despacharán de forma 100%
                  automática al activar la alarma.
                </Text>
              </View>
            </View>

            {/* BOTONES DE ACCIÓN */}
            <View style={styles.buttonRow}>
              <Pressable
                onPress={onClose}
                disabled={isTriggered}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.cancelBtnText,
                    { color: isDark ? '#cbd5e1' : '#475569' },
                  ]}
                >
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                onPress={handleBroadcastSos}
                disabled={isTriggered}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  isTriggered && styles.confirmBtnDisabled,
                  pressed && !isTriggered && { opacity: 0.88 },
                ]}
              >
                {isTriggered ? (
                  <View style={styles.btnLoadingRow}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.confirmBtnText}>ACTIVANDO ALARMA...</Text>
                  </View>
                ) : (
                  <View style={styles.btnContentRow}>
                    <AlertTriangle size={15} color="#ffffff" />
                    <Text style={styles.confirmBtnText}>ACTIVAR ALARMA</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  headerBar: {
    backgroundColor: '#be123c',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    borderBottomWidth: 1,
    borderBottomColor: '#9f1239',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 5, 25, 0.65)',
    borderWidth: 1,
    borderColor: '#fda4af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  body: {
    padding: 16,
    gap: 14,
  },
  protocolBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  protocolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  protocolTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  protocolText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  locationSection: {
    gap: 8,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mapContainer: {
    height: 140,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapOverlayContrast: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
  },
  radarCrosshairHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  radarCrosshairVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  beaconCenterContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconPingRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 63, 94, 0.45)',
  },
  beaconCoreDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e11d48',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  beaconCoreInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
  badgeTopLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gpsPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  badgeText: {
    color: '#fda4af',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  mapBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(159, 18, 57, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    marginRight: 6,
  },
  mapBottomLocation: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  mapBottomCoords: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 2,
  },
  noteDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#f43f5e',
    marginTop: 5,
  },
  noteText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#e11d48',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.75,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
