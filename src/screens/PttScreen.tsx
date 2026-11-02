import React, { useState } from 'react';
import { RadioMainScreen } from '../components/RadioMainScreen';
import { SosAlertModal } from '../components/SosAlertModal';
import { useRadio } from '../context/RadioContext';

interface PttScreenProps {
  onNavigateTab: (tab: string) => void;
}

export function PttScreen({ onNavigateTab }: PttScreenProps) {
  const { activeChannel } = useRadio();
  const [sosModalVisible, setSosModalVisible] = useState(false);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <RadioMainScreen
        onOpenChannels={() => onNavigateTab('Grupos')}
        onOpenContacts={() => onNavigateTab('Contactos')}
        onOpenChat={() => onNavigateTab('Chat')}
        onOpenProfile={() => onNavigateTab('Perfil')}
        onOpenSosModal={() => setSosModalVisible(true)}
      />

      <SosAlertModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        channelId={activeChannel?.id}
        channelName={activeChannel?.name}
      />
    </div>
  );
}

export default PttScreen;
