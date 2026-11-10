// Native Engine for C5i Tactical Radio on iOS and Android
// Tonos locales con Expo Audio cargado al usarse; conserva háptica y evita bloquear la app si falta el módulo.

import { Vibration } from 'react-native';
import { PTT_START_BASE64, ROGER_BEEP_BASE64 } from './soundData';

class NativeSoundEngine {
  private isMuted: boolean = false;
  private volume: number = 0.85;
  private messageSounds = true;
  private rogerBeep = true;
  private players = new Map<string, import('expo-audio').AudioPlayer>();
  private warned = false;
  private radioActive = false;
  public setRadioActive(active: boolean) { this.radioActive = active; if (!active) this.stopAllAudio(); }
  public setMessageSounds(value: boolean) { this.messageSounds = value; }
  public setRogerBeep(value: boolean) { this.rogerBeep = value; }
  private tone(key: string, data: string) {
    try {
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      let player = this.players.get(key);
      // Mantener la sesión activa: terminar un beep no debe desactivar el audio WebRTC.
      if (!player) { player = createAudioPlayer({ uri: 'data:audio/wav;base64,'+data }, { keepAudioSessionActive: true }); this.players.set(key, player); }
      player.volume = this.volume;
      const current = player;
      void current.seekTo(0).then(() => { if (!this.isMuted && (key !== 'roger' || this.rogerBeep) && (key !== 'message' || this.messageSounds)) current.play(); }).catch(() => {});
      setTimeout(() => { if (!this.radioActive && this.players.get(key) === current) { current.remove(); this.players.delete(key); } }, 1200);
    } catch { if (!this.warned) { this.warned = true; console.warn('Actualiza la compilación de la app para reproducir los tonos de radio.'); } }
  }

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
      this.tone('start', PTT_START_BASE64);
      Vibration.vibrate(60);
    } catch (_) {}
  }

  // Roger Beep (PTT soltado - Notificación de cambio y fuera - Doble pulso táctico)
  public playRogerBeep() {
    if (this.isMuted || !this.rogerBeep) return;
    try {
      this.tone('roger', ROGER_BEEP_BASE64);
      Vibration.vibrate([0, 40, 50, 40]);
    } catch (_) {}
  }

  public playSquelchBurst() {}
  public playEmergencyAlert() {
    try {
      Vibration.vibrate([0, 200, 100, 200]);
    } catch (_) {}
  }
  public playIncomingChirp() { if (!this.isMuted && this.messageSounds) this.tone('message', PTT_START_BASE64); }
  public playReconnectedChirp() {}
  public playConnectionLostWarning() {}

  public stopAllAudio() { for (const player of this.players.values()) { try { player.remove(); } catch {} } this.players.clear(); }
}

export const soundEngine = new NativeSoundEngine();
export default soundEngine;
