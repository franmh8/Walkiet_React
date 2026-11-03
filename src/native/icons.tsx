import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
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

const isWeb = Platform.OS === 'web';

export const UserIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideUser size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="user" size={size} color={color} />
    )}
  </View>
);

export const LockIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideLock size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="lock" size={size} color={color} />
    )}
  </View>
);

export const EyeIcon: React.FC<IconProps & { off?: boolean }> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 1.8,
  off = false,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      off ? (
        <LucideEyeOff size={size} color={color} strokeWidth={strokeWidth} />
      ) : (
        <LucideEye size={size} color={color} strokeWidth={strokeWidth} />
      )
    ) : (
      <Feather name={off ? 'eye-off' : 'eye'} size={size} color={color} />
    )}
  </View>
);

export const KeyIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideKeyRound size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="key" size={size} color={color} />
    )}
  </View>
);

export const UserPlusIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#691c32',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideUserPlus size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="user-plus" size={size} color={color} />
    )}
  </View>
);

export const AlertTriangleIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#be123c',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideAlertTriangle size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="alert-triangle" size={size} color={color} />
    )}
  </View>
);

export const CheckCircleIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#059669',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideCheckCircle2 size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="check-circle" size={size} color={color} />
    )}
  </View>
);

export const PhoneIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#94a3b8',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucidePhone size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="phone" size={size} color={color} />
    )}
  </View>
);

export const MailIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#94a3b8',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideMail size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="mail" size={size} color={color} />
    )}
  </View>
);

export const ArrowLeftIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#64748b',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideArrowLeft size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="arrow-left" size={size} color={color} />
    )}
  </View>
);

export const RotateCwIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideRotateCw size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="rotate-cw" size={size} color={color} />
    )}
  </View>
);

export const MicIcon: React.FC<IconProps> = ({
  size = 24,
  color = '#334155',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideMic size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="mic" size={size} color={color} />
    )}
  </View>
);

export const UsersIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideUsers size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="users" size={size} color={color} />
    )}
  </View>
);

export const MessageSquareIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideMessageSquare size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="message-square" size={size} color={color} />
    )}
  </View>
);

export const BookOpenIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#64748b',
  strokeWidth = 1.8,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideBookOpen size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="book-open" size={size} color={color} />
    )}
  </View>
);

export const WifiIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#10b981',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideWifi size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="wifi" size={size} color={color} />
    )}
  </View>
);

export const XIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideX size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="x" size={size} color={color} />
    )}
  </View>
);

export const PlusIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#691c32',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucidePlus size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="plus" size={size} color={color} />
    )}
  </View>
);

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
