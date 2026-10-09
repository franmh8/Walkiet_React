// Web Audio Service with tactical sound generation and browser microphone recording

class WebAudioService {
  private audioCtx: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Trigger haptic vibration on devices that support it
  private vibrate(pattern: number | number[]) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }

  // Tactical PTT Key Start Sound (chirp / mic key tone)
  playPttStartChirp() {
    this.vibrate(40);
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.warn('AudioContext error:', e);
    }
  }

  // Authentic Tactical Roger Beep (PTT release chirp - dual tone standard K-Type)
  playRogerBeep() {
    this.vibrate([30, 20, 30]);
    try {
      const ctx = this.getAudioContext();
      const t = ctx.currentTime;

      // Tone 1: 1200 Hz for 60ms
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1209, t);
      gain1.gain.setValueAtTime(0.2, t);
      gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.07);

      // Tone 2: 1633 Hz for 70ms
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1633, t + 0.07);
      gain2.gain.setValueAtTime(0.2, t + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t + 0.07);
      osc2.stop(t + 0.15);

      // Squelch tail white noise
      this.playSquelchTail(t + 0.15);
    } catch (e) {
      console.warn('Roger beep error:', e);
    }
  }

  // Squelch tail burst (realistic walkie-talkie click & burst)
  playSquelchTail(startTime?: number) {
    try {
      const ctx = this.getAudioContext();
      const t = startTime || ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.05; // 50ms of noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(t);
      noise.stop(t + 0.05);
    } catch (_) {}
  }

  // Emergency SOS Siren Pulse
  playSosAlarm() {
    this.vibrate([100, 50, 100, 50, 100]);
    try {
      const ctx = this.getAudioContext();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.linearRampToValueAtTime(1500, t + 0.25);
      osc.frequency.linearRampToValueAtTime(900, t + 0.5);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.55);
    } catch (_) {}
  }

  async startRecording(): Promise<boolean> {
    this.playPttStartChirp();
    this.recordedChunks = [];

    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start();
      return true;
    } catch (err) {
      console.warn('Microphone permission not granted or not available, fallback to mock audio burst:', err);
      return true;
    }
  }

  async stopRecording(): Promise<string | null> {
    this.playRogerBeep();

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      return `simulated-burst-${Date.now()}`;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(`simulated-burst-${Date.now()}`);
        return;
      }

      this.mediaRecorder.onstop = () => {
        if (this.recordedChunks.length > 0) {
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(blob);
          resolve(audioUrl);
        } else {
          resolve(`simulated-burst-${Date.now()}`);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        resolve(`simulated-burst-${Date.now()}`);
      }
    });
  }

  async playAudio(uri: string) {
    if (!uri || uri.startsWith('simulated-burst')) {
      // Play a short radio burst effect for simulated messages
      this.playSquelchTail();
      setTimeout(() => this.playRogerBeep(), 600);
      return;
    }

    try {
      if (this.currentAudioElement) {
        this.currentAudioElement.pause();
        this.currentAudioElement = null;
      }

      const audio = new Audio(uri);
      this.currentAudioElement = audio;
      await audio.play();
    } catch (err) {
      console.warn('Audio playback error:', err);
      this.playRogerBeep();
    }
  }
}

export const AudioService = new WebAudioService();
export default AudioService;
