import React,{useEffect,useRef,useState} from 'react';
import {BackHandler,Platform,Pressable,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {useAppTheme} from '../../profile/AppTheme';
import {copyableText} from './messageTypes';
import {MessageActionIcon,type MessageAction} from './MessageActionIcon';
import type {ChatMessage} from '../../NativeApp';
import type {MenuPoint} from './MessagePressTarget.types';
export function MessageMenu({message,point,close,choose}:{message:ChatMessage|null;point:MenuPoint;close:()=>void;choose:(action:MessageAction)=>void}){
  const {palette:p}=useAppTheme(),{width,height}=useWindowDimensions(),root=useRef<React.ElementRef<typeof View>>(null);
  const [offset,setOffset]=useState({x:0,y:0});
  useEffect(()=>{if(!message)return;const sub=BackHandler.addEventListener('hardwareBackPress',()=>{close();return true;});const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};if(Platform.OS==='web')window.addEventListener('keydown',key);return()=>{sub.remove();if(Platform.OS==='web')window.removeEventListener('keydown',key);};},[message,close]);
  if(!message)return null;
  const pending=!!message.clientId,items:{action:MessageAction;label:string}[]=[];
  if(!pending&&!message.deleted){items.push({action:'reply',label:'Responder'},{action:'forward',label:'Reenviar'});}
  if(copyableText(message))items.push({action:'copy',label:message.mediaType==='document'?'Copiar nombre':'Copiar'});
  if(!pending&&!message.deleted&&message.isSelf&&(!message.mediaType||message.mediaType==='text'))items.push({action:'edit',label:'Editar'});
  items.push({action:'delete',label:pending?'Eliminar pendiente':'Eliminar'});
  const menuHeight=items.length*45+16,menuWidth=224;
  const left=Math.max(8,Math.min(width-menuWidth-8,point.x-offset.x-menuWidth/2));
  const y=point.y-offset.y,top=Math.max(8,Math.min(height-offset.y-menuHeight-8,y+menuHeight+12>height-offset.y?y-menuHeight-10:y+10));
  return <View ref={root} onLayout={()=>root.current?.measureInWindow((x,y)=>setOffset({x,y}))} style={[StyleSheet.absoluteFill,{zIndex:10000,elevation:40}]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar opciones del mensaje" onPress={close} style={[StyleSheet.absoluteFill,{backgroundColor:'#0002'}]}/>
    <View testID="message-actions-menu" accessibilityViewIsModal {...(Platform.OS==='web'?{role:'menu' as const,'aria-label':'Opciones del mensaje'}:{})}
      style={{position:'absolute',left,top,width:menuWidth,borderRadius:18,paddingVertical:8,backgroundColor:p.card,borderWidth:1,borderColor:p.border,shadowColor:'#000',shadowOffset:{width:0,height:8},shadowOpacity:0.2,shadowRadius:24,elevation:20}}>
      {items.map((item,index)=><Pressable key={item.action} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>choose(item.action)}
        style={({pressed})=>({height:45,paddingHorizontal:17,flexDirection:'row',alignItems:'center',gap:13,backgroundColor:pressed?p.input:'transparent',borderTopWidth:item.action==='delete'&&index>0?StyleSheet.hairlineWidth:0,borderTopColor:p.border})}>
        <MessageActionIcon action={item.action} color={item.action==='delete'?p.danger:p.text}/><Text style={{color:item.action==='delete'?p.danger:p.text,fontSize:14,fontWeight:'500'}}>{item.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
