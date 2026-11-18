import React from 'react';
import { Text, View } from 'react-native';
import { CheckIcon, DoubleCheckIcon } from '../icons';
export type MessageStatus = 'pending' | 'failed' | 'sent' | 'delivered' | 'read';
export function MessageReceipt({status, compact=false}: {status: MessageStatus; compact?: boolean}) {
  const label = {pending:'Pendiente de envío',failed:'No enviado. Toca para reintentar',sent:'Enviado',delivered:'Entregado',read:'Leído'}[status];
  const color = status === 'read' ? (compact ? '#059669' : '#86efac') : (compact ? '#64748b' : '#cbd5e1');
  return <View accessibilityLabel={label} testID={`message-status-${status}`} accessible style={{flexDirection:'row',alignItems:'center'}}>
    {status === 'pending' || status === 'failed'
      ? <Text style={{color,fontSize:10}}>{status === 'pending' ? '◷' : '!'}{!compact && ` ${status === 'failed' ? 'No enviado · Reintentar' : label}`}</Text>
      : status === 'sent' ? <CheckIcon size={13} color={color}/> : <DoubleCheckIcon size={13} color={color}/>}
  </View>;
}
