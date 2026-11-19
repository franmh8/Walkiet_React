import React,{useEffect,useRef} from 'react';
import {View} from 'react-native';
import type {MessagePressTargetProps} from './MessagePressTarget.types';
export function MessagePressTarget(p:MessagePressTargetProps){
  const node=useRef<React.ElementRef<typeof View>>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),live=useRef(p);live.current=p;
  const cancel=()=>clearTimeout(timer.current);
  useEffect(()=>{if(p.disabled)cancel();},[p.disabled]);
  useEffect(()=>{
    const element=node.current as unknown as HTMLDivElement;if(!element)return;
    let point={x:0,y:0},blocked=0;
    const open=(x:number,y:number)=>{if(!live.current.disabled){blocked=Date.now()+650;live.current.onOpen({x,y});}};
    const down=(e:PointerEvent)=>{cancel();if(e.button!==0||live.current.disabled)return;point={x:e.clientX,y:e.clientY};timer.current=setTimeout(()=>open(point.x,point.y),450);};
    const move=(e:PointerEvent)=>{if(Math.hypot(e.clientX-point.x,e.clientY-point.y)>10)cancel();};
    const click=(e:MouseEvent)=>{if(Date.now()<blocked){e.preventDefault();e.stopPropagation();}};
    const context=(e:MouseEvent)=>{e.preventDefault();cancel();open(e.clientX,e.clientY);};
    const key=(e:KeyboardEvent)=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const box=element.getBoundingClientRect();open(box.x+box.width/2,box.y+20);}};
    // Captura DOM: React Native Web filtra los props onPointer*Capture de View.
    element.addEventListener('pointerdown',down,true);element.addEventListener('click',click,true);element.addEventListener('contextmenu',context);element.addEventListener('keydown',key);
    window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',cancel,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);
    return()=>{cancel();element.removeEventListener('pointerdown',down,true);element.removeEventListener('click',click,true);element.removeEventListener('contextmenu',context);element.removeEventListener('keydown',key);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',cancel,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel);};
  },[]);
  return <View ref={node} tabIndex={0} role="group" aria-label="Mensaje del chat" style={p.style}>{p.children}</View>;
}
