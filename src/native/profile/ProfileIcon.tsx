import React from 'react';
import { Platform, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Camera, RefreshCw, Settings, LogOut, Trash2, X, Image, ArrowLeft, Sun, Moon, Monitor, Bell, Play, Mic, Volume2, Server, ChevronUp, ChevronDown, Wifi, Mail } from 'lucide-react';
const icons = { camera: Camera, 'refresh-cw': RefreshCw, settings: Settings, 'log-out': LogOut, 'trash-2': Trash2, x: X, image: Image, 'arrow-left': ArrowLeft, sun: Sun, moon: Moon, monitor: Monitor, bell: Bell, play: Play, mic: Mic, 'volume-2': Volume2, server: Server, 'chevron-up': ChevronUp, 'chevron-down': ChevronDown, wifi: Wifi, mail: Mail };
export function ProfileIcon({ name, size = 20, color }: { name: keyof typeof icons; size?: number; color?: string }) {
  const Icon = icons[name];
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{Platform.OS === 'web' ? <Icon size={size} color={color} strokeWidth={1.8} /> : <Feather name={name} size={size} color={color} />}</View>;
}
