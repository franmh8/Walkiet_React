import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';if(base!=='http://127.0.0.1:8103')throw Error('Usa solo contacts_test_account.');
const samples=48000*8,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(48000,24);wav.writeUInt32LE(96000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.sin(i*2*Math.PI*440/48000)*12000,44+i*2);writeFileSync('/tmp/walkiet-voice-mic.wav',wav);
const post=async(path,token,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'text/plain',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});assert.ok(r.ok);return r.json();};
const login=async phone=>(await post('/login.php',null,{phone_number:phone,password:'profile-test-password'})).token;
const aToken=await login('7710000301');await post('/contacts.php',aToken,{action:'create',name:'Compañero B',phone_number:'7710000302',email:''});const thread=(await post('/chat-sync.php',aToken,{action:'direct',target_user_id:'account-b'})).thread_id;
const messages=async()=>{const r=await fetch(base+'/chat-sync.php?'+new URLSearchParams({action:'messages',thread_id:thread}),{headers:{Authorization:'Bearer '+aToken}});assert.ok(r.ok);return (await r.json()).messages;};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/tmp/walkiet-voice-mic.wav']});
const errors=[];
const open=async phone=>{
 const context=await browser.newContext({viewport:{width:430,height:932},permissions:['microphone'],timezoneId:'America/Mexico_City'});
 await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Radio de prueba detenida"}'}));
 await context.addInitScript(server=>{
  localStorage.setItem('c5i_native_server_url',server);window.__micStreams=[];window.__micDelay=0;window.__micDenied=false;
  const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{if(window.__micDenied)throw new DOMException('Denied','NotAllowedError');if(window.__micDelay)await new Promise(r=>setTimeout(r,window.__micDelay));const stream=await get(options);window.__micStreams.push(stream);return stream;};
 },base);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();await page.getByText('PTT',{exact:true}).waitFor();await page.getByText('Chat',{exact:true}).click();return page;
};
const hold=async page=>{const button=page.getByLabel('Enviar nota de voz',{exact:true}),box=await button.boundingBox();assert.ok(box);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();};
const recording=page=>page.waitForFunction(()=>document.querySelector('[data-testid="voice-recording-status"]')?.textContent.includes('Grabando'));
const closed=page=>page.waitForFunction(()=>window.__micStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')));
try{
 const a=await open('7710000301'),b=await open('7710000302');await a.getByLabel('Nueva conversación',{exact:true}).click();await a.getByText('Compañero B',{exact:true}).click();
 await hold(a);await recording(a);await a.waitForTimeout(1600);await a.mouse.up();
 await a.getByTestId('voice-note-player').locator('audio').waitFor();await closed(a);await a.getByLabel('Entregado',{exact:true}).waitFor({timeout:22000});
 let notes=(await messages()).filter(m=>m.mediaType==='voice');assert.equal(notes.length,1);const first=notes[0];assert.ok(first.mediaUrl.startsWith('data:audio/wav;base64,'));assert.ok(first.mediaUrl.length>10000);assert.equal(first.fileName,'nota-de-voz.wav');
 await b.getByText('Prueba Perfil A',{exact:true}).click();const audio=b.getByTestId('voice-note-player').locator('audio');await audio.waitFor();
 assert.equal(await audio.getAttribute('src'),first.mediaUrl,'La otra cuenta recibe el archivo, no un blob local.');
 const decoded=await audio.evaluate(async element=>{const context=new AudioContext();try{const buffer=await context.decodeAudioData(await(await fetch(element.src)).arrayBuffer());let energy=0;for(const x of buffer.getChannelData(0))energy+=x*x;return {duration:buffer.duration,rms:Math.sqrt(energy/buffer.length)};}finally{await context.close();}});
 assert.ok(decoded.duration>0.8&&decoded.duration<5);assert.ok(decoded.rms>0.01,'El audio grabado contiene la señal real del micrófono de prueba.');
 await audio.click({position:{x:18,y:18}});await b.waitForFunction(()=>{const audio=document.querySelector('audio');return audio&&!audio.paused&&audio.currentTime>0.1;});await audio.evaluate(el=>el.pause());
 await b.reload();await b.getByText('Chat',{exact:true}).click();await b.getByText('Prueba Perfil A',{exact:true}).click();await b.getByTestId('voice-note-player').locator('audio').waitFor();
 // Toque corto, permiso tardío, cancelación y fondo nunca crean otra nota.
 await a.getByLabel('Enviar nota de voz',{exact:true}).click();await a.waitForTimeout(600);await closed(a);assert.equal((await messages()).filter(m=>m.mediaType==='voice').length,1);
 await a.evaluate(()=>window.__micDelay=800);await hold(a);await a.waitForTimeout(80);await a.mouse.up();await a.waitForTimeout(1200);await closed(a);await a.evaluate(()=>window.__micDelay=0);
 await hold(a);await recording(a);await a.waitForTimeout(600);await a.getByLabel('Cancelar nota de voz',{exact:true}).dispatchEvent('click');await a.mouse.up();await closed(a);
 await hold(a);await recording(a);await a.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await a.mouse.up();await closed(a);await a.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await a.waitForTimeout(1200);assert.equal((await messages()).filter(m=>m.mediaType==='voice').length,1);
 await a.evaluate(()=>window.__micDenied=true);await hold(a);await a.mouse.up();const denied=a.getByRole('dialog',{name:'Nota de voz',exact:true});await denied.getByText(/Autoriza el micrófono/).waitFor();await denied.getByRole('button',{name:'Entendido',exact:true}).click();await a.evaluate(()=>window.__micDenied=false);
 // Una nota real también sobrevive a recargar sin conexión y se envía una vez.
 await a.route(base+'/**',route=>route.abort());await a.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}));
 await hold(a);await recording(a);await a.waitForTimeout(1200);await a.mouse.up();await a.getByLabel('Pendiente de envío',{exact:true}).waitFor();await closed(a);
 await a.reload();await a.getByText('Chat',{exact:true}).click();await a.getByText('Compañero B',{exact:true}).click();await a.getByLabel('Pendiente de envío',{exact:true}).waitFor();assert.equal(await a.getByTestId('voice-note-player').locator('audio').count(),1);
 await a.unroute(base+'/**');await a.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'));});
 await a.getByLabel(/^(Entregado|Leído)$/).last().waitFor({timeout:22000});await a.waitForTimeout(4500);notes=(await messages()).filter(m=>m.mediaType==='voice');assert.equal(notes.length,2);assert.ok(notes.every(m=>m.mediaUrl?.startsWith('data:audio/wav;base64,')));
 await a.screenshot({path:'/tmp/chat-real-voice-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('OK voz UI real: micrófono y archivo con muestras audibles, mantener/soltar, entrega/reproducción/recarga en otra cuenta, cancelación, permisos tardíos/denegados, fondo y audio offline persistente sin duplicados.');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/voice-failure-'+browser.contexts().indexOf(context)+'.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();}
