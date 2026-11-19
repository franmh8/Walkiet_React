const stops=new Set<()=>void>();
export function registerVoicePlayback(stop:()=>void){stops.add(stop);return()=>{stops.delete(stop);};}
export function stopVoicePlayback(){for(const stop of stops)stop();}
