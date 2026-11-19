export interface VoiceClip { dataUrl:string; fileName:string; durationMs:number; }
export interface VoiceCapture { stop():Promise<VoiceClip>; cancel():Promise<void>; }
export const MAX_VOICE_MS=60000;
export const MAX_VOICE_BYTES=2000000;
export function voiceTime(seconds:number) { const total=Math.max(0,Math.floor(seconds));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`; }
export function isVoiceData(value?:string) { return !!value&&/^data:audio\/(wav|mp4|m4a);base64,[A-Za-z0-9+/=]+$/.test(value); }
