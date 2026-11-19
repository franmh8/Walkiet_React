import * as FileSystem from 'expo-file-system/legacy';
import {randomUUID} from 'expo-crypto';
import {createGalleryWriter} from './galleryWriter';
export const galleryAvailable = true;
async function mediaLibrary() {
  try {return await import('expo-media-library/legacy');}
  catch {throw new Error('Actualiza la aplicación instalada para guardar fotos en la galería.');}
}
export const savePhoto = createGalleryWriter({
  permissions: async request => {const library = await mediaLibrary(); return request ? library.requestPermissionsAsync(true, ['photo']) : library.getPermissionsAsync(true, ['photo']);},
  temporary: extension => {if (!FileSystem.cacheDirectory) throw new Error('No hay espacio temporal para guardar la foto.'); return FileSystem.cacheDirectory + 'chat-photo-' + randomUUID() + '.' + extension;},
  write: (uri, base64) => FileSystem.writeAsStringAsync(uri, base64, {encoding: FileSystem.EncodingType.Base64}),
  save: async uri => {const library = await mediaLibrary(); await library.saveToLibraryAsync(uri);},
  remove: uri => FileSystem.deleteAsync(uri, {idempotent: true}),
});
