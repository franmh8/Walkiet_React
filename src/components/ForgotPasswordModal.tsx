import React from 'react';
import { getBackendUrl } from '../services/apiService';
import { SecurityCodeModal } from '../native/profile/SecurityCodeModal';

// La pantalla web alternativa comparte la verificación real; no genera códigos locales.
export function ForgotPasswordModal({isOpen,onClose,onSuccess}:{isOpen:boolean;onClose:()=>void;onSuccess:(identifier:string,message:string)=>void}) {
  return <SecurityCodeModal visible={isOpen} mode="recovery" server={getBackendUrl()} onClose={onClose}
    onComplete={()=>onSuccess('', 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.')} />;
}
