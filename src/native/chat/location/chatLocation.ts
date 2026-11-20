export interface ChatLocation { latitude: number; longitude: number; url: string; label: string; }
const coordinate = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
export function chatLocation(mediaUrl?: string, text = ''): ChatLocation | null {
  let pair: string[] | undefined;
  try {
    const url = new URL(mediaUrl || '');
    if (url.protocol === 'https:' && url.hostname === 'www.google.com' && /^\/maps\/?$/.test(url.pathname) && !url.username && !url.password && !url.port) {
      pair = (url.searchParams.get('q') || '').split(',').map(value => value.trim());
    }
  } catch {}
  // Los mensajes anteriores incluían las coordenadas en la leyenda automática.
  if (!pair || pair.length !== 2) pair = text.match(/\[\s*([-+\d.]+)\s*,\s*([-+\d.]+)\s*\]/)?.slice(1);
  if (!pair || pair.length !== 2 || pair.some(value => !coordinate.test(value))) return null;
  const [latitude, longitude] = pair.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, url: `https://www.google.com/maps?q=${latitude},${longitude}`, label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` };
}
// Dos por dos teselas reales, centradas en la coordenada con proyección Web Mercator.
// El ancho visible se limita a 256 px para que nunca quede un hueco en los bordes.
export function locationTiles(point: ChatLocation, width: number, height: number, zoom = 15) {
  if (Math.abs(point.latitude) > 85.05112878) return [];
  const count = 2 ** zoom, latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const radians = latitude * Math.PI / 180;
  const x = (point.longitude + 180) / 360 * count;
  const y = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * count;
  const startX = Math.floor(x - 0.5), startY = Math.floor(y - 0.5);
  return [0, 1].flatMap(row => [0, 1].map(col => {
    const tileX = startX + col, tileY = startY + row;
    return { key: `${tileX}:${tileY}`, uri: `https://tile.openstreetmap.org/${zoom}/${((tileX % count) + count) % count}/${Math.max(0, Math.min(count - 1, tileY))}.png`,
      left: (tileX - x) * 256 + Math.min(256, width) / 2, top: (tileY - y) * 256 + height / 2 };
  }));
}
