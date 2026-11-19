export interface OutboxEntry {
  clientId: string;
  serverId?: string;
  threadId: string;
  conversation: { id: string; type: 'direct' | 'group'; name: string; targetUserId?: string };
  text: string;
  mediaType: 'text' | 'image' | 'voice' | 'location' | 'document';
  mediaUrl?: string;
  fileName?: string;
  saveImage?: boolean;
  queuedAt: string;
  failure?: string;
}
interface Storage {
  getAllKeys(): Promise<readonly string[]>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
// Una clave por mensaje evita que dos ventanas sobrescriban la cola completa.
// Nunca guarda el token y solo enumera los mensajes de esta cuenta/servidor.
export function createChatOutbox(storage: Storage, server: string, userId: string) {
  const prefix = 'walkiet_outbox_v1:' + encodeURIComponent(JSON.stringify([server.replace(/\/+$/, ''), userId])) + ':';
  const key = (id: string) => prefix + id;
  return {
    async list(): Promise<OutboxEntry[]> {
      const keys = (await storage.getAllKeys()).filter(value => value.startsWith(prefix));
      const entries = await Promise.all(keys.map(async item => {
        const raw = await storage.getItem(item);
        if (!raw) return null;
        const entry = JSON.parse(raw) as OutboxEntry;
        if (key(entry.clientId) !== item || !entry.threadId || !entry.queuedAt) throw new Error('No se pudo leer un envío pendiente.');
        return entry;
      }));
      return entries.filter((entry): entry is OutboxEntry => !!entry).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.clientId.localeCompare(b.clientId));
    },
    async put(entry: OutboxEntry) {
      // AsyncStorage se usa directamente: un fallo de disco no debe aparentar
      // que un mensaje quedó guardado cuando solo existe en memoria.
      await storage.setItem(key(entry.clientId), JSON.stringify(entry));
    },
    remove: (id: string) => storage.removeItem(key(id)),
  };
}
