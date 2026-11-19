import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Text,TouchableOpacity,View} from 'react-native';
import {useAudioPlayer,useAudioPlayerStatus,setAudioModeAsync} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import {randomUUID} from 'expo-crypto';
import {isVoiceData,voiceTime} from './voiceTypes';
import {registerVoicePlayback,stopVoicePlayback} from './voicePlayback';
import type {VoiceNotePlayerProps} from './VoiceNotePlayer.types';
// Expo can release the native player before React runs effect cleanup.
function pause(player:{pause:()=>void}){try{player.pause();}catch{}}
function NativePlayer(p:VoiceNotePlayerProps){
  const player=useAudioPlayer(null,{updateInterval:250});const status=useAudioPlayerStatus(player);
  const file=useRef<string|null>(null),mounted=useRef(true),version=useRef(0),busy=useRef(false);
  const [loading,setLoading]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{mounted.current=true;const unregister=registerVoicePlayback(()=>{++version.current;pause(player);});return()=>{mounted.current=false;++version.current;unregister();pause(player);if(file.current)void FileSystem.deleteAsync(file.current,{idempotent:true}).catch(()=>{});};},[player]);
  useEffect(()=>{if(!p.enabled){++version.current;pause(player);}},[p.enabled,player]);
  const play=async()=>{
    if(!p.enabled||busy.current)return;if(status.playing){player.pause();return;}
    stopVoicePlayback();const current=version.current;busy.current=true;setLoading(true);setError(false);
    try{
      await p.beforePlay();if(!mounted.current||version.current!==current)return;await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true,shouldPlayInBackground:false,shouldRouteThroughEarpiece:false});
      if(!file.current){
        if(!FileSystem.cacheDirectory)throw new Error('No hay espacio temporal disponible para el audio.');
        const extension=p.dataUrl!.startsWith('data:audio/wav')?'wav':'m4a';
        const uri=FileSystem.cacheDirectory+'chat-voice-'+randomUUID()+'.'+extension;
        await FileSystem.writeAsStringAsync(uri,p.dataUrl!.split(',')[1],{encoding:FileSystem.EncodingType.Base64});
        if(!mounted.current){await FileSystem.deleteAsync(uri,{idempotent:true});return;}file.current=uri;player.replace({uri});
      }
      if(!mounted.current||version.current!==current)return;
      if(status.didJustFinish||status.duration>0&&status.currentTime>=status.duration)await player.seekTo(0);
      player.play();
    }catch{if(mounted.current)setError(true);}finally{busy.current=false;if(mounted.current)setLoading(false);}
  };
  const color=p.isSelf?'#ffffff':'#0f172a';
  return <View testID="voice-note-player" style={{width:220,maxWidth:'100%',gap:6}}>
    <Text style={{color,fontSize:13,fontWeight:'600'}}>{p.label}</Text>
    <TouchableOpacity accessibilityLabel={status.playing?'Pausar nota de voz':'Reproducir nota de voz'} disabled={!p.enabled||loading} onPress={()=>void play()} style={{padding:8,flexDirection:'row',alignItems:'center',gap:10}}>
      {loading?<ActivityIndicator color={color}/>:<Text style={{color,fontSize:22}}>{status.playing?'Ⅱ':'▶'}</Text>}
      <Text style={{color,fontSize:12}}>{voiceTime(status.currentTime)} / {voiceTime(status.duration)}</Text>
    </TouchableOpacity>{(error||status.error)&&<Text accessibilityRole="alert" style={{color,fontSize:12}}>No se pudo reproducir el audio.</Text>}
  </View>;
}
export function VoiceNotePlayer(p:VoiceNotePlayerProps){return isVoiceData(p.dataUrl)?<NativePlayer {...p}/>:<Text style={{color:p.isSelf?'#fff':'#0f172a'}}>Audio no disponible en este mensaje anterior.</Text>;}
