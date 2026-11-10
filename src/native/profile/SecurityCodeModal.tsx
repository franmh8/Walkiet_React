import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Modal, KeyboardAvoidingView, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { createSecurityApi } from '../../services/securityApi';
import { createProfileStyles } from './profileStyles';
import { useAppTheme } from './AppTheme';
import { ProfileIcon } from './ProfileIcon';

export function SecurityCodeModal({ visible, mode, server, token = '', onClose, onComplete }: {
  visible: boolean; mode: 'email'|'recovery'; server: string; token?: string;
  onClose: () => void; onComplete: () => void | Promise<void>;
}) {
  const { palette:p }=useAppTheme(); const s=useMemo(()=>createProfileStyles(p),[p]);
  const api=useMemo(()=>createSecurityApi(server,token),[server,token]);
  const [step,setStep]=useState<'identify'|'code'|'password'|'success'>('identify');
  const [identifier,setIdentifier]=useState(''); const [password,setPassword]=useState('');
  const [code,setCode]=useState(''); const [challenge,setChallenge]=useState(''); const [proof,setProof]=useState('');
  const [nextPassword,setNextPassword]=useState(''); const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [cooldown,setCooldown]=useState(0);
  const generation=useRef(0); const pending=useRef(false);
  useEffect(()=>{ ++generation.current; pending.current=false; setBusy(false); setStep('identify'); setIdentifier(''); setPassword(''); setCode(''); setChallenge(''); setProof(''); setNextPassword(''); setConfirm(''); setError(null); setCooldown(0); return ()=>{++generation.current;}; },[visible,server,token,mode]);
  useEffect(()=>{ if(cooldown>0){const id=setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>clearTimeout(id);} },[cooldown]);
  const perform=async (operation:()=>Promise<any>,success:(value:any)=>void)=>{
    if(pending.current)return; pending.current=true;const version=generation.current;setBusy(true);setError(null);
    try{const value=await operation();if(version===generation.current)success(value);}
    catch(cause){if(version===generation.current)setError(cause instanceof Error?cause.message:'No se pudo completar.');}
    finally{if(version===generation.current){pending.current=false;setBusy(false);}}
  };
  const send=()=>perform(()=>mode==='email'?api.emailRequest(identifier.trim(),password):api.recoveryRequest(identifier.trim()),value=>{setChallenge(value.challenge_id);setProof('');setCode('');setCooldown(value.resend_after || 60);setStep('code');});
  const verify=()=>perform(()=>mode==='email'?api.emailVerify(challenge,code):api.recoveryVerify(challenge,code),value=>{
    setPassword('');setCode('');
    if(mode==='email'){setStep('success');void onComplete();}else{setProof(value.reset_token);setStep('password');}
  });
  const reset=()=>{
    if(nextPassword!==confirm){setError('Las contraseñas no coinciden.');return;}
    void perform(()=>api.recoveryReset(challenge,proof,nextPassword),()=>{setProof('');setNextPassword('');setConfirm('');setStep('success');});
  };
  const action=(label:string,fn:()=>void,disabled=false)=><TouchableOpacity accessibilityLabel={label} disabled={busy||disabled} style={[s.action,s.primary,(busy||disabled)&&s.disabled]} onPress={fn}>{busy&&<ActivityIndicator color="#fff"/>}<Text style={[s.actionText,s.white]}>{label}</Text></TouchableOpacity>;
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={()=>{if(!busy)onClose();}}><KeyboardAvoidingView style={s.overlay} behavior={Platform.OS==='ios'?'padding':undefined}><View style={[s.modal,{maxHeight:'94%'}]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:18}}>
    <View style={s.modalHeader}><Text style={s.modalTitle}>{mode==='email'?'Verificar nuevo correo':'Recuperar contraseña'}</Text><TouchableOpacity accessibilityLabel="Cerrar verificación" disabled={busy} onPress={onClose}><ProfileIcon name="x" color={p.muted} size={22}/></TouchableOpacity></View>
    {error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}
    {step==='identify'&&<>
      <Text style={s.description}>{mode==='email'?'Confirma tu contraseña actual. Enviaremos un código al nuevo correo antes de cambiarlo.':'Ingresa tu teléfono o correo. El código se enviará al correo guardado en tu cuenta; no se enviará por SMS.'}</Text>
      <TextInput accessibilityLabel={mode==='email'?'Nuevo correo':'Teléfono o correo de recuperación'} placeholder={mode==='email'?'Nuevo correo electrónico':'Teléfono o correo'} placeholderTextColor={p.muted} style={s.input} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} keyboardType={mode==='email'?'email-address':'default'} maxLength={120} editable={!busy}/>
      {mode==='email'&&<TextInput accessibilityLabel="Contraseña actual para cambiar correo" placeholder="Contraseña actual" placeholderTextColor={p.muted} style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" editable={!busy}/>}
      {action('Enviar código de verificación',()=>{void send();},!identifier.trim() || mode==='email'&&!password)}
    </>}
    {step==='code'&&<>
      <Text style={s.description}>{mode==='email'?`Revisa el código enviado a ${identifier.trim()}. Tu correo actual se conserva hasta verificarlo.`:'Si existe una cuenta con correo asociado, recibirá un código. Revisa tu bandeja y spam. Si no tienes correo asociado, contacta al administrador.'}</Text>
      <TextInput accessibilityLabel="Código de verificación" placeholder="Código de 6 dígitos" placeholderTextColor={p.muted} style={[s.input,{textAlign:'center',letterSpacing:5,fontSize:23}]} value={code} onChangeText={v=>setCode(v.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} editable={!busy}/>
      <Text style={s.description}>Caduca en 10 minutos. Máximo 5 intentos.</Text>
      {action('Verificar código',()=>{void verify();},code.length!==6)}
      <TouchableOpacity style={s.action} disabled={busy||cooldown>0} onPress={()=>{void send();}}><Text style={[s.actionText,(busy||cooldown>0)&&s.disabled]}>{cooldown>0?`Reenviar en ${cooldown}s`:'Reenviar código'}</Text></TouchableOpacity>
      <TouchableOpacity disabled={busy} onPress={()=>{setStep('identify');setCode('');setProof('');setError(null);}}><Text style={s.notice}>Cambiar datos</Text></TouchableOpacity>
    </>}
    {step==='password'&&<>
      <Text style={s.description}>Código verificado. Tienes 5 minutos para guardar una contraseña nueva. Se cerrarán las sesiones anteriores.</Text>
      <TextInput accessibilityLabel="Nueva contraseña de recuperación" placeholder="Nueva contraseña (mínimo 8 caracteres)" placeholderTextColor={p.muted} style={s.input} secureTextEntry value={nextPassword} onChangeText={setNextPassword} autoCapitalize="none" editable={!busy}/>
      <TextInput accessibilityLabel="Confirmar contraseña de recuperación" placeholder="Repite la contraseña" placeholderTextColor={p.muted} style={s.input} secureTextEntry value={confirm} onChangeText={setConfirm} autoCapitalize="none" editable={!busy}/>
      {action('Guardar nueva contraseña',reset,nextPassword.length<8||!confirm)}
    </>}
    {step==='success'&&<><Text style={s.label}>{mode==='email'?'Correo verificado y actualizado.':'Contraseña actualizada. Ya puedes iniciar sesión.'}</Text>{action('Entendido',()=>{if(mode==='recovery')void onComplete();onClose();})}</>}
    {step!=='success'&&<TouchableOpacity disabled={busy} style={s.action} onPress={onClose}><Text style={s.actionText}>Cancelar</Text></TouchableOpacity>}
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}
