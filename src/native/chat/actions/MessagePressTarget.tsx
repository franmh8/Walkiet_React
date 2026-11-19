import React,{useEffect,useRef} from 'react';
import {View} from 'react-native';
import type {MessagePressTargetProps} from './MessagePressTarget.types';
export function MessagePressTarget(p:MessagePressTargetProps){
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),point=useRef({x:0,y:0}),live=useRef(p);live.current=p;
  const cancel=()=>clearTimeout(timer.current);
  useEffect(()=>{if(p.disabled)cancel();return cancel;},[p.disabled]);
  return <View style={p.style} onTouchStart={event=>{cancel();if(live.current.disabled||event.nativeEvent.touches.length!==1)return;point.current={x:event.nativeEvent.pageX,y:event.nativeEvent.pageY};timer.current=setTimeout(()=>{if(!live.current.disabled)live.current.onOpen(point.current);},450);}}
    onTouchMove={event=>{if(Math.hypot(event.nativeEvent.pageX-point.current.x,event.nativeEvent.pageY-point.current.y)>10)cancel();}} onTouchEnd={cancel} onTouchCancel={cancel}>{p.children}</View>;
}
