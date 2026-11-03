// Native Sound Engine for C5i Tactical Radio on iOS and Android (expo-av)
import { Vibration } from 'react-native';
import { PTT_START_BASE64, ROGER_BEEP_BASE64 } from './soundData';

// Safe dynamic loader to prevent Metro bundler from crashing if expo-av is not yet installed on the developer's machine
function getExpoAudio(): any {
  try {
    const moduleName = 'expo-av';
    // Using variable prevents Metro static resolution failure
    const av = (globalThis as any).expo?.modules?.Audio || (typeof require !== 'undefined' ? require(moduleName) : null);
    return av?.Audio || av;
  } catch {
    return null;
  }
}

class NativeSoundEngine {
  private isMuted: boolean = false;
  private volume: number = 0.85;

  private nativePttStart: any = null;
  private nativeRogerBeep: any = null;
  private isNativeAudioReady: boolean = false;
  private isInitializingNative: boolean = false;

  constructor() {
    this.initNativeAudio().catch(() => {});
  }

  public async initNativeAudio() {
    if (this.isNativeAudioReady || this.isInitializingNative) return;
    this.isInitializingNative = true;
    try {
      const Audio = getExpoAudio();
      if (!Audio || !Audio.setAudioModeAsync) {
        console.warn(
          '🔊 [C5i Audio] Para reproducir el chirp y roger beep en tu iPhone, ejecuta en la terminal de tu Mac: npx expo install expo-av'
        );
        return;
      }

      // Configure iOS audio session to play through speaker even if mute switch is on
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      try {
        const { sound: s1 } = await Audio.Sound.createAsync(
          { uri: `data:audio/wav;base64,${PTT_START_BASE64}` },
          { shouldPlay: false, volume: this.volume }
        );
        this.nativePttStart = s1;
      } catch (e1) {
        console.warn('Error loading native PTT start:', e1);
      }

      try {
        const { sound: s2 } = await Audio.Sound.createAsync(
          { uri: `data:audio/wav;base64,${ROGER_BEEP_BASE64}` },
          { shouldPlay: false, volume: this.volume }
        );
        this.nativeRogerBeep = s2;
      } catch (e2) {
        console.warn('Error loading native Roger beep:', e2);
      }

      this.isNativeAudioReady = true;
    } catch (e) {
      console.warn('NativeSoundEngine initialization error:', e);
    } finally {
      this.isInitializingNative = false;
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.nativePttStart?.setVolumeAsync) this.nativePttStart.setVolumeAsync(this.volume).catch(() => {});
    if (this.nativeRogerBeep?.setVolumeAsync) this.nativeRogerBeep.setVolumeAsync(this.volume).catch(() => {});
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public async playPttStart() {
    if (this.isMuted) return;
    try {
      if (!this.nativePttStart) {
        await this.initNativeAudio();
      }
      if (this.nativePttStart?.playAsync) {
        await this.nativePttStart.setPositionAsync(0);
        await this.nativePttStart.setVolumeAsync(this.volume);
        await this.nativePttStart.playAsync();
      } else {
        // Fallback haptic feedback
        try {
          Vibration.vibrate(60);
        } catch {}
      }
    } catch (err) {
      console.warn('Native playPttStart error:', err);
    }
  }

  public async playRogerBeep() {
    if (this.isMuted) return;
    try {
      if (!this.nativeRogerBeep) {
        await this.initNativeAudio();
      }
      if (this.nativeRogerBeep?.playAsync) {
        await this.nativeRogerBeep.setPositionAsync(0);
        await this.nativeRogerBeep.setVolumeAsync(this.volume);
        await this.nativeRogerBeep.playAsync();
      } else {
        // Fallback haptic feedback
        try {
          Vibration.vibrate([0, 30, 40, 30]);
        } catch {}
      }
    } catch (err) {
      console.warn('Native playRogerBeep error:', err);
    }
  }

  public playSquelchBurst() {}
  public playEmergencyAlert() {}
  public playIncomingChirp() {}
  public playReconnectedChirp() {}
  public playConnectionLostWarning() {}

  public stopAllAudio() {
    if (this.nativePttStart?.stopAsync) {
      this.nativePttStart.stopAsync().catch(() => {});
    }
    if (this.nativeRogerBeep?.stopAsync) {
      this.nativeRogerBeep.stopAsync().catch(() => {});
    }
  }
}

export const soundEngine = new NativeSoundEngine();
export default soundEngine;
