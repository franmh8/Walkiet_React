import React from 'react';
import {Text,View} from 'react-native';
import {useAppTheme} from '../profile/AppTheme';
import {chatDayLabel} from './chatDates';
export function ChatDateSeparator({sentAt}:{sentAt?:string|null}){
 const {palette:p}=useAppTheme();const label=chatDayLabel(sentAt);
 return <View style={{alignItems:'center',marginVertical:14}}><Text accessibilityLabel={`Fecha de mensajes: ${label}`} style={{color:p.secondary,backgroundColor:p.input,borderColor:p.border,borderWidth:1,paddingVertical:6,paddingHorizontal:14,borderRadius:12,fontSize:12,fontWeight:'600'}}>{label}</Text></View>;
}
