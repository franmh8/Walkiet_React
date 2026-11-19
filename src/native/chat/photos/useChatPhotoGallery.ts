import {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {PhotoSaveQueue} from './PhotoSaveQueue';
import {galleryAvailable, savePhoto} from './gallerySave';
import type {ChatPhoto} from './photoTypes';
import type {ChatMessageDto} from '../../../services/chatSyncApi';
export function useChatPhotoGallery(server: string, userId: string, ready: boolean, enabled: boolean, onError: (message: string) => void) {
  const scope = JSON.stringify([server.replace(/\/+$/, ''), userId]);
  const current = useRef({scope, enabled, ready}); current.current = {scope, enabled, ready};
  const report = useRef(onError); report.current = onError;
  const warned = useRef('');
  const queue = useMemo(() => {
    const key = 'walkiet_gallery_saved_v1:' + encodeURIComponent(scope);
    return new PhotoSaveQueue({
      load: async () => {const raw = await AsyncStorage.getItem(key); const ids = raw ? JSON.parse(raw) : []; if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) throw new Error('No se pudo leer el registro de fotos guardadas.'); return ids;},
      remember: ids => AsyncStorage.setItem(key, JSON.stringify(ids)),
      save: (photo, allowed) => savePhoto(photo, () => allowed() && current.current.scope === scope && current.current.enabled),
      error: cause => {if (current.current.scope === scope && warned.current !== scope) {warned.current = scope; report.current(cause instanceof Error ? cause.message : 'No se pudo guardar una foto en la galería. Puedes intentarlo desde el visor.');}},
    });
  }, [scope]);
  useLayoutEffect(() => {queue.configure(galleryAvailable && userId ? ready ? enabled : null : false);}, [queue, ready, enabled, userId]);
  useEffect(() => {queue.resume();return () => queue.dispose();}, [queue]);
  return {
    receive: (messages: ChatMessageDto[]) => {if (current.current.scope !== scope) return; for (const message of messages) if (message.mediaType === 'image' && message.mediaUrl) queue.enqueue({id: message.id, dataUrl: message.mediaUrl});},
    captured: (photo: ChatPhoto) => {if (current.current.scope === scope) queue.enqueue(photo);},
    saveManually: (photo: ChatPhoto) => savePhoto(photo, () => current.current.scope === scope && !!userId, true),
  };
}
