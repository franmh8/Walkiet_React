/** Menú visual del chat. Mantiene los cuatro botones y sus colores originales. */
import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { ImageIcon, CameraIcon, MapPinIcon, FileTextIcon } from '../icons';

type AttachmentOption = 'Fotos' | 'Cámara' | 'Ubicación' | 'Documento';
interface Props {
  styles: Record<string, any>;
  onClose: () => void;
  onChoose: (option: AttachmentOption) => void;
}
const OPTIONS: { option: AttachmentOption; color: string; label: string; icon: typeof ImageIcon }[] = [
  { option: 'Fotos', label: 'Fotos', color: '#2563eb', icon: ImageIcon },
  { option: 'Cámara', label: 'Cámara', color: '#475569', icon: CameraIcon },
  { option: 'Ubicación', label: 'Ubicación', color: '#059669', icon: MapPinIcon },
  { option: 'Documento', label: 'Documento', color: '#0284c7', icon: FileTextIcon },
];

export function ChatAttachmentsMenu({ styles, onClose, onChoose }: Props) {
  return (
    <View style={[styles.chatAttachMenuOverlay, Platform.OS === 'ios' && styles.chatAttachMenuOverlayIos]}>
      <TouchableOpacity
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Cerrar menú de adjuntos"
      />
      <View pointerEvents="auto" style={[styles.chatAttachMenuCard, { zIndex: 2, width: '100%' }]}>
        <View style={styles.chatAttachMenuRow}>
          {OPTIONS.map(({ option, color, label, icon: Icon }) => (
            <TouchableOpacity
              key={option}
              style={styles.chatAttachMenuItem}
              onPress={() => onChoose(option)}
              activeOpacity={0.75}
              accessibilityLabel={option === 'Cámara' ? 'Abrir cámara' : `Seleccionar ${label.toLowerCase()}`}
            >
              <View style={[styles.chatAttachIconCircle, { backgroundColor: color }]}>
                <Icon size={26} color="#ffffff" strokeWidth={2} />
              </View>
              <Text style={styles.chatAttachMenuLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
