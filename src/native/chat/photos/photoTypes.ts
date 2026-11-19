export interface ChatPhoto {id: string; dataUrl: string;}
export function photoFormat(url: string) {
  const match = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!match || match[2].length > 5500000) return null;
  return {extension: match[1] === 'jpeg' ? 'jpg' : match[1], base64: match[2]};
}
