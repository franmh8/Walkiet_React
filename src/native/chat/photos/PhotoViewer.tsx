import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Modal, Platform, Pressable, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PhotoCanvas} from './PhotoCanvas';
import type {ChatPhoto} from './photoTypes';
export function PhotoViewer({photo, close, save}: {photo: ChatPhoto | null; close: () => void; save: (photo: ChatPhoto) => Promise<boolean>}) {
  const {width, height} = useWindowDimensions(), insets = useSafeAreaInsets();
  const [zoom, setZoom] = useState(1), [saving, setSaving] = useState(false), [notice, setNotice] = useState('');
  const currentPhoto = useRef(photo?.id); currentPhoto.current = photo?.id;
  useEffect(() => {setZoom(1); setNotice(''); setSaving(false);}, [photo?.id]);
  useEffect(() => {if (Platform.OS !== 'web' || !photo) return; const key = (event: KeyboardEvent) => {if (event.key === 'Escape') close();}; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);}, [photo, close]);
  const button = (label: string, text: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={action} style={{minWidth: 42, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1}}><Text style={{color: '#fff', fontSize: 17, fontWeight: '600'}}>{text}</Text></Pressable>;
  return <Modal visible={!!photo} animationType="fade" onRequestClose={close} statusBarTranslucent>
    <View accessibilityViewIsModal testID="photo-viewer" style={{flex: 1, backgroundColor: '#080b10', paddingTop: insets.top, paddingBottom: insets.bottom}}>
      <View style={{height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6}}>
        {button('Cerrar imagen', '✕', close)}<Text style={{color: '#fff', flex: 1, fontWeight: '600', fontSize: 14}}>Imagen</Text>
        {saving ? <ActivityIndicator color="#fff"/> : button(Platform.OS === 'web' ? 'Descargar imagen' : 'Guardar imagen en Fotos', Platform.OS === 'web' ? 'Descargar' : 'Guardar', () => {if (!photo) return; const id = photo.id; setSaving(true); setNotice(''); void save(photo).then(ok => {if (ok && currentPhoto.current === id) setNotice(Platform.OS === 'web' ? 'Descarga iniciada' : 'Foto guardada');}).catch(cause => {if (currentPhoto.current === id) setNotice(cause instanceof Error ? cause.message : 'No se pudo guardar.');}).finally(() => {if (currentPhoto.current === id) setSaving(false);});})}
      </View>
      {photo && <PhotoCanvas key={photo.id} uri={photo.dataUrl} width={width} height={Math.max(100, height - insets.top - insets.bottom - 116)} zoom={zoom} onZoom={setZoom}/>}
      <View style={{height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18}}>
        {button('Alejar imagen', '−', () => setZoom(value => Math.max(1, value - 0.5)), zoom <= 1)}
        {button('Restablecer zoom', `${Math.round(zoom * 100)}%`, () => setZoom(1))}
        {button('Acercar imagen', '+', () => setZoom(value => Math.min(5, value + 0.5)), zoom >= 5)}
      </View>
      {!!notice && <Text accessibilityLiveRegion="polite" style={{position: 'absolute', bottom: insets.bottom + 65, paddingHorizontal: 18, paddingVertical: 10, color: '#fff', backgroundColor: '#222c', alignSelf: 'center', borderRadius: 12}}>{notice}</Text>}
    </View>
  </Modal>;
}
