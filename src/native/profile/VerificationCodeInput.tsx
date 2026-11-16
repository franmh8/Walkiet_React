import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { useAppTheme } from './AppTheme';

// Cada casilla es editable; el código completo solo se entrega al llenar las seis.
export function VerificationCodeInput({ disabled, invalid, onChange }: {
  disabled: boolean; invalid: boolean; onChange: (code: string) => void;
}) {
  const { palette: p }=useAppTheme();
  const [digits,setDigits]=useState<string[]>(Array(6).fill(''));
  const [focused,setFocused]=useState<number|null>(0);
  const fields=useRef<(React.ComponentRef<typeof TextInput>|null)[]>([]);
  const changed=useRef(onChange);changed.current=onChange;
  const blocked=useRef(disabled);blocked.current=disabled;
  const current=useRef(digits); current.current=digits;
  const commit=(next:string[])=>{current.current=next;setDigits(next);changed.current(next.every(d=>/^\d$/.test(d))?next.join(''):'');};
  const focus=(index:number)=>fields.current[Math.max(0,Math.min(index,5))]?.focus();
  useEffect(()=>{
    if(Platform.OS!=='web')return;
    // Capturar el pegado completo antes de que maxLength corte el valor de una casilla llena.
    const paste=(event:ClipboardEvent)=>{const value=event.clipboardData?.getData('text').replace(/\D/g,'')||'';if(!blocked.current&&value.length===6){event.preventDefault();commit(value.split(''));focus(5);}};
    const nodes=fields.current.filter(Boolean) as unknown as HTMLInputElement[];
    nodes.forEach(node=>node.addEventListener('paste',paste));return()=>nodes.forEach(node=>node.removeEventListener('paste',paste));
  },[]);
  const change=(index:number,value:string)=>{
    const clean=value.replace(/\D/g,'').slice(0,6);const next=[...current.current];
    if(!clean){next[index]='';commit(next);return;}
    // Pegar/autocompletar un código completo funciona desde cualquier casilla.
    if(clean.length===6){commit(clean.split(''));focus(5);return;}
    // Al editar una casilla llena, algunos teclados agregan el nuevo dígito al anterior.
    const incoming=clean.length===2&&next[index] ? (clean[0]===next[index]?clean[1]:clean[0]) : clean;
    for(let i=0;i<incoming.length&&index+i<6;i++)next[index+i]=incoming[i];
    commit(next);focus(Math.min(index+incoming.length,5));
  };
  return <View style={styles.row} accessibilityLabel="Código de verificación de seis dígitos">{digits.map((digit,index)=><TextInput
    key={index} ref={field=>{fields.current[index]=field;}} value={digit}
    accessibilityLabel={`Dígito ${index+1} del código`} editable={!disabled}
    keyboardType="number-pad" inputMode="numeric" autoComplete={index===0?'one-time-code':'off'}
    textContentType={index===0?'oneTimeCode':'none'} autoCorrect={false} autoCapitalize="none"
    autoFocus={index===0} selectTextOnFocus maxLength={6}
    selectionColor={p.accent}
    onFocus={()=>setFocused(index)} onBlur={()=>setFocused(previous=>previous===index?null:previous)}
    onChangeText={value=>change(index,value)}
    onKeyPress={event=>{const {nativeEvent}=event;
      if(nativeEvent.key==='Backspace'){
        event.preventDefault();
        const next=[...current.current];const target=next[index]?index:Math.max(0,index-1);
        next[target]='';commit(next);focus(target===index?Math.max(0,index-1):target);
      }else if(nativeEvent.key==='ArrowLeft'){event.preventDefault();focus(index-1);}
      else if(nativeEvent.key==='ArrowRight'){event.preventDefault();focus(index+1);}
    }}
    style={[styles.digit,{backgroundColor:p.input,color:p.text,borderColor:invalid?p.danger:focused===index?p.accent:p.border,borderWidth:focused===index?2:1,opacity:disabled?0.6:1},Platform.OS==='web'&&{outlineStyle:'none' as any}]}
  />)}</View>;
}
const styles=StyleSheet.create({
  row:{flexDirection:'row',gap:8,justifyContent:'center',width:'100%'},
  digit:{flex:1,minWidth:0,maxWidth:54,height:62,borderRadius:16,textAlign:'center',fontSize:26,fontWeight:'700',paddingHorizontal:0,paddingVertical:0},
});
