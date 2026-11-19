import {voiceWav} from './voiceWav';
import {MAX_VOICE_BYTES,type VoiceCapture} from './voiceTypes';
export async function startVoiceCapture(valid:()=>boolean):Promise<VoiceCapture> {
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Este navegador necesita HTTPS (o localhost) y acceso al micrófono para grabar.');
  let stream:MediaStream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});}
  catch(cause){const name=(cause as Error)?.name;throw new Error(name==='NotAllowedError'?'Autoriza el micrófono en los permisos del navegador y vuelve a mantener presionado.':name==='NotFoundError'?'No se encontró un micrófono conectado.':'No se pudo abrir el micrófono. Comprueba que esté disponible.');}
  const close=()=>stream.getTracks().forEach(track=>track.stop());
  if(!valid()){close();throw new Error('Grabación cancelada.');}
  let recorder:MediaRecorder;
  try{
    const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
    recorder=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:64000});
  }catch(cause){close();throw cause;}
  const chunks:Blob[]=[];let failure:Error|null=null,closed=false;
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  recorder.onerror=()=>{failure=new Error('Se interrumpió el micrófono. Vuelve a grabar.');close();};
  const started=Date.now();try{recorder.start();}catch(cause){close();throw cause;}
  const stop=()=>new Promise<Blob>((resolve,reject)=>{
    if(closed){reject(new Error('La grabación ya se cerró.'));return;}closed=true;
    recorder.onstop=()=>{close();if(failure)reject(failure);else resolve(new Blob(chunks,{type:recorder.mimeType}));};
    try{if(recorder.state==='inactive'){close();reject(failure||new Error('La grabación se interrumpió.'));}else recorder.stop();}catch(cause){close();reject(cause);}
    close(); // Cerrar el dispositivo antes de convertir o subir el audio.
  });
  return {
    async stop(){
      const blob=await stop();if(!blob.size)throw new Error('No se capturó audio. Mantén presionado para grabar.');
      const AudioContextClass=window.AudioContext||(window as any).webkitAudioContext;
      const context:AudioContext=new AudioContextClass();
      try{
        const audio=await context.decodeAudioData(await blob.arrayBuffer());
        const data=voiceWav(Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i)),audio.sampleRate);
        if(data.byteLength>MAX_VOICE_BYTES)throw new Error('La nota de voz excede el tamaño permitido.');
        let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
        return {dataUrl:'data:audio/wav;base64,'+btoa(binary),fileName:'nota-de-voz.wav',durationMs:Math.min(60000,Math.round(audio.duration*1000)||Date.now()-started)};
      }finally{void context.close().catch(()=>{});}
    },
    async cancel(){if(!closed){closed=true;recorder.onstop=null;recorder.ondataavailable=null;try{if(recorder.state!=='inactive')recorder.stop();}finally{close();}}else close();},
  };
}
