// Lógica nativa con React real y adaptadores simulados; no valida APNs ni audio físico.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({write:false,bundle:true,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useRadioNotifications} from './src/native/ptt/useRadioNotifications.native';
import {soundEngine} from './src/services/soundEngine.native';
const constants={executionEnvironment:'bare',easConfig:{},expoConfig:{extra:{}}};
window.testConstants=constants;window.permissionRequests=0;window.played=0;window.calls=[];
window.mockNotifications={
 setNotificationHandler:handler=>{window.notificationHandler=handler;},
 addNotificationResponseReceivedListener:()=>({remove(){}}),
 getLastNotificationResponseAsync:async()=>null,
 getPermissionsAsync:async()=>{window.permissionRequests++;return {granted:true};},
 getExpoPushTokenAsync:async()=>({data:'ExpoPushToken[synthetic-only-token]'}),
};
window.mockAudio={createAudioPlayer:()=>({seekTo:async()=>{},play(){window.played++;},remove(){},volume:1})};
window.fetch=async(_url,request)=>{window.calls.push(JSON.parse(request.body).action);return {ok:true,json:async()=>({success:true})};};
let allowed=false;const root=createRoot(document.getElementById('root'));
function App(){const state=useRadioNotifications('https://synthetic.example.test','synthetic-session','synthetic-user',()=>{},allowed,false);window.notifications=state;return <span>{state.available?'available':'unavailable'}</span>;}
window.reconfigure=(project,enabled)=>{constants.easConfig.projectId=project;allowed=enabled;root.render(<App/>);};
window.sounds=soundEngine;root.render(<App/>);
`},plugins:[{name:'native-adapters',setup(builder){
  builder.onResolve({filter:/^(react-native|expo-constants|expo-device|expo-notifications|expo-audio)$/},args=>({path:args.path,namespace:'native-stub'}));
  builder.onLoad({filter:/.*/,namespace:'native-stub'},args=>({loader:'js',contents:{
    'react-native':'export const Platform={OS:"ios"};export const Vibration={vibrate(){}};',
    'expo-constants':'export default new Proxy({}, {get:(_target,key)=>window.testConstants?.[key]});',
    'expo-device':'export const isDevice=true;',
    'expo-notifications':'module.exports=new Proxy({}, {get:(_target,key)=>window.mockNotifications[key]});',
    'expo-audio':'module.exports={createAudioPlayer:(...args)=>window.mockAudio.createAudioPlayer(...args)};',
  }[args.path]}));
}}]});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.route('http://localhost:3002/settings-test',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
 await page.goto('http://localhost:3002/settings-test');await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.waitForFunction(()=>window.notifications?.unavailableReason==='Avisos push sin configurar.');
 assert.equal(await page.evaluate(()=>window.notifications.enable()),false);
 assert.equal(await page.evaluate(()=>window.permissionRequests),0,'Sin configuración no pide permisos que no podrá utilizar.');
 await page.evaluate(()=>window.reconfigure('synthetic-project',false));await page.waitForFunction(()=>window.notifications.available);
 assert.equal(await page.evaluate(()=>window.notifications.enable()),true);
 await page.evaluate(()=>window.reconfigure('synthetic-project',true));await page.waitForFunction(()=>window.notifications.enabled);
 let display=await page.evaluate(()=>window.notificationHandler.handleNotification());assert.equal(display.shouldShowBanner,true);assert.equal(display.shouldPlaySound,false);
 await page.evaluate(()=>window.reconfigure('synthetic-project',false));await page.waitForFunction(()=>!window.notifications.enabled);
 display=await page.evaluate(()=>window.notificationHandler.handleNotification());assert.equal(display.shouldShowBanner,false);assert.equal(display.shouldPlaySound,false);
 await page.waitForFunction(()=>window.calls.includes('unregister_device'));
 await page.evaluate(async()=>{window.sounds.setMessageSounds(false);window.sounds.setRogerBeep(false);window.sounds.playIncomingChirp();window.sounds.playRogerBeep();await Promise.resolve();});
 assert.equal(await page.evaluate(()=>window.played),0);
 await page.evaluate(async()=>{window.sounds.setMessageSounds(true);window.sounds.setRogerBeep(true);window.sounds.playIncomingChirp();window.sounds.playRogerBeep();await Promise.resolve();});
 assert.equal(await page.evaluate(()=>window.played),2);
 console.log('OK lógica nativa: avisos sin configuración no solicitan permisos, registro real del adaptador, baja al apagar, sonidos y avisos respetan preferencias.');
}finally{await browser.close();}
