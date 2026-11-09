import { useCallback, useState } from 'react';
export function useRadioNotifications(_server: string, _token: string, _userId: string, _onOpen: (channelId: string) => void) {
  const [error, setError] = useState<string | null>(null);
  const enable = useCallback(async () => { setError('Los avisos en segundo plano se activan desde la app instalada en el teléfono.'); }, []);
  return { enabled: false, busy: false, available: false, error, enable };
}
export type RadioNotifications = ReturnType<typeof useRadioNotifications>;
