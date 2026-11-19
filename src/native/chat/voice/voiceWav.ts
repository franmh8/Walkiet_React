// PCM mono de 12 kHz: reproducible en navegador/iOS/Android; hasta 60 s
// queda por debajo de 2 MB en la fila de AsyncStorage tras codificar base64.
export function voiceWav(channels:Float32Array[],sampleRate:number):Uint8Array {
  if(!channels.length||!channels[0].length||sampleRate<=0)throw new Error('La grabación está vacía.');
  const rate=12000,length=Math.min(rate*60,Math.floor(channels[0].length*rate/sampleRate));
  const bytes=new Uint8Array(44+length*2),view=new DataView(bytes.buffer);
  const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
  text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
  for(let i=0;i<length;i++){
    const from=Math.floor(i*sampleRate/rate),to=Math.min(channels[0].length,Math.max(from+1,Math.floor((i+1)*sampleRate/rate)));
    let sum=0;for(const channel of channels)for(let j=from;j<to;j++)sum+=channel[j]||0;
    const value=Math.max(-1,Math.min(1,sum/(channels.length*(to-from))));view.setInt16(44+i*2,value<0?value*32768:value*32767,true);
  }
  return bytes;
}
