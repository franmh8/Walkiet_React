// Native hook behavior with real React and simulated platform adapters; no APNs traffic.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({write:false,bundle:true,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {useRadioNotifications} from './src/native/ptt/useRadioNotifications.native';
import {useChatPushNotifications} from './src/native/chat/useChatPushNotifications';
import {isMissingIosPushEntitlement} from './src/native/notifications/pushAvailability';
window.isMissing=isMissingIosPushEntitlement;
window.nativePlatform={OS:'ios'};window.pushFailure=null;window.tokenCalls=0;window.requests=[];
window.mockNotifications={
 AndroidImportance:{HIGH:4,MAX:5},setNotificationChannelAsync:async()=>{},
 setNotificationHandler:()=>{},addNotificationResponseReceivedListener:()=>({remove(){}}),
 getLastNotificationResponseAsync:async()=>null,clearLastNotificationResponseAsync:async()=>{},
 getPermissionsAsync:async()=>({granted:true}),
 getExpoPushTokenAsync:async()=>{window.tokenCalls++;if(window.pushFailure)throw new Error(window.pushFailure);return {data:'ExpoPushToken[synthetic-test]'};},
};
window.fetch=async(url,request)=>{window.requests.push({url,action:JSON.parse(request.body).action});return {ok:true,status:200,json:async()=>({success:true})};};
function Radio({user}){const state=useRadioNotifications('https://synthetic.example.test','synthetic-token',user,()=>{},true);window.radio=state;return <span>{state.available?'available':'unavailable'}</span>;}
function Chat({user}){window.chat=useChatPushNotifications('https://synthetic.example.test',user,'synthetic-token',()=>{});return <span>chat</span>;}
const root=createRoot(document.getElementById('root'));
window.mount=(kind,platform,user='synthetic-user')=>{window.nativePlatform.OS=platform;const Component=kind==='radio'?Radio:Chat;root.render(<Component key={kind+platform} user={user}/>);};
`},plugins:[{name:'native-adapters',setup(builder){
 builder.onResolve({filter:/^(react-native|expo-constants|expo-device|expo-notifications)$/},args=>({path:args.path,namespace:'native-stub'}));
 builder.onLoad({filter:/.*/,namespace:'native-stub'},args=>({loader:'js',contents:{
  'react-native':'export const Platform=new Proxy({}, {get:(_target,key)=>window.nativePlatform[key]});',
  'expo-constants':'export default {executionEnvironment:"bare",appOwnership:"standalone",easConfig:{projectId:"synthetic-project"}};',
  'expo-device':'export const isDevice=true;',
  'expo-notifications':Object.keys({AndroidImportance:0,setNotificationChannelAsync:0,setNotificationHandler:0,addNotificationResponseReceivedListener:0,getLastNotificationResponseAsync:0,clearLastNotificationResponseAsync:0,getPermissionsAsync:0,getExpoPushTokenAsync:0}).map(name=>name==='AndroidImportance'?'export const AndroidImportance={HIGH:4,MAX:5};':`export const ${name}=(...args)=>window.mockNotifications.${name}(...args);`).join(''),
 }[args.path]}));
}}]});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[],warnings=[];
 page.setDefaultTimeout(7000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
 await page.route('http://localhost:3002/push-test',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
 await page.goto('http://localhost:3002/push-test');await page.addScriptTag({content:bundle.outputFiles[0].text});
 assert.equal(await page.evaluate(()=>window.isMissing('no valid aps-environment entitlement string found for application','ios')),true);
 assert.equal(await page.evaluate(()=>window.isMissing({message:'no se encontró ninguna cadena de autorización “aps-environment” para la app'},'ios')),true);
 assert.equal(await page.evaluate(()=>window.isMissing('no valid aps-environment entitlement string found for application','android')),false);
 assert.equal(await page.evaluate(()=>window.isMissing(new Error('Network request failed'),'ios')),false);

 await page.evaluate(()=>{window.pushFailure='no valid aps-environment entitlement string found for application';window.mount('radio','ios');});
 await page.waitForFunction(()=>window.radio?.available===false&&!window.radio.busy);
 assert.equal(await page.evaluate(()=>window.radio.unavailableReason),'Avisos no disponibles en esta compilación de iOS.');
 assert.equal(await page.evaluate(()=>window.radio.error),null);
 assert.equal(await page.evaluate(()=>window.requests.length),0,'Un token rechazado no se registra en el servidor.');
 const radioCalls=await page.evaluate(()=>window.tokenCalls);
 assert.equal(await page.evaluate(()=>window.radio.enable()),false);
 await page.evaluate(()=>window.mount('radio','ios','another-user'));
 await page.waitForFunction(()=>window.radio.available===false&&!window.radio.busy);
 assert.equal(await page.evaluate(()=>window.tokenCalls),radioCalls,'No repite el registro de una compilación sin APNs al cambiar de cuenta.');

 await page.evaluate(()=>window.mount('chat','ios'));
 await page.waitForFunction(previous=>window.tokenCalls>previous,radioCalls);
 await page.waitForTimeout(50);const chatCalls=await page.evaluate(()=>window.tokenCalls);
 await page.evaluate(()=>window.mount('chat','ios','another-user'));await page.waitForTimeout(50);
 assert.equal(await page.evaluate(()=>window.tokenCalls),chatCalls);
 assert.equal(await page.evaluate(()=>window.requests.length),0);
 assert.deepEqual(warnings,[],'La limitación conocida de la compilación no genera una advertencia técnica repetida.');

 await page.evaluate(()=>{window.pushFailure=null;window.mount('radio','android');});
 await page.waitForFunction(()=>window.radio?.enabled===true);
 assert.ok(await page.evaluate(()=>window.requests.some(r=>r.action==='register_device')),'Android conserva el registro de avisos.');
 await page.evaluate(()=>window.mount('chat','android'));
 await page.waitForFunction(()=>window.requests.some(r=>r.action==='register'));

 await page.evaluate(()=>{window.pushFailure='Network request failed';window.mount('radio','ios');});
 await page.waitForFunction(()=>window.radio.error==='Network request failed'&&!window.radio.busy);
 assert.equal(await page.evaluate(()=>window.radio.available),true,'Un fallo de red permite reintentar.');
 await page.evaluate(()=>{window.pushFailure=null;});assert.equal(await page.evaluate(()=>window.radio.enable()),true);
 assert.deepEqual(errors,[]);
 console.log('OK: APNs ausente en iOS se maneja sin alerta de radio ni reintentos, Android conserva chat/radio push y los fallos de red permiten reintentar.');
}finally{await browser.close();}
