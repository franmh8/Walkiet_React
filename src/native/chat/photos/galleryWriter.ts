import {photoFormat, type ChatPhoto} from './photoTypes';
interface PhotoPermission {granted: boolean; canAskAgain: boolean;}
export function createGalleryWriter(io: {
  permissions: (request: boolean) => Promise<PhotoPermission>;
  temporary: (extension: string) => string;
  write: (uri: string, base64: string) => Promise<void>;
  save: (uri: string) => Promise<void>;
  remove: (uri: string) => Promise<void>;
}) {
  let denied = false;
  return async (photo: ChatPhoto, allowed: () => boolean, manual = false): Promise<boolean> => {
    const data = photoFormat(photo.dataUrl);
    if (!data) throw new Error('Esta imagen no se puede guardar en Fotos.');
    if (!allowed()) return false;
    let permission = await io.permissions(false);
    if (!permission.granted && permission.canAskAgain && (!denied || manual)) permission = await io.permissions(true);
    if (!allowed()) return false;
    if (!permission.granted) {denied = true; throw new Error('Autoriza guardar fotos en los ajustes del teléfono. El mensaje sigue disponible en el chat.');}
    denied = false;
    const uri = io.temporary(data.extension);
    try {
      await io.write(uri, data.base64);
      if (!allowed()) return false;
      await io.save(uri);
      return true;
    } finally {await io.remove(uri).catch(() => {});}
  };
}
