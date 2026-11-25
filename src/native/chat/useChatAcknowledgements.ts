import {useEffect, useRef} from 'react';
import type {ChatMessageDto, createChatSyncApi} from '../../services/chatSyncApi';
import {chatForeground} from './useChatOutbox';
import {startChatPolling} from './chatPoller';
import {watchChatWake} from './chatWake';
type Api=ReturnType<typeof createChatSyncApi>;
export function useChatAcknowledgements(api:Api|null, threadId:string|undefined, visibleIds:string[], readReceipts:boolean, onIncoming?: (messages: ChatMessageDto[]) => void, onNewIncoming?: () => void) {
  const receive=useRef(onIncoming);receive.current=onIncoming;
  const alert=useRef(onNewIncoming);alert.current=onNewIncoming;
  const currentApi=useRef(api);currentApi.current=api;
  const visible=useRef(visibleIds);visible.current=visibleIds;
  // El visto privado se registra aunque las palomitas públicas estén desactivadas.
  // Recepción en cualquier pestaña de la app; el servidor solo marca después
  // de que este dispositivo obtiene y valida la respuesta completa.
  useEffect(()=>{
    if(!api)return;
    let disposed=false,running=false,primed=false;
    const received=new Set<string>();
    const poll=async()=>{
      if(disposed||running||!chatForeground()||!api.supportsReceipts)return;
      running=true;
      try{
        const incoming=await api.inbox();
        if(disposed||currentApi.current!==api||!chatForeground())return;
        receive.current?.(incoming);
        // La primera respuesta establece el historial pendiente, sin hacerlo sonar.
        const fresh=incoming.some(message=>!received.has(message.id));
        for(const message of incoming)received.add(message.id);
        while(received.size>1000)received.delete(received.values().next().value!);
        if(primed&&fresh)alert.current?.();
        primed=true;
        const groups=new Map<string,string[]>();
        for(const message of incoming)if(message.thread_id)groups.set(message.thread_id,[...(groups.get(message.thread_id)||[]),message.id]);
        for(const [thread,ids] of groups){if(disposed||currentApi.current!==api||!chatForeground())break;await api.acknowledge(thread,ids);}
      }catch{return false;}finally{running=false;}
    };
    const poller=startChatPolling(poll,chatForeground,1500),unwatch=watchChatWake(poller.wake);
    return()=>{disposed=true;poller.stop();unwatch();};
  },[api]);
  const key=visibleIds.join('|');
  useEffect(()=>{
    if(!api||!threadId)return;
    let disposed=false,running=false;const confirmed=new Set<string>();
    const read=async()=>{
      if(disposed||running||!chatForeground()||!api.supportsReceipts)return;
      const ids=visible.current.filter(id=>!confirmed.has(id)).slice(0,100);
      if(!ids.length)return;running=true;
      try{const response=await api.acknowledge(threadId,ids,true);if(response.seen_recorded)ids.forEach(id=>confirmed.add(id));}catch{}finally{running=false;}
    };
    const delay=setTimeout(()=>void read(),400);const timer=setInterval(()=>void read(),4000);
    return()=>{disposed=true;clearTimeout(delay);clearInterval(timer);};
  },[api,threadId,key,readReceipts]);
}
