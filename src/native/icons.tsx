import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  User as LucideUser,
  Lock as LucideLock,
  Eye as LucideEye,
  EyeOff as LucideEyeOff,
  KeyRound as LucideKeyRound,
  UserPlus as LucideUserPlus,
  AlertTriangle as LucideAlertTriangle,
  CheckCircle2 as LucideCheckCircle2,
  Phone as LucidePhone,
  Mail as LucideMail,
  ArrowLeft as LucideArrowLeft,
  RotateCw as LucideRotateCw,
  Mic as LucideMic,
  Users as LucideUsers,
  MessageSquare as LucideMessageSquare,
  BookOpen as LucideBookOpen,
  Wifi as LucideWifi,
  X as LucideX,
  Plus as LucidePlus,
} from 'lucide-react';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const UserIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideUser size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const LockIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideLock size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const EyeIcon: React.FC<IconProps & { off?: boolean }> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.8,
  off = false,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {off ? (
      <LucideEyeOff size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <LucideEye size={size} color={color} strokeWidth={strokeWidth} />
    )}
  </View>
);

export const KeyIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideKeyRound size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const UserPlusIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#691c32',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideUserPlus size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const AlertTriangleIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#be123c',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideAlertTriangle size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const CheckCircleIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#059669',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideCheckCircle2 size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const PhoneIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#94a3b8',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucidePhone size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const MailIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#94a3b8',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideMail size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#64748b',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideArrowLeft size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const RotateCwIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideRotateCw size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const MicIcon: React.FC<IconProps> = ({
  size = 24,
  color = '#334155',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideMic size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const UsersIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideUsers size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const MessageSquareIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideMessageSquare size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const BookOpenIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideBookOpen size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const WifiIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#10b981',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideWifi size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const XIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucideX size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

export const PlusIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#691c32',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    <LucidePlus size={size} color={color} strokeWidth={strokeWidth} />
  </View>
);

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
