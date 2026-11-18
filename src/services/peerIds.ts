// PHP puede devolver IDs numéricos; las APIs privadas usan cadenas canónicas.
export function peerId(value: unknown): string | null {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) return null;
  const id = String(value).trim();
  return id && id.length <= 128 && !/[\x00-\x1f\x7f]/.test(id) ? id : null;
}
export function peerIds(values: readonly unknown[]): string[] {
  return [...new Set(values.map(peerId).filter((id): id is string => id !== null))];
}
