// Native Engine for C5i Tactical Radio on iOS and Android
// Uses pure React Native core APIs (Vibration/Haptics) to prevent missing native module crashes (like ExpoAsset)

import { Vibration } from 'react-native';

class NativeSoundEngine {
  private isMuted: boolean = false;
  private volume: number = 0.85;

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  // Tactical PTT Key-down (Chirp de inicio de transmisión - Pulso táctico instantáneo)
  public playPttStart() {
    if (this.isMuted) return;
    try {
      Vibration.vibrate(60);
    } catch (_) {}
  }

  // Roger Beep (PTT soltado - Notificación de cambio y fuera - Doble pulso táctico)
  public playRogerBeep() {
    if (this.isMuted) return;
    try {
      Vibration.vibrate([0, 40, 50, 40]);
    } catch (_) {}
  }

  public playSquelchBurst() {}
  public playEmergencyAlert() {
    try {
      Vibration.vibrate([0, 200, 100, 200]);
    } catch (_) {}
  }
  public playIncomingChirp() {}
  public playReconnectedChirp() {}
  public playConnectionLostWarning() {}

  public stopAllAudio() {}
}

export const soundEngine = new NativeSoundEngine();
export default soundEngine;
