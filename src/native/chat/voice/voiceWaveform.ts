export const WAVE_BARS = 36;
export type VoiceWave = {peaks: number[]; duration: number};
export const emptyWave = (): VoiceWave => ({peaks: Array(WAVE_BARS).fill(0), duration: 0});

// RMS por tramo: los silencios se conservan; nunca generar barras al azar.
export function audioPeaks(channels: ArrayLike<number>[], count = WAVE_BARS): number[] {
  const length = channels[0]?.length || 0;
  return Array.from({length: count}, (_, bin) => {
    const start = Math.floor(bin * length / count), end = Math.floor((bin + 1) * length / count);
    let energy = 0;
    for (const channel of channels) for (let i = start; i < end; i++) energy += channel[i] * channel[i];
    return end > start ? Math.min(1, Math.sqrt(energy / ((end - start) * channels.length)) * 3) : 0;
  });
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Lookup = new Int16Array(128).fill(-1);
for (let i = 0; i < alphabet.length; i++) base64Lookup[alphabet.charCodeAt(i)] = i;
function decodeBase64(value: string): Uint8Array {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(Math.floor(value.length * 3 / 4) - padding);
  let bits = 0, buffer = 0, offset = 0;
  for (let i = 0; i < value.length - padding; i++) {
    const code = value.charCodeAt(i), n = code < 128 ? base64Lookup[code] : -1; if (n < 0) break;
    buffer = (buffer << 6) | n; bits += 6;
    if (bits >= 8) {bits -= 8; bytes[offset++] = (buffer >> bits) & 255;}
  }
  return bytes;
}

// WAV PCM se analiza sin abrir otro dispositivo de audio ni decodificar de nuevo.
export function wavWaveform(url?: string): VoiceWave | null {
  if (!url?.startsWith('data:audio/wav;base64,')) return null;
  try {
    const bytes = decodeBase64(url.slice(url.indexOf(',') + 1)), view = new DataView(bytes.buffer);
    const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    let channels = 0, rate = 0, bits = 0, format = 0;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = view.getUint32(offset + 4, true), start = offset + 8;
      if (start + size > bytes.length) return null;
      if (tag(offset) === 'fmt ' && size >= 16) {
        format = view.getUint16(start, true); channels = view.getUint16(start + 2, true);
        rate = view.getUint32(start + 4, true); bits = view.getUint16(start + 14, true);
      }
      if (tag(offset) === 'data' && format === 1 && bits === 16 && rate > 0 && channels > 0 && channels <= 8) {
        const length = Math.floor(size / (2 * channels));
        const samples = Array.from({length: channels}, (_, c) => {
          const values = new Float32Array(length);
          for (let i = 0; i < length; i++) values[i] = view.getInt16(start + (i * channels + c) * 2, true) / 32768;
          return values;
        });
        return {peaks: audioPeaks(samples), duration: length / rate};
      }
      offset = start + size + (size % 2);
    }
  } catch {}
  return null;
}

export function labelDuration(label: string): number {
  const match = label.match(/\((\d+):(\d{2})\)/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}
