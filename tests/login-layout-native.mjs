// Real React/ScrollView with simulated native keyboard events and available viewport.
// This does not replace a physical iOS/Android keyboard test.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const bundle=await build({write:false,bundle:true,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {View,Text,TextInput,TouchableOpacity} from 'react-native-web';
import {LoginFormLayout} from './src/native/components/LoginFormLayout';
window.testPlatform='ios';window.keyboardVisible=false;window.listeners=new Map();
window.emitKeyboard=name=>{window.keyboardVisible=name.endsWith('Show');for(const listener of window.listeners.get(name)||[])listener();};
const content={flexGrow:1,justifyContent:'flex-start',alignItems:'center',paddingVertical:24,paddingHorizontal:16};
function App(){return <View style={{flex:1,backgroundColor:'#f1f5f9'}}><LoginFormLayout contentContainerStyle={content}>
 <View testID="login-card" style={{width:'100%',maxWidth:380,height:520,backgroundColor:'white',borderRadius:28,padding:24,justifyContent:'space-between'}}>
  <Text style={{fontSize:24}}>C5i Walkiet</Text>
  <TextInput placeholder="Teléfono o correo"/>
  <TextInput placeholder="Contraseña" secureTextEntry/>
  <TouchableOpacity accessibilityRole="button" onPress={()=>window.submitted=true}><Text>Iniciar Sesión</Text></TouchableOpacity>
 </View>
</LoginFormLayout></View>;}
const root=createRoot(document.getElementById('root'));let generation=0;
window.mount=platform=>{window.testPlatform=platform;root.render(<App key={++generation}/>);};
window.unmount=()=>root.render(null);
`},plugins:[{name:'native-keyboard-adapter',setup(builder){
 builder.onResolve({filter:/^react-native$/},()=>({path:'react-native',namespace:'keyboard-adapter'}));
 builder.onLoad({filter:/.*/,namespace:'keyboard-adapter'},()=>({loader:'jsx',resolveDir:process.cwd(),contents:`
import React from 'react';import * as Web from 'react-native-web';export * from 'react-native-web';
export const Platform=new Proxy({}, {get:(_target,key)=>key==='OS'?window.testPlatform:undefined});
export const Keyboard={isVisible:()=>window.keyboardVisible,addListener:(name,listener)=>{const listeners=window.listeners.get(name)||new Set();window.listeners.set(name,listeners);listeners.add(listener);return {remove:()=>listeners.delete(listener)};}};
export function KeyboardAvoidingView(props){window.keyboardBehavior=props.behavior;return <Web.KeyboardAvoidingView {...props}/>;}
` }));
}}]});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost:3002/login-layout-test',r=>r.fulfill({contentType:'text/html',body:'<style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}body{overflow:hidden}</style><div id="root"></div>'}));
 await page.goto('http://localhost:3002/login-layout-test');await page.addScriptTag({content:bundle.outputFiles[0].text});
 const card=page.getByTestId('login-card'),scroll=page.getByTestId('login-scroll');
 for(const platform of ['ios','android']){
  await page.setViewportSize({width:430,height:932});await page.evaluate(platform=>{window.keyboardVisible=false;window.mount(platform);},platform);
  await card.waitFor();await page.waitForFunction(()=>document.querySelector('[data-testid="login-card"]').getBoundingClientRect().y>150);
  let rect=await card.boundingBox();assert.ok(Math.abs(rect.y+rect.height/2-932/2)<1,platform+' centers vertically');
  assert.equal(await page.evaluate(()=>window.keyboardBehavior),platform==='ios'?'padding':'height');
  await page.getByPlaceholder('Teléfono o correo').fill('7710000000');
  await page.evaluate(platform=>window.emitKeyboard(platform==='ios'?'keyboardWillShow':'keyboardDidShow'),platform);
  await page.waitForFunction(()=>document.querySelector('[data-testid="login-card"]').getBoundingClientRect().y===24);
  await page.setViewportSize({width:430,height:390});await page.getByPlaceholder('Contraseña').fill('synthetic-password');
  assert.ok(await scroll.evaluate(e=>e.scrollHeight>e.clientHeight),platform+' can scroll above the keyboard');
  await page.getByRole('button',{name:'Iniciar Sesión'}).click();assert.equal(await page.evaluate(()=>window.submitted),true);
  await page.evaluate(platform=>window.emitKeyboard(platform==='ios'?'keyboardWillHide':'keyboardDidHide'),platform);
  await page.setViewportSize({width:430,height:932});
  await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="login-card"]'),r=e.getBoundingClientRect();return Math.abs(r.y+r.height/2-innerHeight/2)<1;});
  assert.equal(await page.getByPlaceholder('Teléfono o correo').inputValue(),'7710000000');assert.equal(await page.getByPlaceholder('Contraseña').inputValue(),'synthetic-password');
  await page.setViewportSize({width:320,height:480});
  await page.getByPlaceholder('Contraseña').fill('small-screen');await page.getByRole('button',{name:'Iniciar Sesión'}).click();
  await page.evaluate(()=>window.unmount());await card.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>[...window.listeners.values()].reduce((n,set)=>n+set.size,0)),0,'Keyboard listeners are removed.');
  console.log('PASS '+platform+': centered with keyboard closed, raised and scrollable while open, recentered without losing input, small-screen access and listener cleanup.');
 }
 await page.setViewportSize({width:430,height:932});await page.evaluate(()=>window.mount('web'));await card.waitFor();
 assert.equal((await card.boundingBox()).y,24,'Web retains its existing top alignment.');
 assert.equal(await page.evaluate(()=>[...window.listeners.values()].reduce((n,set)=>n+set.size,0)),0);
 assert.deepEqual(errors,[]);console.log('PASS web: existing alignment retained.');
}finally{await browser.close();}
