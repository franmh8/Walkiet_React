import {useEffect,useRef,useState} from 'react';
import {Keyboard,type AlertButton} from 'react-native';
import type {ChatMessage,Conversation} from '../../NativeApp';
import type {DirectoryContact} from '../../../services/contactsApi';
import type {createChatSyncApi} from '../../../services/chatSyncApi';
import {copyMessageText} from './copyText';
import {copyableText,mediaLabel,type ReplyPreview,type SendContext} from './messageTypes';
import type {MenuPoint} from './MessagePressTarget.types';
import type {MessageAction} from './MessageActionIcon';
export function useMessageActions(p:{scope:string;conversation:Conversation|null;userId:string;api:ReturnType<typeof createChatSyncApi>|null;draft:string;setDraft:React.Dispatch<React.SetStateAction<string>>;
  send:(text:string,context:SendContext)=>Promise<boolean>;change:(id:string,change:{text:string}|{scope:'me'|'everyone'})=>Promise<void>;
  cancel:(id:string)=>Promise<boolean>;forward:(source:ChatMessage,target:Conversation|DirectoryContact)=>Promise<void>;
  alert:(title:string,message?:string,buttons?:AlertButton[])=>void;toast:(message:string)=>void}){
  const live=useRef(p);live.current=p;const suppressPress=useRef(0);
  const [menu,setMenu]=useState<{id:string;point:MenuPoint}|null>(null),[reply,setReply]=useState<ReplyPreview|null>(null),[editing,setEditing]=useState<ChatMessage|null>(null),[editText,setEditText]=useState(''),[forwarding,setForwarding]=useState<ChatMessage|null>(null),[busy,setBusy]=useState(false);
  useEffect(()=>{setMenu(null);setReply(null);setEditing(null);setEditText('');setForwarding(null);setBusy(false);},[p.scope]);
  const name=(id:string,fallback:string)=>!id?'':id===p.userId?'Tú':p.conversation?.type==='direct'?p.conversation.name:fallback;
  const quote=(message:ChatMessage):ReplyPreview=>({id:message.id,authorId:message.senderId,authorName:message.senderName,text:message.deleted?'Mensaje eliminado':message.text||mediaLabel(message.mediaType),mediaType:message.mediaType||'text',unavailable:message.deleted});
  const run=async(work:()=>Promise<void>)=>{const scope=p.scope;setBusy(true);try{await work();}catch(cause){if(live.current.scope===scope)live.current.alert('No se pudo completar',cause instanceof Error?cause.message:'Inténtalo de nuevo.');}finally{if(live.current.scope===scope)setBusy(false);}};
  const ensure=async()=>{const api=p.api;if(!api)throw new Error('Inicia sesión para usar esta opción.');await api.requireMessageActions();return live.current.scope===p.scope;};
  const message=menu?p.conversation?.messages.find(m=>m.id===menu.id)||null:null;
  const choose=(action:MessageAction)=>{
    const target=message;setMenu(null);if(!target)return;
    if(action==='copy'){void run(async()=>{await copyMessageText(copyableText(target));if(live.current.scope===p.scope)p.toast('Mensaje copiado');});return;}
    if(action==='delete'){
      const buttons:AlertButton[]=target.clientId?[{text:'Eliminar pendiente',style:'destructive',onPress:()=>void run(async()=>{if(!await p.cancel(target.clientId!))throw new Error('El mensaje se está enviando o ya fue confirmado. Abre sus opciones de nuevo para eliminarlo.');})}]:[{text:'Eliminar para mí',onPress:()=>void run(()=>p.change(target.id,{scope:'me'}))}];
      if(!target.clientId&&target.isSelf&&!target.deleted)buttons.push({text:'Eliminar para todos',style:'destructive',onPress:()=>void run(()=>p.change(target.id,{scope:'everyone'}))});
      buttons.push({text:'Cancelar',style:'cancel'});p.alert('Eliminar mensaje',target.clientId?'Quitar este envío pendiente de este dispositivo.':target.isSelf&&!target.deleted?'Para mí lo oculta solo en tu cuenta. Para todos retira el contenido del chat de sus participantes.':'Este mensaje se ocultará solo en tu cuenta.',buttons);return;
    }
    void run(async()=>{if(!await ensure())return;Keyboard.dismiss();if(action==='reply'){setEditing(null);setReply(quote(target));}else if(action==='edit'){setReply(null);setEditing(target);setEditText(target.text);}else setForwarding(target);});
  };
  const send=async()=>{
    if(busy)return;const text=(editing?editText:p.draft).trim();if(!text)return;
    const selectedReply=reply,selectedEdit=editing;
    await run(async()=>{if(selectedEdit){await p.change(selectedEdit.id,{text});if(live.current.scope===p.scope)setEditing(null);}else{const ok=await p.send(text,selectedReply?{replyToId:selectedReply.id,reply:selectedReply}:{});if(ok&&live.current.scope===p.scope){p.setDraft(value=>value.trim()===text?'':value);setReply(value=>value?.id===selectedReply?.id?null:value);}}});
  };
  return {menuMessage:message,menuPoint:menu?.point||{x:0,y:0},menuOpen:!!message,choose,closeMenu:()=>setMenu(null),open:(message:ChatMessage,point:MenuPoint)=>{if(busy)return;Keyboard.dismiss();suppressPress.current=Date.now()+650;setMenu({id:message.id,point});},suppressPress,
    reply,replyName:reply?name(reply.authorId,reply.authorName):'',quoteName:name,clearReply:()=>setReply(null),afterSend:(id?:string)=>{if(live.current.scope===p.scope&&id)setReply(value=>value?.id===id?null:value);},
    editing,editText,setEditText,cancelEdit:()=>{setEditing(null);setEditText('');},send,busy,
    forwarding,closeForward:()=>{if(!busy)setForwarding(null);},chooseForward:(target:Conversation|DirectoryContact)=>{if(!forwarding||busy)return;void run(async()=>{await p.forward(forwarding,target);if(live.current.scope===p.scope){setForwarding(null);p.toast('Reenvío agregado a '+target.name);}});},
  };
}
