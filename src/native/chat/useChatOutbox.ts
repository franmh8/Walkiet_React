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
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let disposed=false,running=false;
    setState({scope,entries:[]});setError(null);
    if(!userId||!api)return;
    const refresh=async()=>{
      const entries=await store.list();
      if(!disposed)setState(old=>old.scope===scope&&JSON.stringify(old.entries)===JSON.stringify(entries)?old:{scope,entries});
      return entries;
    };
    const flush=async()=>{
      if(disposed||running)return;running=true;
      try{
        const entries=await refresh();
        if(!chatForeground() || (Platform.OS==='web' && typeof navigator!=='undefined' && !navigator.onLine))return;
        if(!entries.some(entry=>!entry.failure))return;
        if(!api.supportsIdempotentSend)await api.listThreads();
        if(!api.supportsIdempotentSend){setError('Publica la actualización de chat-sync.php para enviar los mensajes pendientes sin duplicarlos.');return;}
        for(const entry of entries){
          if(disposed||!chatForeground())break;
          if(entry.failure)continue;
          try{
            const saved=await api.sendMessage(entry.threadId,entry.mediaType,entry.text,entry.mediaUrl,entry.fileName,entry.clientId);
            // Conservar la cola hasta tener una confirmación válida y durable.
            await store.remove(entry.clientId);
            if(!disposed){sent.current(entry,saved);setError(null);}
          }catch(cause){
            if(cause instanceof ChatApiError && [400,403,404,409,413,422].includes(cause.status)) {
              await store.put({...entry,failure:cause.message});
            }else break; // Internet, timeout, 5xx o sesión: conservar para reintentar.
          }
        }
        await refresh();
      }catch{if(!disposed)setError('No se pudo acceder a los envíos pendientes en este dispositivo.');}
      finally{running=false;}
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
    async retry(clientId:string){
      const entry=(await store.list()).find(item=>item.clientId===clientId);
      if(entry&&active.current===scope){await store.put({...entry,failure:undefined});setState({scope,entries:await store.list()});wake.current();}
    },
  };
}
