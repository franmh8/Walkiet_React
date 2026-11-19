import {AudioModule,RecordingPresets,requestRecordingPermissionsAsync,setAudioModeAsync} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import {MAX_VOICE_BYTES,type VoiceCapture} from './voiceTypes';
let busy=false;
export async function startVoiceCapture(valid:()=>boolean):Promise<VoiceCapture> {
  if(busy)throw new Error('El micrófono está terminando la grabación anterior. Vuelve a mantener presionado.');
  busy=true;
  try{
    const capture=await prepareCapture(valid);
    return {stop:async()=>{try{return await capture.stop();}finally{busy=false;}},cancel:async()=>{try{await capture.cancel();}finally{busy=false;}}};
  }catch(cause){busy=false;throw cause;}
}
async function prepareCapture(valid:()=>boolean):Promise<VoiceCapture> {
  const permission=await requestRecordingPermissionsAsync();
  if(!valid())throw new Error('Grabación cancelada.');
  if(!permission.granted)throw new Error('Autoriza el micrófono en los permisos del teléfono para grabar notas de voz.');
  await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true,shouldPlayInBackground:false,allowsBackgroundRecording:false,interruptionMode:'doNotMix'});
  let recorder:InstanceType<typeof AudioModule.AudioRecorder>;
  try{recorder=new AudioModule.AudioRecorder({...RecordingPresets.HIGH_QUALITY,numberOfChannels:1,bitRate:64000});}
  catch(cause){await setAudioModeAsync({allowsRecording:false}).catch(()=>{});throw cause;}
  let closed=false;
  const cleanup=async()=>{try{recorder.release();}catch{}await setAudioModeAsync({allowsRecording:false}).catch(()=>{});};
  try{await recorder.prepareToRecordAsync();if(!valid())throw new Error('Grabación cancelada.');recorder.record();}
  catch(cause){await cleanup();throw cause;}
  return {
    async stop(){
      if(closed)throw new Error('La grabación ya se cerró.');closed=true;
      const durationMs=Math.round(recorder.currentTime*1000);let uri:string|null=null;
      try{
        await recorder.stop();uri=recorder.uri;if(!uri)throw new Error('No se guardó el audio del micrófono.');
        const body=await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.Base64});
        if(!body||body.length>Math.ceil(MAX_VOICE_BYTES/3)*4)throw new Error('La nota de voz está vacía o excede el tamaño permitido.');
        return {dataUrl:'data:audio/mp4;base64,'+body,fileName:'nota-de-voz.m4a',durationMs};
      }finally{await cleanup();if(uri)await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{});}
    },
    async cancel(){if(closed)return;closed=true;try{await recorder.stop();const uri=recorder.uri;if(uri)await FileSystem.deleteAsync(uri,{idempotent:true});}catch{}finally{await cleanup();}},
  };
}
