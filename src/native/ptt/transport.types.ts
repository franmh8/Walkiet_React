import type { RadioCredentials } from '../../services/pttApi';
export interface RadioEvents {
  state: (state: 'connected' | 'reconnecting' | 'disconnected') => void;
  speakers: (names: string[]) => void;
  playback: (enabled: boolean) => void;
  error: (message: string) => void;
}
export interface RadioTransport {
  connect: (credentials: RadioCredentials) => Promise<void>;
  prepareMicrophone: () => Promise<void>;
  publish: () => Promise<void>;
  silence: () => Promise<void>;
  enableAudio: () => Promise<void>;
  close: () => Promise<void>;
}
export type CreateTransport = (events: RadioEvents, channelName: string, isCurrent?: () => boolean) => Promise<RadioTransport>;
