import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  User as LucideUser,
  Lock as LucideLock,
  Check as LucideCheck,
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
  Radio as LucideRadio,
  LogIn as LucideLogIn,
  Search as LucideSearch,
  QrCode as LucideQrCode,
  Camera as LucideCamera,
  Copy as LucideCopy,
  Settings as LucideSettings,
  LogOut as LucideLogOut,
  Trash2 as LucideTrash2,
  Edit3 as LucideEdit3,
  Send as LucideSend,
  Paperclip as LucidePaperclip,
  CheckCheck as LucideCheckCheck,
  Video as LucideVideo,
  Image as LucideImage,
  MapPin as LucideMapPin,
  FileText as LucideFileText,
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

export const CheckIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#ffffff',
  strokeWidth = 2.4,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideCheck size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="check" size={size} color={color} />
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

export const RadioIcon: React.FC<IconProps> = ({
  size = 22,
  color = '#8a1a36',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideRadio size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="radio" size={size} color={color} />
    )}
  </View>
);

export const LogInIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#334155',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideLogIn size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="log-in" size={size} color={color} />
    )}
  </View>
);

export const SearchIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#94a3b8',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideSearch size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="search" size={size} color={color} />
    )}
  </View>
);

export const QrCodeIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#64748b',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideQrCode size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="grid" size={size} color={color} />
    )}
  </View>
);

export const CameraIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#64748b',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideCamera size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="camera" size={size} color={color} />
    )}
  </View>
);

export const CopyIcon: React.FC<IconProps> = ({
  size = 16,
  color = '#64748b',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideCopy size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="copy" size={size} color={color} />
    )}
  </View>
);

export const SettingsIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#64748b',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideSettings size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="settings" size={size} color={color} />
    )}
  </View>
);

export const LogOutIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#64748b',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideLogOut size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="log-out" size={size} color={color} />
    )}
  </View>
);

export const TrashIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#e11d48',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideTrash2 size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="trash-2" size={size} color={color} />
    )}
  </View>
);

export const EditIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#334155',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideEdit3 size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="edit-3" size={size} color={color} />
    )}
  </View>
);

export const SendIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#ffffff',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideSend size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="send" size={size} color={color} />
    )}
  </View>
);

export const PaperclipIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#64748b',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucidePaperclip size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="paperclip" size={size} color={color} />
    )}
  </View>
);

export const DoubleCheckIcon: React.FC<IconProps> = ({
  size = 14,
  color = '#38bdf8',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideCheckCheck size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="check" size={size} color={color} />
    )}
  </View>
);

export const VideoIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#334155',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideVideo size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="video" size={size} color={color} />
    )}
  </View>
);

export const ImageIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#334155',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideImage size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="image" size={size} color={color} />
    )}
  </View>
);

export const MapPinIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#334155',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideMapPin size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="map-pin" size={size} color={color} />
    )}
  </View>
);

export const FileTextIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#334155',
  strokeWidth = 2,
}) => (
  <View style={[styles.center, { width: size, height: size }]}>
    {isWeb ? (
      <LucideFileText size={size} color={color} strokeWidth={strokeWidth} />
    ) : (
      <Feather name="file-text" size={size} color={color} />
    )}
  </View>
);

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
