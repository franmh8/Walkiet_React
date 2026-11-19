import {useEffect, useMemo, useRef, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, Platform} from 'react-native';
import {ChatApiError, type createChatSyncApi} from '../../services/chatSyncApi';
import {createChatOutbox, type OutboxEntry} from './chatOutbox';

export function chatForeground() {
  return (!AppState.currentState || AppState.currentState === 'active') &&
    (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden);
}
type Api = ReturnType<typeof createChatSyncApi>;
type Saved = Awaited<ReturnType<Api['sendMessage']>>;
export function useChatOutbox(server: string, userId: string, api: Api|null, onSent: (entry: OutboxEntry, saved: Saved) => void) {
  const scope=JSON.stringify([server,userId]);
  const store=useMemo(()=>createChatOutbox(AsyncStorage,server,userId),[scope]);
  const [state,setState]=useState<{scope:string;entries:OutboxEntry[]}>({scope,entries:[]});
  const sent=useRef(onSent); sent.current=onSent;
  const wake=useRef<()=>void>(()=>{});
  const active=useRef(scope);active.current=scope;
  const sending=useRef<{scope:string;id:string}|null>(null),cancelled=useRef(new Set<string>());
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let disposed=false,running=false,queuedWake=false;
    setState({scope,entries:[]});setError(null);
    if(!userId||!api)return;
    const refresh=async()=>{
      const entries=await store.list();
      if(!disposed)setState(old=>old.scope===scope&&old.entries.length===entries.length&&old.entries.every((entry,i)=>entry.clientId===entries[i].clientId&&entry.failure===entries[i].failure)?old:{scope,entries});
      return entries;
    };
    const flush=async()=>{
      if(disposed)return;if(running){queuedWake=true;return;}running=true;
      try{
        const entries=await refresh();
        if(!chatForeground() || (Platform.OS==='web' && typeof navigator!=='undefined' && !navigator.onLine))return;
        if(!entries.some(entry=>!entry.failure))return;
        if(!api.supportsIdempotentSend)await api.listThreads();
        if(!api.supportsIdempotentSend){setError('Publica la actualización de chat-sync.php para enviar los mensajes pendientes sin duplicarlos.');return;}
        for(const entry of entries){
          if(disposed||!chatForeground())break;
          if(entry.failure||cancelled.current.has(scope+'|'+entry.clientId))continue;
          sending.current={scope,id:entry.clientId};
          try{
            const saved=await api.sendMessage(entry.threadId,entry.mediaType,entry.text,entry.mediaUrl,entry.fileName,entry.clientId,{replyToId:entry.replyToId,sourceMessageId:entry.sourceMessageId});
            // Conservar la cola hasta tener una confirmación válida y durable.
            await store.remove(entry.clientId);
            if(!disposed&&active.current===scope){sent.current(entry,saved);setError(null);}
          }catch(cause){
            if(cause instanceof ChatApiError && [400,403,404,409,413,422].includes(cause.status)) {
              await store.put({...entry,failure:cause.message});
            }else break; // Internet, timeout, 5xx o sesión: conservar para reintentar.
          }finally{if(sending.current?.scope===scope&&sending.current.id===entry.clientId)sending.current=null;}
        }
        await refresh();
      }catch{if(!disposed)setError('No se pudo acceder a los envíos pendientes en este dispositivo.');}
      finally{running=false;if(queuedWake&&!disposed){queuedWake=false;void flush();}}
    };
    wake.current=()=>void flush();void flush();
    const timer=setInterval(()=>void flush(),5000);
    const sub=AppState.addEventListener('change',()=>void flush());
    const listener=()=>void flush();
    if(Platform.OS==='web'){window.addEventListener('online',listener);window.addEventListener('storage',listener);document.addEventListener('visibilitychange',listener);}
    return()=>{disposed=true;wake.current=()=>{};clearInterval(timer);sub.remove();if(Platform.OS==='web'){window.removeEventListener('online',listener);window.removeEventListener('storage',listener);document.removeEventListener('visibilitychange',listener);}};
  },[scope,api,store,userId]);
  return {
    entries:state.scope===scope?state.entries:[],error,
    async enqueue(entry:OutboxEntry){
      if(!userId||active.current!==scope)throw new Error('La sesión cambió.');
      if((await store.list()).length>=30)throw new Error('Tienes 30 mensajes pendientes. Conéctate para enviarlos antes de agregar más.');
      await store.put(entry);
      if(active.current===scope){setState({scope,entries:await store.list()});wake.current();}
    },
    async cancel(clientId:string){
      if(active.current!==scope)throw new Error('La sesión cambió.');
      const exists=(await store.list()).some(entry=>entry.clientId===clientId);
      if(active.current!==scope)throw new Error('La sesión cambió.');
      if(!exists||(sending.current?.scope===scope&&sending.current.id===clientId))return false;
      cancelled.current.add(scope+'|'+clientId);if(cancelled.current.size>500)cancelled.current.delete(cancelled.current.values().next().value!);
      await store.remove(clientId);if(active.current===scope)setState({scope,entries:await store.list()});return true;
    },
    async retry(clientId:string){
      const entry=(await store.list()).find(item=>item.clientId===clientId);
      if(entry&&active.current===scope){await store.put({...entry,failure:undefined});setState({scope,entries:await store.list()});wake.current();}
    },
  };
}
