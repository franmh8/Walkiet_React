import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Modal, KeyboardAvoidingView, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { createSecurityApi } from '../../services/securityApi';
import { createProfileStyles } from './profileStyles';
import { useAppTheme } from './AppTheme';
import { ProfileIcon } from './ProfileIcon';
import { VerificationCodeInput } from './VerificationCodeInput';

export function SecurityCodeModal({ visible, mode, server, token = '', onClose, onComplete }: {
  visible: boolean; mode: 'email'|'recovery'; server: string; token?: string;
  onClose: () => void; onComplete: () => void | Promise<void>;
}) {
  const { palette:p }=useAppTheme(); const s=useMemo(()=>createProfileStyles(p),[p]);
  const api=useMemo(()=>createSecurityApi(server,token),[server,token]);
  const [step,setStep]=useState<'identify'|'code'|'password'|'success'>('identify');
  const [identifier,setIdentifier]=useState('');
  const [code,setCode]=useState(''); const [challenge,setChallenge]=useState(''); const [proof,setProof]=useState('');
  const [nextPassword,setNextPassword]=useState(''); const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [cooldown,setCooldown]=useState(0);
  const generation=useRef(0); const pending=useRef(false);
  useEffect(()=>{ ++generation.current; pending.current=false; setBusy(false); setStep('identify'); setIdentifier(''); setCode(''); setChallenge(''); setProof(''); setNextPassword(''); setConfirm(''); setError(null); setCooldown(0); return ()=>{++generation.current;}; },[visible,server,token,mode]);
  useEffect(()=>{ if(cooldown>0){const id=setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>clearTimeout(id);} },[cooldown]);
  const perform=async (operation:()=>Promise<any>,success:(value:any)=>void)=>{
    if(pending.current)return; pending.current=true;const version=generation.current;setBusy(true);setError(null);
    try{const value=await operation();if(version===generation.current)success(value);}
    catch(cause){if(version===generation.current)setError(cause instanceof Error?cause.message:'No se pudo completar.');}
    finally{if(version===generation.current){pending.current=false;setBusy(false);}}
  };
  const send=()=>perform(()=>mode==='email'?api.emailRequest(identifier.trim()):api.recoveryRequest(identifier.trim()),value=>{setChallenge(value.challenge_id);setProof('');setCode('');setCooldown(value.resend_after || 60);setStep('code');});
  const verify=()=>perform(()=>mode==='email'?api.emailVerify(challenge,code):api.recoveryVerify(challenge,code),value=>{
    setCode('');
    if(mode==='email'){setStep('success');void onComplete();}else{setProof(value.reset_token);setStep('password');}
  });
  const reset=()=>{
    if(nextPassword!==confirm){setError('Las contraseñas no coinciden.');return;}
    void perform(()=>api.recoveryReset(challenge,proof,nextPassword),()=>{setProof('');setNextPassword('');setConfirm('');setStep('success');});
  };
  const action=(label:string,fn:()=>void,disabled=false)=><TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:busy||disabled}} disabled={busy||disabled} style={[s.action,s.primary,(busy||disabled)&&s.disabled]} onPress={fn}>{busy&&<ActivityIndicator color="#fff"/>}<Text style={[s.actionText,s.white]}>{label}</Text></TouchableOpacity>;
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={()=>{if(!busy)onClose();}}><KeyboardAvoidingView style={s.overlay} behavior={Platform.OS==='ios'?'padding':undefined}><View style={[s.modal,{maxHeight:'94%'}]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:18}}>
    <View style={s.modalHeader}><View style={s.securityBadge}><ProfileIcon name="mail" color={p.accent} size={22}/></View><Text style={[s.modalTitle,{fontSize:20}]}>{mode==='email'?'Verificar nuevo correo':'Recuperar contraseña'}</Text><TouchableOpacity accessibilityLabel="Cerrar verificación" disabled={busy} onPress={onClose}><ProfileIcon name="x" color={p.muted} size={22}/></TouchableOpacity></View>
    {error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}
    {step==='identify'&&<>
      <Text style={s.description}>{mode==='email'?'Enviaremos un código al nuevo correo para verificarlo antes de actualizar tu cuenta.':'Ingresa tu teléfono o correo. El código se enviará al correo guardado en tu cuenta; no se enviará por SMS.'}</Text>
      <TextInput accessibilityLabel={mode==='email'?'Nuevo correo':'Teléfono o correo de recuperación'} placeholder={mode==='email'?'Nuevo correo electrónico':'Teléfono o correo'} placeholderTextColor={p.muted} style={s.input} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} keyboardType={mode==='email'?'email-address':'default'} maxLength={120} editable={!busy}/>
      {action('Enviar código de verificación',()=>{void send();},!identifier.trim())}
    </>}
    {step==='code'&&<>
      <Text style={s.description}>{mode==='email'?`Revisa el código enviado a ${identifier.trim()}. Tu correo actual se conserva hasta verificarlo.`:'Si existe una cuenta con correo asociado, recibirá un código. Revisa tu bandeja y spam. Si no tienes correo asociado, contacta al administrador.'}</Text>
      <Text style={s.codeLabel}>Código de verificación (6 dígitos)</Text>
      <VerificationCodeInput key={challenge} disabled={busy} invalid={!!error} onChange={value=>{setCode(value);setError(null);}} />
      <Text style={s.codeHint}>Caduca en 10 minutos · Máximo 5 intentos</Text>
      <TouchableOpacity accessibilityRole="link" accessibilityLabel="Reenviar código" accessibilityState={{disabled:busy||cooldown>0}} style={s.resendLink} disabled={busy||cooldown>0} onPress={()=>{void send();}}><ProfileIcon name="refresh-cw" color={cooldown>0?p.muted:p.accent} size={13}/><Text style={[s.resendLabel,{color:cooldown>0?p.muted:p.accent}]}>{cooldown>0?`Reenviar en ${cooldown}s`:'Reenviar código'}</Text></TouchableOpacity>
      <View style={s.codeActions}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancelar verificación" disabled={busy} style={[s.action,s.codeCancel,{flex:1}]} onPress={onClose}><Text style={s.actionText}>Cancelar</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Verificar código" accessibilityState={{disabled:busy||code.length!==6}} disabled={busy||code.length!==6} style={[s.action,s.primary,{flex:1},(busy||code.length!==6)&&s.disabled]} onPress={()=>{void verify();}}>{busy&&<ActivityIndicator color="#fff"/>}<Text style={[s.actionText,s.white]}>Validar</Text></TouchableOpacity></View>
    </>}
    {step==='password'&&<>
      <Text style={s.description}>Código verificado. Tienes 5 minutos para guardar una contraseña nueva. Se cerrarán las sesiones anteriores.</Text>
      <TextInput accessibilityLabel="Nueva contraseña de recuperación" placeholder="Nueva contraseña (mínimo 8 caracteres)" placeholderTextColor={p.muted} style={s.input} secureTextEntry value={nextPassword} onChangeText={setNextPassword} autoCapitalize="none" editable={!busy}/>
      <TextInput accessibilityLabel="Confirmar contraseña de recuperación" placeholder="Repite la contraseña" placeholderTextColor={p.muted} style={s.input} secureTextEntry value={confirm} onChangeText={setConfirm} autoCapitalize="none" editable={!busy}/>
      {action('Guardar nueva contraseña',reset,nextPassword.length<8||!confirm)}
    </>}
    {step==='success'&&<><Text style={s.label}>{mode==='email'?'Correo verificado y actualizado.':'Contraseña actualizada. Ya puedes iniciar sesión.'}</Text>{action('Entendido',()=>{if(mode==='recovery')void onComplete();onClose();})}</>}
    {step!=='success'&&step!=='code'&&<TouchableOpacity disabled={busy} style={s.action} onPress={onClose}><Text style={s.actionText}>Cancelar</Text></TouchableOpacity>}
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}
