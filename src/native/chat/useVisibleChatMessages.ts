import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AppState, Platform, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent} from 'react-native';
import {chatForeground} from './useChatOutbox';

// Solo confirma burbujas que realmente intersectan la pantalla del chat abierto.
export function useVisibleChatMessages(threadId:string|undefined, enabled:boolean) {
  const bounds=useRef(new Map<string,{y:number;height:number}>());
  const viewport=useRef({y:0,height:0});
  const [ids,setIds]=useState<string[]>([]);
  const calculate=useCallback(()=>{
    const {y,height}=viewport.current;
    const visible=enabled&&chatForeground()?[...bounds.current].filter(([,b])=>
      Math.min(y+height,b.y+b.height)-Math.max(y,b.y)>=Math.min(40,b.height/2)
    ).map(([id])=>id).sort():[];
    setIds(old=>old.join('|')===visible.join('|')?old:visible);
  },[threadId,enabled]);
  useLayoutEffect(()=>{bounds.current.clear();viewport.current={y:0,height:0};setIds([]);},[threadId,enabled]);
  useEffect(()=>{
    const sub=AppState.addEventListener('change',calculate);
    if(Platform.OS==='web')document.addEventListener('visibilitychange',calculate);
    return()=>{sub.remove();if(Platform.OS==='web')document.removeEventListener('visibilitychange',calculate);};
  },[calculate]);
  const onMessageLayout=useCallback((id:string,event:LayoutChangeEvent)=>{bounds.current.set(id,event.nativeEvent.layout);calculate();},[calculate]);
  const onScroll=useCallback((event:NativeSyntheticEvent<NativeScrollEvent>)=>{
    viewport.current={y:event.nativeEvent.contentOffset.y,height:event.nativeEvent.layoutMeasurement.height};calculate();
  },[calculate]);
  const onLayout=useCallback((event:LayoutChangeEvent)=>{viewport.current.height=event.nativeEvent.layout.height;calculate();},[calculate]);
  return {ids,onMessageLayout,onScroll,onLayout};
}
