import {MAX_VOICE_MS,type VoiceCapture,type VoiceClip} from './voiceTypes';
export interface VoiceState {phase:'idle'|'preparing'|'recording'|'processing'|'retry';durationMs:number;}
export class VoiceNoteSession {
  private version=0;private held=false;private working=false;private capture:VoiceCapture|null=null;private clip:VoiceClip|null=null;
  private tick:ReturnType<typeof setInterval>|undefined;private limit:ReturnType<typeof setTimeout>|undefined;private started=0;
  state:VoiceState={phase:'idle',durationMs:0};
  constructor(private options:{capture:(valid:()=>boolean)=>Promise<VoiceCapture>;send:(clip:VoiceClip)=>Promise<boolean>;state:(state:VoiceState)=>void;error:(error:unknown)=>void;now?:()=>number}){}
  private now(){return this.options.now?.()??Date.now();}
  private update(phase:VoiceState['phase'],durationMs=this.state.durationMs){this.state={phase,durationMs};this.options.state(this.state);}
  private clear(){clearInterval(this.tick);clearTimeout(this.limit);}
  async start(){
    if(this.held||this.working||this.state.phase!=='idle')return;
    const version=++this.version;this.held=true;this.working=true;this.update('preparing',0);
    const valid=()=>this.version===version&&this.held;
    try{
      const capture=await this.options.capture(valid);
      if(!valid()){await capture.cancel();return;}
      this.capture=capture;this.started=this.now();this.update('recording');
      this.tick=setInterval(()=>this.update('recording',Math.min(MAX_VOICE_MS,this.now()-this.started)),100);
      this.limit=setTimeout(()=>void this.finish(),MAX_VOICE_MS);
    }catch(cause){if(valid()){this.options.error(cause);this.update('idle',0);this.held=false;}}
    finally{this.working=false;}
  }
  async finish(){
    if(!this.held)return;this.held=false;this.clear();
    const capture=this.capture;this.capture=null;const version=this.version;
    if(!capture){++this.version;this.update('idle',0);return;}
    const duration=this.now()-this.started;this.update('processing',duration);
    try{
      if(duration<350){await capture.cancel();if(this.version===version)this.update('idle',0);return;}
      const clip=await capture.stop();if(this.version!==version)return;
      this.clip=clip;await this.send(version);
    }catch(cause){if(this.version===version){this.update('idle',0);this.options.error(cause);}}
  }
  private async send(version:number){
    if(!this.clip)return;this.update('processing');
    try{if(await this.options.send(this.clip)){if(this.version===version){this.clip=null;this.update('idle',0);}}else if(this.version===version)this.update('retry');}
    catch(cause){if(this.version===version){this.update('retry');this.options.error(cause);}}
  }
  retry(){if(this.state.phase==='retry')void this.send(this.version);}
  cancel(){this.held=false;++this.version;this.clear();const capture=this.capture;this.capture=null;this.clip=null;this.update('idle',0);void capture?.cancel().catch(()=>{});}
}
