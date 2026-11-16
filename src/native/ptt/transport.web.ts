import type { CreateTransport } from './transport.types';
// El SDK multimedia se descarga al conectar, sin cargarlo durante login/contactos.
export const createRadioTransport: CreateTransport = async (events, _name, isCurrent = () => true) => {
  const { createLiveTransport } = await import('./liveTransport');
  if (!isCurrent()) throw new Error('La conexión se canceló.');
  return createLiveTransport(events, true);
};
