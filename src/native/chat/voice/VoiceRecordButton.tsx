import React from 'react';
import {View} from 'react-native';
import type {VoiceRecordButtonProps} from './VoiceRecordButton.types';
export function VoiceRecordButton(p:VoiceRecordButtonProps){
  return <View style={p.style} accessible accessibilityRole="button" accessibilityLabel="Enviar nota de voz"
    accessibilityHint="Mantén presionado para grabar. Suelta para enviar." accessibilityState={{disabled:p.disabled,busy:p.disabled}}
    onStartShouldSetResponder={()=>!p.disabled} onResponderGrant={p.start} onResponderRelease={p.finish}
    onResponderTerminate={p.cancel} onResponderTerminationRequest={()=>false}
    accessibilityActions={[{name:'activate',label:p.recording?'Terminar y enviar audio':'Comenzar grabación'}]}
    onAccessibilityAction={()=>p.recording?p.finish():p.start()}>{p.children}</View>;
}
