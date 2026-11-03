// Native Sound Engine for C5i Tactical Radio on iOS and Android (expo-av)
import * as Audio from 'expo-av/build/Audio';
import { PTT_START_BASE64, ROGER_BEEP_BASE64 } from './soundData';

class NativeSoundEngine {
  private isMuted: boolean = false;
  private volume: number = 0.85;

  private nativePttStart: Audio.Sound | null = null;
  private nativeRogerBeep: Audio.Sound | null = null;
  private isNativeAudioReady: boolean = false;
  private isInitializingNative: boolean = false;

  constructor() {
    this.initNativeAudio().catch(() => {});
  }

  public async initNativeAudio() {
    if (this.isNativeAudioReady || this.isInitializingNative) return;
    this.isInitializingNative = true;
    try {
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
    if (this.nativePttStart) this.nativePttStart.setVolumeAsync(this.volume).catch(() => {});
    if (this.nativeRogerBeep) this.nativeRogerBeep.setVolumeAsync(this.volume).catch(() => {});
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
      if (this.nativePttStart) {
        await this.nativePttStart.setPositionAsync(0);
        await this.nativePttStart.setVolumeAsync(this.volume);
        await this.nativePttStart.playAsync();
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
      if (this.nativeRogerBeep) {
        await this.nativeRogerBeep.setPositionAsync(0);
        await this.nativeRogerBeep.setVolumeAsync(this.volume);
        await this.nativeRogerBeep.playAsync();
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
    if (this.nativePttStart) {
      this.nativePttStart.stopAsync().catch(() => {});
    }
    if (this.nativeRogerBeep) {
      this.nativeRogerBeep.stopAsync().catch(() => {});
    }
  }
}

export const soundEngine = new NativeSoundEngine();
export default soundEngine;
