import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeftIcon, MapPinIcon } from '../../icons';
import { useAppTheme } from '../../profile/AppTheme';
import { chatLocation, locationTiles } from './chatLocation';

const MAP_HEIGHT = 124;
export function LocationMessageCard({mediaUrl, text, isSelf, visible, onOpen}: {
  mediaUrl?: string; text: string; isSelf: boolean; visible: boolean; onOpen: (url: string) => void;
}) {
  const {palette, dark} = useAppTheme();
  const point = useMemo(() => chatLocation(mediaUrl, text), [mediaUrl, text]);
  const [width, setWidth] = useState(250), [failed, setFailed] = useState(false), [loaded, setLoaded] = useState<string[]>([]);
  useEffect(() => {setFailed(false);setLoaded([]);}, [point?.url]);
  const tiles = useMemo(() => point ? locationTiles(point, width, MAP_HEIGHT) : [], [point, width]);
  const mappable = tiles.length === 4, ready = mappable && loaded.length === 4;
  useEffect(() => {
    if (!visible || !point || !mappable || ready || failed) return;
    const timer = setTimeout(() => setFailed(true), 10000);
    return () => clearTimeout(timer);
  }, [visible, point, mappable, ready, failed]);
  const primary = isSelf ? '#fff' : palette.text, secondary = isSelf ? '#f1cdd7' : palette.muted;
  return <View testID="location-message-card">
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={point ? `Abrir ubicación en mapa, ${point.label}` : 'Ubicación no disponible'}
      disabled={!point} activeOpacity={0.85} onPress={() => {if (point) onOpen(point.url);}}>
      <View testID="location-map-preview" onLayout={event => setWidth(Math.min(256, event.nativeEvent.layout.width))}
        style={[styles.map, {backgroundColor: dark ? '#263447' : '#edf1ed'}]}>
        {visible && point && mappable && !failed && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, {opacity: ready ? 1 : 0}]}>
          {tiles.map(tile => <Image key={tile.key} accessible={false} source={{uri: tile.uri, ...(Platform.OS === 'web' ? {} : {headers: {'User-Agent': 'Walkiet/1.0 (+https://github.com/franmh8/Walkiet_React)'}, cache: 'force-cache' as const})}}
            style={{position: 'absolute', width: 256, height: 256, left: tile.left, top: tile.top}} resizeMode="cover"
            onLoad={() => setLoaded(old => old.includes(tile.key) ? old : [...old, tile.key])} onError={() => setFailed(true)}/>)}
        </View>}
        <View pointerEvents="none" style={styles.pinShadow}/>
        <View pointerEvents="none" style={styles.pin}><MapPinIcon size={34} color="#691c32" strokeWidth={2.5}/></View>
        {(!ready || failed || !point) && <View pointerEvents="none" style={styles.fallback}>
          {visible && point && mappable && !failed && <ActivityIndicator size="small" color={palette.muted}/>}
          <Text style={{fontSize: 10, color: dark ? '#cbd5e1' : '#64748b'}}>{!point ? 'Sin coordenadas' : failed || !mappable ? 'Vista previa no disponible' : 'Cargando mapa…'}</Text>
        </View>}
      </View>
      <View style={styles.details}>
        <View style={styles.heading}><Text numberOfLines={1} style={{color: primary, fontSize: 13, fontWeight: '700', flex: 1}}>{point ? 'Ubicación compartida' : 'Ubicación no disponible'}</Text><View style={{marginLeft: 8, transform: [{rotate: '135deg'}]}}><ArrowLeftIcon size={16} color={secondary}/></View></View>
        {point && <Text numberOfLines={1} style={{color: secondary, fontSize: 11, marginTop: 1}}>{point.label}</Text>}
        {point && <Text style={{color: secondary, fontSize: 11, marginTop: 5}}>Abrir en mapa</Text>}
      </View>
    </TouchableOpacity>
    {ready && !failed && point && visible && <TouchableOpacity accessibilityRole="link" accessibilityLabel="Créditos del mapa de OpenStreetMap"
      onPress={() => {void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {});}}
      style={styles.credit}><Text style={{fontSize: 9, color: '#475569'}}>© OpenStreetMap</Text></TouchableOpacity>}
  </View>;
}
const styles = StyleSheet.create({
  map: {height: MAP_HEIGHT, width: '100%', maxWidth: 256, borderRadius: 12, overflow: 'hidden'},
  pin: {position: 'absolute', left: '50%', top: '50%', marginLeft: -17, marginTop: -33, backgroundColor: '#fffffff0', borderRadius: 20, padding: 3, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3},
  pinShadow: {position: 'absolute', left: '50%', top: '50%', marginLeft: -9, marginTop: 5, width: 24, height: 7, borderRadius: 12, backgroundColor: '#0002'},
  fallback: {position: 'absolute', bottom: 10, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6},
  details: {paddingTop: 7, paddingHorizontal: 7, paddingBottom: 1},
  heading: {flexDirection: 'row', alignItems: 'center'},
  credit: {position: 'absolute', top: MAP_HEIGHT - 17, right: 3, backgroundColor: '#ffffffe8', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1},
});
