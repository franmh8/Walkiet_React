import { NativeModules, PermissionsAndroid, Platform, AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { CreateTransport } from './transport.types';
let initialized = false;
let audioOwner = 0;
export const createRadioTransport: CreateTransport = async (events, name, isCurrent = () => true) => {
  if (!NativeModules.LivekitReactNativeModule) throw new Error('Para usar la radio en este teléfono instala la compilación de pruebas de la app. Expo Go no incluye este módulo.');
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Autoriza el micrófono para conectar la radio.');
  }
  if (!isCurrent()) throw new Error('La conexión se canceló.');
  // La carga diferida mantiene accesibles login, grupos y contactos en Expo Go.
  const { registerGlobals, AudioSession } = require('@livekit/react-native') as typeof import('@livekit/react-native');
  if (!initialized) { registerGlobals(); initialized = true; }
  if (AppState.currentState !== 'active') throw new Error('Abre la app para conectar la radio.');
  const service = requireOptionalNativeModule('WalkietRadioService');
  if (Platform.OS === 'android' && !service) throw new Error('La compilación necesita actualizar el servicio de radio.');
  const owner = ++audioOwner;
  const cleanup = async () => {
    // El cierre atrasado de otra cuenta/grupo no apaga la sesión nueva.
    if (audioOwner !== owner) return;
    ++audioOwner;
    try { if (Platform.OS === 'android') await service?.stop(); }
    finally { if (audioOwner === owner + 1) await AudioSession.stopAudioSession(); }
  };
  try {
    await AudioSession.startAudioSession();
    if (!isCurrent() || audioOwner !== owner) throw new Error('La conexión se canceló.');
    if (Platform.OS === 'android') await service!.start(name);
    if (!isCurrent() || audioOwner !== owner) throw new Error('La conexión se canceló.');
    const { createLiveTransport } = require('./liveTransport') as typeof import('./liveTransport');
    return createLiveTransport(events, false, cleanup);
  } catch (cause) { await cleanup(); throw cause; }
};
