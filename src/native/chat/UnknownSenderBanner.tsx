import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import type {ChatPeerInfo} from '../../services/chatSyncApi';
import type {ContactInput, DirectoryContact} from '../../services/contactsApi';
import {DialogAction, TacticalDialog} from '../components/TacticalDialog';
import {UserPlusIcon, UsersIcon} from '../icons';
import {useAppTheme} from '../profile/AppTheme';
import {PeerAvatar} from '../profile/PeerAvatar';
import {senderPhone} from './chatContactLabel';

export function UnknownSenderBanner({peer, callsign, unit, avatar, createContact, onSaved, onDialogChange}: {
  peer: ChatPeerInfo; callsign?: string; unit?: string; avatar?: string|null;
  createContact: (input: ContactInput) => Promise<DirectoryContact>;
  onSaved: (contact: DirectoryContact) => void;
  onDialogChange: (open: boolean) => void;
}) {
  const {palette:p}=useAppTheme();
  const [adding,setAdding]=useState(false),[name,setName]=useState(peer.registeredName);
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const saving=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{onDialogChange(adding);return()=>onDialogChange(false);},[adding,onDialogChange]);
  const save=async()=>{
    if(saving.current)return;
    if(!name.trim()){setError('Escribe el nombre o apodo con el que quieres guardarlo.');return;}
    saving.current=true;setBusy(true);setError(null);
    try {
      const contact=await createContact({name:name.trim(),phone_number:peer.phoneNumber,email:'',callsign,unit});
      if(!mounted.current)return;
      setAdding(false);onSaved(contact);
    } catch(cause) {
      if(mounted.current)setError(cause instanceof Error?cause.message:'No se pudo guardar. Intenta de nuevo.');
    } finally {saving.current=false;if(mounted.current)setBusy(false);}
  };
  const phone=senderPhone(peer.phoneNumber);
  return <>
    <View testID="unknown-sender-banner" style={[styles.card,{backgroundColor:p.card,borderColor:p.border}]}>
      <PeerAvatar uri={avatar} name={peer.registeredName} style={[styles.avatar,{backgroundColor:p.soft}]}>
        <Text style={[styles.initial,{color:p.accent}]}>{peer.registeredName.charAt(0).toUpperCase()}</Text>
      </PeerAvatar>
      <Text selectable style={[styles.phone,{color:p.text}]}>{phone||peer.registeredName}</Text>
      {!!phone&&<Text style={[styles.name,{color:p.secondary}]}>{peer.registeredName}</Text>}
      <View style={[styles.tag,{backgroundColor:p.soft}]}><Text style={[styles.tagText,{color:p.accent}]}>No está en tus contactos</Text></View>
      {(!!callsign||!!unit)&&<Text style={[styles.details,{color:p.muted}]}>{[callsign,unit].filter(Boolean).join(' · ')}</Text>}
      <View style={styles.common}>
        <UsersIcon size={15} color={p.muted}/>
        <Text style={[styles.commonText,{color:p.muted}]}>{peer.commonChannelCount===0?'Ningún canal en común':`${peer.commonChannelCount} ${peer.commonChannelCount===1?'canal':'canales'} en común`}</Text>
      </View>
      {!!phone&&<TouchableOpacity accessibilityRole="button" accessibilityLabel="Añadir remitente a contactos" activeOpacity={0.8}
        onPress={()=>{setName(peer.registeredName);setError(null);setAdding(true);}}
        style={[styles.add,{backgroundColor:p.soft}]}>
        <UserPlusIcon size={19} color={p.accent}/><Text style={[styles.addText,{color:p.accent}]}>Añadir a contactos</Text>
      </TouchableOpacity>}
    </View>
    {adding&&<TacticalDialog visible title="Añadir a contactos" description={phone} busy={busy}
      icon={<UserPlusIcon size={30} color={p.accent}/>} onClose={()=>{if(!saving.current)setAdding(false);}} showClose closeLabel="Cerrar registro de contacto">
      <Text style={[styles.label,{color:p.secondary}]}>Nombre o apodo</Text>
      <TextInput value={name} onChangeText={setName} maxLength={120} editable={!busy} accessibilityLabel="Nombre o apodo del remitente"
        placeholder="¿Cómo quieres guardarlo?" placeholderTextColor={p.muted} autoCapitalize="words"
        style={[styles.input,{color:p.text,backgroundColor:p.input,borderColor:p.border}]}/>
      {!!error&&<Text accessibilityRole="alert" style={[styles.error,{color:p.danger}]}>{error}</Text>}
      <DialogAction label="Guardar contacto" onPress={()=>{void save();}} busy={busy} busyLabel="Guardando…"/>
      <DialogAction label="Cancelar" secondary disabled={busy} onPress={()=>setAdding(false)}/>
    </TacticalDialog>}
  </>;
}
const styles=StyleSheet.create({
  card:{alignSelf:'center',width:'100%',maxWidth:340,borderWidth:1,borderRadius:24,padding:18,alignItems:'center',gap:8,marginBottom:16},
  avatar:{width:64,height:64,borderRadius:32,alignItems:'center',justifyContent:'center',marginBottom:2},
  initial:{fontSize:26,fontWeight:'700'},phone:{fontSize:19,fontWeight:'800',textAlign:'center'},name:{fontSize:14,fontWeight:'600',textAlign:'center'},
  tag:{borderRadius:10,paddingHorizontal:10,paddingVertical:5,marginVertical:2},tagText:{fontSize:11,fontWeight:'700',textAlign:'center'},
  details:{fontSize:12,lineHeight:18,textAlign:'center'},common:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},commonText:{fontSize:12,flexShrink:1},
  add:{width:'100%',minHeight:46,borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:6},addText:{fontSize:13,fontWeight:'700'},
  label:{fontSize:13,fontWeight:'600'},input:{minHeight:48,borderWidth:1,borderRadius:13,paddingHorizontal:13,fontSize:16},error:{fontSize:13,lineHeight:19},
});
