import React,{useRef} from 'react';
import {View} from 'react-native';
import type {VoiceRecordButtonProps} from './VoiceRecordButton.types';
export function VoiceRecordButton(p:VoiceRecordButtonProps){
  const pointer=useRef<number|null>(null);
  return <View style={p.style}><button type="button" aria-label="Enviar nota de voz" aria-pressed={p.recording} disabled={p.disabled}
    style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',border:0,borderRadius:'50%',background:'transparent',padding:0,touchAction:'none',userSelect:'none',cursor:p.disabled?'wait':'pointer'}}
    onContextMenu={e=>e.preventDefault()}
    onPointerDown={e=>{if(e.button!==0||pointer.current!==null)return;pointer.current=e.pointerId;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);p.start();}}
    onPointerUp={e=>{if(pointer.current!==e.pointerId)return;pointer.current=null;p.finish();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={()=>{pointer.current=null;p.cancel();}} onLostPointerCapture={()=>{if(pointer.current!==null){pointer.current=null;p.cancel();}}}
    onKeyDown={e=>{if(e.key==='Escape'){p.cancel();return;}if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)p.start();}}}
    onKeyUp={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();p.finish();}}}>
    {p.children}
  </button></View>;
}
