import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { CameraIcon } from '../icons';
import { groupStyles as styles } from './groupStyles';

function loadWebDecoder() {
  if ((window as any).BarcodeDetector || (window as any).jsQR || document.getElementById('c5i-qr-decoder-script')) return;
  const script = document.createElement('script');
  script.id = 'c5i-qr-decoder-script';
  script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
  script.async = true; document.head.appendChild(script);
}
// La cámara y sus recursos pertenecen al escáner: se liberan al volver al PIN o cerrar.
export function ChannelQrScanner({ onScan }: { onScan: (raw: string) => void }) {
  const [permission, setPermission] = useState<'loading' | 'granted' | 'denied'>('loading');
  const [attempt, setAttempt] = useState(0);
  const video = useRef<HTMLVideoElement | null>(null);
  const scan = useRef(onScan); scan.current = onScan;
  useEffect(() => {
    let cancelled = false; let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined; let detecting = false;
    setPermission('loading');
    void (async () => {
      try {
        if (Platform.OS !== 'web') {
          const existing = await Camera.getCameraPermissionsAsync();
          const result = existing.granted ? existing : await Camera.requestCameraPermissionsAsync();
          if (!cancelled) setPermission(result.granted ? 'granted' : 'denied');
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Cámara no disponible');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        if (cancelled) return;
        setPermission('granted'); loadWebDecoder();
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const Detector = (window as any).BarcodeDetector;
        let detector: any = null;
        try { if (Detector) detector = new Detector({ formats: ['qr_code'] }); } catch {}
        // jsQR cubre navegadores donde BarcodeDetector existe pero no admite QR.
        if (!detector && !(window as any).jsQR && !document.getElementById('c5i-qr-decoder-script')) {
          const script = document.createElement('script'); script.id = 'c5i-qr-decoder-script';
          script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'; script.async = true; document.head.appendChild(script);
        }
        timer = setInterval(() => {
          void (async () => {
            const view = video.current;
            if (cancelled || detecting || !view || view.readyState < 2) return;
            detecting = true;
            try {
              if (detector) {
                const codes = await detector.detect(view);
                if (!cancelled && codes[0]?.rawValue) { scan.current(codes[0].rawValue); return; }
              }
              const jsQR = (window as any).jsQR;
              if (jsQR && ctx && view.videoWidth && view.videoHeight) {
                canvas.width = view.videoWidth; canvas.height = view.videoHeight;
                ctx.drawImage(view, 0, 0); const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(frame.data, frame.width, frame.height);
                if (!cancelled && code?.data) scan.current(code.data);
              }
            } catch { /* El siguiente fotograma puede leerse aunque falle uno. */ }
            finally { detecting = false; }
          })();
        }, 250);
      } catch {
        stream?.getTracks().forEach(track => track.stop());
        if (!cancelled) setPermission('denied');
      }
    })();
    return () => {
      cancelled = true; if (timer) clearInterval(timer);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [attempt]);
  return <View style={styles.canalesCameraFrame}>
    {Platform.OS === 'web' && <video ref={video} autoPlay playsInline muted
      style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }} />}
    {Platform.OS !== 'web' && permission === 'granted' && <CameraView style={StyleSheet.absoluteFill}
      facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={result => { if (result.data) scan.current(result.data); }} />}
    {permission === 'loading' && <View style={styles.canalesPermOverlay}>
      <ActivityIndicator color="#691c32" /><Text style={styles.canalesPermLoadingText}>Solicitando acceso a la cámara...</Text>
    </View>}
    {permission === 'denied' && <View style={styles.canalesPermOverlay}>
      <CameraIcon size={28} color="#691c32" />
      <Text style={styles.canalesPermTitle}>Acceso a cámara requerido</Text>
      <Text style={styles.canalesPermDesc}>Autoriza la cámara para leer el QR o vuelve al ingreso por PIN.</Text>
      <TouchableOpacity style={styles.canalesPermRetryBtn} onPress={() => setAttempt(value => value + 1)}>
        <Text style={styles.canalesPermRetryBtnText}>Reintentar permiso</Text>
      </TouchableOpacity>
    </View>}
    {permission === 'granted' && <>
      <View style={[styles.canalesScannerCorner, styles.cornerTL]} /><View style={[styles.canalesScannerCorner, styles.cornerTR]} />
      <View style={[styles.canalesScannerCorner, styles.cornerBL]} /><View style={[styles.canalesScannerCorner, styles.cornerBR]} />
      <View style={styles.canalesScannerPill}><Text style={styles.canalesScannerHint}>Apunta al código QR del grupo</Text></View>
    </>}
  </View>;
}
