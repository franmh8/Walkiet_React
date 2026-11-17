import React from 'react';
import { RadioMainScreen } from '../components/RadioMainScreen';

interface PttScreenProps {
  onNavigateTab: (tab: string) => void;
}

export function PttScreen({ onNavigateTab }: PttScreenProps) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <RadioMainScreen
        onOpenChannels={() => onNavigateTab('Grupos')}
        onOpenContacts={() => onNavigateTab('Contactos')}
        onOpenChat={() => onNavigateTab('Chat')}
        onOpenProfile={() => onNavigateTab('Perfil')}
      />
    </div>
  );
}

export default PttScreen;
