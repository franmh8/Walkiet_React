export const newRadioId = () => {
  try {
    const { randomUUID } = require('expo-crypto') as typeof import('expo-crypto');
    return randomUUID().replace(/-/g, '');
  } catch { throw new Error('Instala la compilación actualizada de la app para conectar la radio.'); }
};
