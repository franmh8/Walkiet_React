export interface User {
  id: string;
  phone_number: string;
  name: string;
  correo?: string;
  password?: string;
  role?: string;
  avatar_url?: string | null;
  status: 'online' | 'offline' | 'transmitting';
  callsign?: string;
  unit?: string;
}

export interface LoginResponse {
  success: boolean;
  code?: 'USER_NOT_FOUND' | 'INVALID_PASSWORD' | 'RATE_LIMITED' | 'CONNECTION_ERROR' | 'SUCCESS';
  message?: string;
  user?: User;
}

export interface Channel {
  id: string;
  name: string;
  is_private: boolean | number;
  access_code?: string | null;
  created_by?: string;
  admin_id?: string;
  admin_name?: string;
  role?: 'admin' | 'usuario';
  created_at?: string;
  category?: 'general' | 'emergencia' | 'tactico' | 'vialidad' | 'inteligencia' | string;
  active_transmitters_count?: number;
  member_count?: number;
  is_encrypted?: boolean | number;
}

export interface VoiceMessage {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_callsign?: string;
  channel_id?: string | null;
  receiver_id?: string | null;
  audio_url: string;
  duration_seconds: number;
  created_at: string;
  is_emergency?: boolean;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_callsign?: string;
  text: string;
  type: 'text' | 'audio' | 'location' | 'emergency';
  created_at: string;
  channel_id?: string | null;
  receiver_id?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  phone_number: string;
  callsign: string;
  unit: string;
  status: 'online' | 'offline' | 'transmitting';
  avatar_url?: string;
}
