export interface PeerPresence {
  id: string; online: boolean; lastSeen: string | null; onlineUntil: number | null;
}
export interface PresenceSnapshot { now: number; peers: PeerPresence[]; }
export function presenceLabel(peer?: PeerPresence, now = Date.now()): string {
  if (!peer) return 'Estado no disponible';
  if (peer.online && peer.onlineUntil !== null && peer.onlineUntil > now) return 'en línea';
  if (!peer.lastSeen) return 'desconectado';
  const date = new Date(peer.lastSeen);
  if (!Number.isFinite(date.getTime())) return 'desconectado';
  const today = new Date(now); const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const time = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const sameDay = (other: Date) => date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth() && date.getDate() === other.getDate();
  return `últ. vez ${sameDay(today) ? 'hoy' : sameDay(yesterday) ? 'ayer' : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} a las ${time}`;
}
