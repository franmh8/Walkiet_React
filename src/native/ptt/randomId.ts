export const newRadioId = () => {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Abre la app en HTTPS o localhost para conectar la radio.');
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
};
