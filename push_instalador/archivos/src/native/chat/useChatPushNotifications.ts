/**
 * Push remoto del chat Walkiet, independiente del contador de mensajes.
 * En Expo Go y web no importa expo-notifications en runtime.
 * Requiere APK/IPA propia, projectId EAS y FCM/APNs configurados.
 */
import {useCallback, useEffect, useRef} from 'react';
import {Platform} from 'react-native';
import Constants from 'expo-constants';
import type {NotificationResponse} from 'expo-notifications';

type NotificationsModule = typeof import('expo-notifications');

type SavedRegistration = {token:string; userId:string};

export function useChatPushNotifications(
  serverUrl:string,
  userId:string,
  authToken:string,
  onOpenThread:(threadId:string)=>void,
) {
  const open=useRef(onOpenThread);open.current=onOpenThread;
  const registration=useRef<SavedRegistration|null>(null);
  const pending=useRef<Promise<void>|null>(null);
  const lastResponseId=useRef<string|null>(null);

  const handleResponse=useCallback((response:NotificationResponse|null)=>{
    if(!response) return;
    const data=response.notification.request.content.data;
    if(data?.kind!=='chat'||typeof data.threadId!=='string')return;
    if(typeof data.recipientUserId==='string' && data.recipientUserId!==userId)return;
    const id=response.notification.request.identifier;
    if(lastResponseId.current===id)return;
    lastResponseId.current=id;
    open.current(data.threadId);
  },[userId]);

  useEffect(()=>{
    if(Platform.OS==='web'||!userId||!authToken||Constants.appOwnership==='expo')return;
    let disposed=false;
    let listener:{remove:()=>void}|undefined;
    void (async()=>{
      try {
        const Notifications:NotificationsModule=await import('expo-notifications');
        if(disposed)return;
        Notifications.setNotificationHandler({
          handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false}),
        });
        listener=Notifications.addNotificationResponseReceivedListener(handleResponse);
        const last=await Notifications.getLastNotificationResponseAsync();
        if(!disposed)handleResponse(last);
      }catch(error){console.warn('[push] No se pudo iniciar el escucha:',error);}
    })();
    return()=>{disposed=true;listener?.remove();};
  },[userId,authToken,handleResponse]);

  useEffect(()=>{
    if(Platform.OS==='web'||!userId||!authToken||Constants.appOwnership==='expo')return;
    let disposed=false;
    const register=async()=>{
      try {
        const [Device,Notifications]=await Promise.all([import('expo-device'),import('expo-notifications')]);
        if(disposed||!Device.isDevice)return;
        if(Platform.OS==='android'){
          await Notifications.setNotificationChannelAsync('messages',{
            name:'Mensajes de Walkiet', importance:Notifications.AndroidImportance.MAX,
            vibrationPattern:[0,200,100,200],sound:'default',
          });
        }
        let perm=await Notifications.getPermissionsAsync();
        if(!perm.granted)perm=await Notifications.requestPermissionsAsync();
        if(!perm.granted||disposed)return;
        const projectId=Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId;
        if(typeof projectId!=='string'||!projectId){
          console.warn('[push] Falta projectId de EAS en la compilación.');return;
        }
        const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
        if(disposed)return;
        const response=await fetch(`${serverUrl.replace(/\/+$/,'')}/chat-push-devices.php`,{
          method:'POST',
          headers:{Authorization:`Bearer ${authToken}`,'Content-Type':'text/plain;charset=UTF-8',Accept:'application/json'},
          body:JSON.stringify({action:'register',push_token:token,platform:Platform.OS}),
        });
        const data=await response.json().catch(()=>null);
        if(!response.ok||data?.success!==true)throw new Error(data?.message||`HTTP ${response.status}`);
        registration.current={token,userId};
        console.info('[push] Dispositivo registrado correctamente (sin mostrar el token).');
      }catch(error){console.warn('[push] No fue posible registrar este dispositivo:',error);}
    };
    pending.current=register();
    return()=>{disposed=true;};
  },[serverUrl,userId,authToken]);

  const unregister=useCallback(async()=>{
    await pending.current?.catch(()=>undefined);
    const record=registration.current;
    if(!record||record.userId!==userId||!authToken)return;
    try{
      const response=await fetch(`${serverUrl.replace(/\/+$/,'')}/chat-push-devices.php`,{
        method:'POST',
        headers:{Authorization:`Bearer ${authToken}`,'Content-Type':'text/plain;charset=UTF-8',Accept:'application/json'},
        body:JSON.stringify({action:'unregister',push_token:record.token}),
      });
      if(response.ok)registration.current=null;
    }catch(error){console.warn('[push] No fue posible revocar el token:',error);}
  },[serverUrl,userId,authToken]);

  return {unregister};
}
