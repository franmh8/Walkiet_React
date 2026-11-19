import React,{useState,useEffect} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {TacticalDialog} from '../../components/TacticalDialog';
import {useAppTheme} from '../../profile/AppTheme';
import {MessageActionIcon} from './MessageActionIcon';
import type {Conversation} from '../../NativeApp';
import type {DirectoryContact} from '../../../services/contactsApi';
export function ForwardMessageDialog(p:{visible:boolean;busy:boolean;conversations:Conversation[];contacts:DirectoryContact[];userId:string;close:()=>void;choose:(target:Conversation|DirectoryContact)=>void;search:(query:string)=>void;more?:()=>void;hasMore?:boolean}){
  const {palette:t}=useAppTheme(),[query,setQuery]=useState('');
  useEffect(()=>{if(p.visible){setQuery('');p.search('');}},[p.visible]);
  const chats=p.conversations.filter(c=>c.name.toLowerCase().includes(query.toLowerCase()));
  const contacts=p.contacts.filter(c=>c.registered_user_id&&c.registered_user_id!==p.userId&&!p.conversations.some(chat=>chat.type==='direct'&&chat.targetUserId===c.registered_user_id));
  return <TacticalDialog visible={p.visible} title="Reenviar mensaje" description="Selecciona una conversación o contacto." onClose={p.close} showClose busy={p.busy} closeLabel="Cancelar reenvío" icon={<MessageActionIcon action="forward" color={t.accent}/>}>
    <TextInput accessibilityLabel="Buscar destino de reenvío" placeholder="Buscar conversación o contacto…" placeholderTextColor={t.muted} value={query} onChangeText={value=>{setQuery(value);p.search(value);}} style={{borderWidth:1,borderColor:t.border,borderRadius:12,padding:12,color:t.text,marginBottom:10}}/>
    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{maxHeight:280}}>
      {[...chats,...contacts].map(target=><Pressable key={('messages' in target?'thread:':'contact:')+target.id} disabled={p.busy} accessibilityRole="button" accessibilityLabel={'Reenviar a '+target.name} onPress={()=>p.choose(target)} style={({pressed})=>({paddingVertical:13,paddingHorizontal:8,borderBottomWidth:1,borderBottomColor:t.border,borderRadius:8,backgroundColor:pressed?t.input:'transparent'})}>
        <Text numberOfLines={1} style={{color:t.text,fontSize:14,fontWeight:'600'}}>{target.name}</Text><Text style={{fontSize:11,color:t.muted,marginTop:3}}>{'messages' in target?target.type==='group'?'Grupo':'Conversación':'Contacto'}</Text>
      </Pressable>)}
      {!chats.length&&!contacts.length&&<Text style={{color:t.muted,padding:14}}>No hay coincidencias.</Text>}
      {p.hasMore&&<Pressable accessibilityRole="button" onPress={p.more} style={{padding:14}}><Text style={{color:t.accent,textAlign:'center'}}>Cargar más contactos</Text></Pressable>}
    </ScrollView>
  </TacticalDialog>;
}
