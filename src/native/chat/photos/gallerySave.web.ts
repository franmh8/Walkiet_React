import {photoFormat, type ChatPhoto} from './photoTypes';
export const galleryAvailable = false;
export async function savePhoto(photo: ChatPhoto, allowed: () => boolean, manual = false): Promise<boolean> {
  if (!manual || !allowed()) return false;
  const data = photoFormat(photo.dataUrl);
  if (!data) throw new Error('Esta imagen no se puede descargar.');
  const link = document.createElement('a'); link.href = photo.dataUrl;
  link.download = 'foto-chat.' + data.extension; document.body.appendChild(link); link.click(); link.remove();
  return true;
}
