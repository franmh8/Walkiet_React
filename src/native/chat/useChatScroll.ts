import {useCallback,useLayoutEffect,useRef,useState,type ComponentRef} from 'react';
import type {ScrollView,NativeSyntheticEvent,NativeScrollEvent} from 'react-native';
interface Message {id:string;isSelf:boolean;}
export function useChatScroll(threadId:string|undefined,messages:Message[]){
 const ref=useRef<ComponentRef<typeof ScrollView>>(null);const nearBottom=useRef(true);const pending=useRef(true);const first=useRef(true);
 const previous=useRef({threadId:undefined as string|undefined,count:0,last:''});const frame=useRef<number|null>(null);
 const [unread,setUnread]=useState(0);
 const toEnd=useCallback((animated=true)=>{
  nearBottom.current=true;pending.current=true;setUnread(0);
  if(frame.current!==null)cancelAnimationFrame(frame.current);
  frame.current=requestAnimationFrame(()=>{frame.current=null;ref.current?.scrollToEnd({animated:animated&&!first.current});first.current=false;pending.current=false;});
 },[]);
 const last=messages[messages.length-1];
 useLayoutEffect(()=>{
  const old=previous.current;const changedThread=old.threadId!==threadId;
  if(changedThread){nearBottom.current=true;first.current=true;pending.current=true;setUnread(0);}
  if(threadId&&messages.length&&(changedThread||last?.id!==old.last)){
   if(first.current||nearBottom.current||last?.isSelf)toEnd(!changedThread&&!last?.isSelf);
   else if(messages.length>old.count)setUnread(value=>value+messages.length-old.count);
  }
  previous.current={threadId,count:messages.length,last:last?.id||''};
 },[threadId,messages.length,last?.id,last?.isSelf,toEnd]);
 useLayoutEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
 const onScroll=useCallback((event:NativeSyntheticEvent<NativeScrollEvent>)=>{
  const {contentOffset,contentSize,layoutMeasurement}=event.nativeEvent;
  nearBottom.current=contentSize.height-layoutMeasurement.height-contentOffset.y<=80;
  if(nearBottom.current)setUnread(0);
 },[]);
 const onSize=useCallback(()=>{if(frame.current===null&&(pending.current||nearBottom.current))toEnd(!first.current);},[toEnd]);
 return {ref,onScroll,onSize,toEnd,unread};
}
