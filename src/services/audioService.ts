import * as Haptics from 'expo-haptics';
import { NativeModules } from 'react-native';

// Safe check to avoid [runtime not ready]: Error: Cannot find native module 'ExponentAV' in Expo Go
let AudioModule: any = null;

function hasNativeExponentAV(): boolean {
  try {
    // 1. Check React Native NativeModules
    if (NativeModules && (NativeModules.ExponentAV || NativeModules.ExponentAudio)) {
      return true;
    }
    // 2. Check global.ExpoModules (Expo Modules API)
    const expoModules = (global as any)?.ExpoModules;
    if (expoModules && (expoModules.ExponentAV || expoModules.ExpoAudio)) {
      return true;
    }
    // 3. Try expo-modules-core requireOptionalNativeModule without throwing
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { requireOptionalNativeModule } = require('expo-modules-core');
      if (typeof requireOptionalNativeModule === 'function') {
        const mod = requireOptionalNativeModule('ExponentAV');
        if (mod) return true;
      }
    } catch (_) {}
  } catch (_) {}
  return false;
}

try {
  if (hasNativeExponentAV()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoAv = require('expo-av');
    if (expoAv && expoAv.Audio) {
      AudioModule = expoAv.Audio;
    }
  }
} catch (err) {
  // Fallback to resilient simulated mode
}

let currentRecording: any = null;
let currentSound: any = null;

export const AudioService = {
  isNativeAvailable(): boolean {
    return !!AudioModule;
  },

  async init() {
    if (!AudioModule) {
      console.log('[AudioService] Inicializado en modo táctico resiliente (sin ExponentAV nativo).');
      return;
    }

    try {
      if (AudioModule.requestPermissionsAsync) {
        await AudioModule.requestPermissionsAsync();
      }
      if (AudioModule.setAudioModeAsync) {
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      }
    } catch (err) {
      console.warn('[AudioService] Error al inicializar audio nativo:', err);
    }
  },

  async startRecording(): Promise<boolean> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (_) {}

    if (!AudioModule) {
      currentRecording = { startTime: Date.now(), uri: `simulated-burst-${Date.now()}` };
      return true;
    }

    try {
      if (currentRecording && currentRecording.stopAndUnloadAsync) {
        try {
          await currentRecording.stopAndUnloadAsync();
        } catch (_) {}
        currentRecording = null;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await AudioModule.Recording.createAsync(
        AudioModule.RecordingOptionsPresets.HIGH_QUALITY
      );
      currentRecording = recording;
      return true;
    } catch (err) {
      console.warn('[AudioService] Fallback a PTT simulado por error en grabación nativa:', err);
      currentRecording = { startTime: Date.now(), uri: `simulated-burst-${Date.now()}` };
      return true;
    }
  },

  async stopRecording(): Promise<string | null> {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}

    if (!currentRecording) return null;

    if (!AudioModule || !currentRecording.stopAndUnloadAsync) {
      const uri = currentRecording.uri || `ptt-audio-${Date.now()}`;
      currentRecording = null;
      return uri;
    }

    try {
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      currentRecording = null;
      return uri;
    } catch (err) {
      console.warn('[AudioService] Error al finalizar grabación nativa:', err);
      currentRecording = null;
      return `ptt-audio-${Date.now()}`;
    }
  },

  async playAudio(uri: string) {
    if (!AudioModule) {
      console.log('[AudioService] Reproduciendo ráfaga (simulado):', uri);
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}
      return;
    }

    try {
      if (currentSound && currentSound.unloadAsync) {
        await currentSound.unloadAsync();
        currentSound = null;
      }

      const { sound } = await AudioModule.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      currentSound = sound;
      await sound.playAsync();
    } catch (err) {
      console.warn('[AudioService] No se pudo reproducir audio nativo:', err);
    }
  },

  async playRogerBeep() {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  },
};
