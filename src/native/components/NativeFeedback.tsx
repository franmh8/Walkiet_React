import React, { useCallback, useRef, useState } from 'react';
import type { AlertButton } from 'react-native';
import { TrashIcon } from '../icons';
import { useAppTheme } from '../profile/AppTheme';
import { DialogAction, TacticalDialog, type DialogTone } from './TacticalDialog';

type AlertType = 'confirm_delete' | 'warning' | 'info' | 'success' | 'danger';
interface AlertOptions {
  type?: AlertType; confirmText?: string; cancelText?: string | null;
  onConfirm?: () => void; onCancel?: () => void;
}
interface Notice extends AlertOptions { buttons?: AlertButton[]; isOpen: boolean; title: string; message: string; }
export function useNativeFeedback(isBusy = false) {
  const { palette } = useAppTheme();
  const [notice, setNotice] = useState<Notice>({ isOpen: false, title: '', message: '', type: 'info' });
  const confirming = useRef(false);
  const closeAlert = useCallback(() => { confirming.current = false; setNotice(previous => ({ ...previous, isOpen: false })); }, []);
  const showTacticalAlert = useCallback((title: string, message: string, options: AlertOptions = {}) => {
    confirming.current = false;
    setNotice({ ...options, isOpen: true, title, message, type: options.type || 'info',
      confirmText: options.confirmText || (options.onConfirm ? 'Confirmar' : 'Entendido'),
      cancelText: options.cancelText === null ? undefined : options.cancelText || (options.onConfirm ? 'Cancelar' : undefined) });
  }, []);
  // Los avisos breves usan la misma tarjeta y permanecen hasta que se leen.
  const showTacticalToast = useCallback((message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    showTacticalAlert(type === 'success' ? 'Listo' : type === 'warning' ? 'Atención' : 'Información', message, { type });
  }, [showTacticalAlert]);
  const showNativeAlert = useCallback((title: string, message = '', buttons?: AlertButton[]) => {
    const cancel = buttons?.find(button => button.style === 'cancel');
    const actions = buttons?.filter(button => button.style !== 'cancel') || [];
    if(actions.length>1){confirming.current=false;setNotice({isOpen:true,title,message,type:'info',buttons});return;}
    const action = actions[actions.length - 1];
    const type: AlertType = action?.style === 'destructive' ? 'danger' : /error|no se pudo|demasiado|permiso/i.test(title) ? 'warning' : 'info';
    showTacticalAlert(title, message, { type, confirmText: action?.text || 'Entendido', cancelText: cancel?.text || null,
      onCancel: () => { cancel?.onPress?.(); }, ...(action?.onPress ? { onConfirm: () => { closeAlert(); action.onPress?.(); } } : {}) });
  }, [showTacticalAlert, closeAlert]);
  const cancel = () => { if (!isBusy) { notice.buttons?.find(button=>button.style==='cancel')?.onPress?.();notice.onCancel?.(); closeAlert(); } };
  const tone: DialogTone = notice.type === 'confirm_delete' ? 'danger' : notice.type || 'info';
  // Montar al abrir sitúa el aviso por encima de otros Modal ya presentados.
  const feedback = notice.isOpen ? <TacticalDialog visible title={notice.title} description={notice.message} tone={tone}
    icon={notice.type === 'confirm_delete' ? <TrashIcon size={30} color={palette.danger} /> : undefined}
    onClose={cancel} busy={isBusy}>
    {notice.buttons?notice.buttons.map((button,index)=><DialogAction key={index} label={button.text||'Continuar'} accessibilityLabel={button.text||'Continuar'} danger={button.style==='destructive'} secondary={button.style==='cancel'} disabled={isBusy} onPress={()=>{if(isBusy||confirming.current)return;confirming.current=true;closeAlert();button.onPress?.();}}/>):<>
    <DialogAction label={notice.confirmText || 'Entendido'} danger={tone === 'danger'} busy={isBusy}
      accessibilityLabel={notice.onConfirm ? 'Confirmar acción' : notice.confirmText || 'Entendido'} busyLabel={notice.type === 'confirm_delete' ? 'Eliminando…' : 'Procesando…'}
      onPress={() => {
        if (isBusy || confirming.current) return;
        if (notice.onConfirm) { confirming.current = true; notice.onConfirm(); }
        else closeAlert();
      }} />
    {notice.cancelText && <DialogAction label={notice.cancelText} secondary disabled={isBusy} onPress={cancel} />}
    </>}
  </TacticalDialog> : null;
  return { showTacticalAlert, showTacticalToast, showNativeAlert, closeAlert, feedback };
}
