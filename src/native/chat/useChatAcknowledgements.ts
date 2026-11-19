import {useEffect, useRef} from 'react';
import type {createChatSyncApi} from '../../services/chatSyncApi';
import {chatForeground} from './useChatOutbox';
import {startChatPolling} from './chatPoller';
import {watchChatWake} from './chatWake';
type Api=ReturnType<typeof createChatSyncApi>;
export function useChatAcknowledgements(api:Api|null, threadId:string|undefined, visibleIds:string[], readReceipts:boolean) {
  const visible=useRef(visibleIds);visible.current=visibleIds;
  const enabled=useRef(readReceipts);enabled.current=readReceipts;
  // Recepción en cualquier pestaña de la app; el servidor solo marca después
  // de que este dispositivo obtiene y valida la respuesta completa.
  useEffect(()=>{
    if(!api)return;
    let disposed=false,running=false;
    const poll=async()=>{
      if(disposed||running||!chatForeground()||!api.supportsReceipts)return;
      running=true;
      try{
        const incoming=await api.inbox();
        if(disposed||!chatForeground())return;
        const groups=new Map<string,string[]>();
        for(const message of incoming)if(message.thread_id)groups.set(message.thread_id,[...(groups.get(message.thread_id)||[]),message.id]);
        for(const [thread,ids] of groups){if(disposed||!chatForeground())break;await api.acknowledge(thread,ids);}
      }catch{return false;}finally{running=false;}
    };
    const poller=startChatPolling(poll,chatForeground,1500),unwatch=watchChatWake(poller.wake);
    return()=>{disposed=true;poller.stop();unwatch();};
  },[api]);
  const key=visibleIds.join('|');
  useEffect(()=>{
    if(!api||!threadId||!readReceipts)return;
    let disposed=false,running=false;const confirmed=new Set<string>();
    const read=async()=>{
      if(disposed||running||!chatForeground()||!enabled.current||!api.supportsReceipts)return;
      const ids=visible.current.filter(id=>!confirmed.has(id)).slice(0,100);
      if(!ids.length)return;running=true;
      try{const response=await api.acknowledge(threadId,ids,true);if(response.read_recorded)ids.forEach(id=>confirmed.add(id));}catch{}finally{running=false;}
    };
    const delay=setTimeout(()=>void read(),400);const timer=setInterval(()=>void read(),4000);
    return()=>{disposed=true;clearTimeout(delay);clearInterval(timer);};
  },[api,threadId,key,readReceipts]);
}
