import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export const NetworkStatusPill: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string>('Wi-Fi');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Detect cellular vs wifi if available
    const nav: any = navigator;
    if (nav.connection) {
      const type = nav.connection.type;
      if (type === 'cellular') setConnectionType('4G/LTE');
      else if (type === 'wifi') setConnectionType('Wi-Fi');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-medium shadow-xs animate-pulse">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Sin conexión (Modo Local)</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300/80 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 text-xs font-medium shadow-xs transition-all hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40"
      title="Conexión encriptada directa con Alwaysdata C5i"
    >
      <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      <span>Conectado ({connectionType})</span>
    </div>
  );
};

export default NetworkStatusPill;
