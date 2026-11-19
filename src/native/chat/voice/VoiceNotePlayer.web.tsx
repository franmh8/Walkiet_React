import React,{useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {isVoiceData} from './voiceTypes';
import {registerVoicePlayback,stopVoicePlayback} from './voicePlayback';
import type {VoiceNotePlayerProps} from './VoiceNotePlayer.types';
export function VoiceNotePlayer(p:VoiceNotePlayerProps){
  const ref=useRef<HTMLAudioElement>(null);const [error,setError]=useState(false);const permit=useRef(false);const version=useRef(0);const enabled=useRef(p.enabled);enabled.current=p.enabled;
  useEffect(()=>{const audio=ref.current;const unregister=registerVoicePlayback(()=>{++version.current;audio?.pause();permit.current=false;});return()=>{unregister();++version.current;audio?.pause();};},[p.dataUrl]);
  useEffect(()=>{if(!p.enabled){++version.current;ref.current?.pause();}return()=>{ref.current?.pause();};},[p.enabled]);
  const valid=isVoiceData(p.dataUrl),color=p.isSelf?'#ffffff':'#0f172a';
  return <View testID="voice-note-player" style={{width:240,maxWidth:'100%',gap:6}}>
    <Text style={{color,fontSize:13,fontWeight:'600'}}>{p.label}</Text>
    {valid?<audio ref={ref} aria-label="Reproducir nota de voz" controls preload="metadata" src={p.dataUrl} style={{width:'100%',height:38}}
      onPlay={async()=>{const audio=ref.current;if(!audio)return;if(!p.enabled){audio.pause();return;}if(permit.current){permit.current=false;return;}audio.pause();stopVoicePlayback();const current=version.current;try{await p.beforePlay();if(version.current!==current||!enabled.current||!audio.isConnected)return;permit.current=true;await audio.play();setError(false);}catch{permit.current=false;setError(true);} }}
      onEnded={()=>{permit.current=false;}} onError={()=>setError(true)}/>:<Text style={{color,fontSize:12}}>Audio no disponible en este mensaje anterior.</Text>}
    {error&&<Text accessibilityRole="alert" style={{color,fontSize:12}}>No se pudo reproducir el audio. Vuelve a intentarlo.</Text>}
  </View>;
}
