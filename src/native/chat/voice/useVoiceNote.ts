import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {AppState,Platform} from 'react-native';
import {startVoiceCapture} from './capture';
import {VoiceNoteSession,type VoiceState} from './VoiceNoteSession';
import {stopVoicePlayback} from './voicePlayback';
import type {VoiceClip} from './voiceTypes';
export function useVoiceNote(scope:string,enabled:boolean,send:(clip:VoiceClip)=>Promise<boolean>,beforeRecord:()=>Promise<void>,error:(message:string)=>void){
  const live=useRef({scope,enabled,send,beforeRecord,error});live.current={scope,enabled,send,beforeRecord,error};
  const [state,setState]=useState<VoiceState>({phase:'idle',durationMs:0});
  const session=useMemo(()=>new VoiceNoteSession({
    capture:async valid=>{stopVoicePlayback();await live.current.beforeRecord();if(!valid())throw new Error('Grabación cancelada.');return startVoiceCapture(valid);},
    send:clip=>live.current.scope===scope&&live.current.enabled?live.current.send(clip):Promise.resolve(false),
    state:value=>{if(live.current.scope===scope)setState(value);},
    error:cause=>{if(live.current.scope===scope&&live.current.enabled)live.current.error(cause instanceof Error?cause.message:'No se pudo usar el micrófono.');},
  }),[scope]);
  useLayoutEffect(()=>{setState(session.state);},[session]);
  useEffect(()=>{
    const cancel=()=>{session.cancel();stopVoicePlayback();};
    if(!enabled)cancel();
    const sub=AppState.addEventListener('change',next=>{if(next!=='active')cancel();});
    const visibility=()=>{if(document.hidden)cancel();};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&session.state.phase!=='idle')cancel();};
    if(Platform.OS==='web'){window.addEventListener('blur',cancel);window.addEventListener('pagehide',cancel);window.addEventListener('keydown',escape);document.addEventListener('visibilitychange',visibility);}
    return()=>{cancel();sub.remove();if(Platform.OS==='web'){window.removeEventListener('blur',cancel);window.removeEventListener('pagehide',cancel);window.removeEventListener('keydown',escape);document.removeEventListener('visibilitychange',visibility);}};
  },[session,enabled]);
  return {state,start:()=>{if(live.current.enabled)void session.start();},finish:()=>void session.finish(),cancel:()=>session.cancel(),retry:()=>session.retry()};
}
