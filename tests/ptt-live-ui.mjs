// Ejecutar solo con fixture contacts_test_ptt + PHP/LiveKit/proveedor push locales.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PTT_TEST_BACKEND;
if (base !== 'http://127.0.0.1:8101') throw new Error('Se requiere PTT_TEST_BACKEND=http://127.0.0.1:8101 exclusivo de pruebas.');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const errors=[];
const login = async phone => {
  const response=await fetch(base+'/login.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identificador:phone,password:'ptt-test-password'})});
  const session=await response.json();assert.ok(session.token);return session;
};
const aSession=await login('7710000201'),bSession=await login('7710000202'),cSession=await login('7710000203');
const request=async(token,action,body={})=>{
  const response=await fetch(base+'/ptt.php',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,channel_id:'ptt-test-channel',device_id:'a'.repeat(32),...body})});
  return {status:response.status,data:await response.json()};
};
try {
  assert.equal((await request(null,'connect')).status,401);
  assert.equal((await request(cSession.token,'connect')).status,404);
  const cors=await fetch(base+'/ptt.php',{method:'OPTIONS',headers:{Origin:'http://localhost:8081','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(cors.status,200);assert.equal(cors.headers.get('access-control-allow-origin'),'http://localhost:8081');
  const legacy=await fetch(base+'/voice-messages.php',{method:'POST',headers:{Origin:'http://localhost:8081'}});
  assert.equal(legacy.status,410);assert.ok(legacy.headers.get('access-control-allow-origin'));
  await request(aSession.token,'register_device',{push_token:'ExpoPushToken[ptt_sender_synthetic_1234]',platform:'android'});
  await request(bSession.token,'register_device',{push_token:'ExpoPushToken[ptt_recipient_synthetic_5678]',platform:'ios'});
  await request(cSession.token,'register_device',{push_token:'ExpoPushToken[ptt_outsider_synthetic_9012]',platform:'android'});
  const setup=async(session)=>{
    const context=await browser.newContext({viewport:{width:430,height:932},permissions:['microphone']});
    await context.route('**/walkiet.alwaysdata.net/**',route=>route.abort());
    await context.addInitScript(({server,user})=>{
      localStorage.setItem('c5i_native_server_url',server);
      localStorage.setItem('c5i_native_user',JSON.stringify({...user.user,badge:'TEST-RADIO',role:'Operador',unit:'Pruebas',authToken:user.token}));
      localStorage.setItem('c5i_last_selected_channel_'+encodeURIComponent(user.user.id),JSON.stringify({id:'ptt-test-channel',name:'GRUPO RADIO DE PRUEBAS'}));
      const Original=window.RTCPeerConnection;
      window.__pttPeers=[];window.__pttTracks=[];window.__pttTrace=[];
      window.RTCPeerConnection=class extends Original {constructor(...args){super(...args);window.__pttPeers.push(this);this.addEventListener('icecandidate',e=>{if(e.candidate)window.__pttTrace.push({candidate:e.candidate.type,address:e.candidate.address,port:e.candidate.port,protocol:e.candidate.protocol});});this.addEventListener('iceconnectionstatechange',()=>window.__pttTrace.push({state:this.iceConnectionState}));this.addEventListener('icecandidateerror',e=>window.__pttTrace.push({error:e.errorCode,text:e.errorText}));}};
      const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await capture(...args);window.__pttTracks.push(...stream.getTracks());return stream;};
    },{server:base,user:session});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.PTT_UI_URL||'http://localhost:3000');
    await page.getByText('GRUPO RADIO DE PRUEBAS',{exact:true}).waitFor();
    await page.getByLabel('Conectar radio',{exact:true}).click();
    await page.getByText('Radio conectada',{exact:true}).waitFor({timeout:35000}).catch(async error=>{console.log('Estado de radio:',await page.locator('body').innerText());console.log('Errores',errors);console.log('RTC',await page.evaluate(()=>window.__pttPeers.map(p=>({connection:p.connectionState,ice:p.iceConnectionState,local:!!p.localDescription,remote:!!p.remoteDescription}))));await page.screenshot({path:'/tmp/ptt-connect-error.png'});throw error;});
    return page;
  };
  const a=await setup(aSession), b=await setup(bSession);
  // Aún conectadas, las salas no autorizan publicar hasta pulsar PTT.
  const permissions=await request(aSession.token,'connect',{device_id:'c'.repeat(32)});
  const claims=JSON.parse(Buffer.from(permissions.data.token.split('.')[1],'base64url').toString());
  assert.equal(claims.video.canPublish,false);assert.equal(claims.video.canSubscribe,true);assert.equal(claims.sub,permissions.data.identity);
  const ptt=a.getByLabel('Mantén presionado para transmitir al grupo',{exact:true});
  const box=await ptt.boundingBox();assert.ok(box);
  await a.mouse.move(box.x+box.width/2,box.y+box.height/2);await a.mouse.down();
  await a.getByText(/Transmitiendo ·/).waitFor({timeout:10000});
  await b.getByText('Hablando: Radio A',{exact:true}).waitFor({timeout:10000}).catch(async error=>{
    console.log('Estado receptor:',await b.locator('body').innerText());
    console.log('RTC receptor:',await b.evaluate(async()=>Promise.all(window.__pttPeers.map(async peer=>({connection:peer.connectionState,ice:peer.iceConnectionState,reports:[...(await peer.getStats()).values()].filter(report=>['inbound-rtp','outbound-rtp','candidate-pair'].includes(report.type)).map(report=>({type:report.type,state:report.state,packetsReceived:report.packetsReceived,packetsSent:report.packetsSent,energy:report.totalAudioEnergy}))})))));
    throw error;
  });
  const received=async()=>b.evaluate(async()=>{
    let packets=0,energy=0;
    for(const peer of window.__pttPeers){if(peer.connectionState==='closed')continue;for(const report of (await peer.getStats()).values())if(report.type==='inbound-rtp'&&(report.kind==='audio'||report.mediaType==='audio')){packets+=report.packetsReceived||0;energy+=report.totalAudioEnergy||0;}}
    return {packets,energy};
  });
  let audio;
  for(let i=0;i<30;i++){audio=await received();if(audio.packets>10&&audio.energy>0)break;await new Promise(r=>setTimeout(r,150));}
  assert.ok(audio.packets>10,JSON.stringify(audio));assert.ok(audio.energy>0,'Se deben decodificar muestras de audio, no solo señalización.');
  await request(bSession.token,'connect',{device_id:'b'.repeat(32)});
  const busy = await request(bSession.token,'start',{device_id:'b'.repeat(32),transmission_id:'b'.repeat(32)});
  assert.equal(busy.status,409);assert.match(busy.data.message,/canal está ocupado/);
  await a.mouse.up();
  await a.getByText('Mantén presionado para hablar',{exact:true}).waitFor();
  for(let i=0;i<30;i++){if(await a.evaluate(()=>window.__pttTracks.every(t=>t.readyState==='ended')))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await a.evaluate(()=>window.__pttTracks.every(t=>t.readyState==='ended')),true);
  let events=[];
  for(let i=0;i<30;i++){events=await(await fetch('http://127.0.0.1:8102/events')).json();if(events.length)break;await new Promise(r=>setTimeout(r,150));}
  assert.ok(events.some(event=>event.to==='ExpoPushToken[ptt_recipient_synthetic_5678]'));
  assert.ok(events.every(event=>event.to!=='ExpoPushToken[ptt_sender_synthetic_1234]'&&event.to!=='ExpoPushToken[ptt_outsider_synthetic_9012]'));
  // Liberar antes de que start regrese nunca abre un micrófono después.
  let releaseStart;const delayed=new Promise(resolve=>{releaseStart=resolve;});
  await a.route('**/api/ptt',async route=>{if(route.request().postDataJSON()?.action==='start'){await delayed;}await route.continue();});
  await a.mouse.down();await a.waitForTimeout(250);await a.mouse.up();releaseStart();
  await a.waitForTimeout(900);
  assert.equal(await a.getByText(/Transmitiendo ·/).count(),0);
  assert.equal(await a.evaluate(()=>window.__pttTracks.every(t=>t.readyState==='ended')),true);
  await a.unroute('**/api/ptt');
  const socketPath=process.env.CONTACTS_TEST_SOCKET;
  if(socketPath){
    const mysql=await import('mysql2/promise');const db=await mysql.createConnection({socketPath,user:'root',database:'contacts_test_ptt'});
    try {
      await a.mouse.down();await a.getByText(/Transmitiendo ·/).waitFor();
      await db.execute('UPDATE ptt_floor SET expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE channel_id=?',['ptt-test-channel']);
      await a.getByText('La transmisión terminó. Suelta el botón para volver a hablar.',{exact:true}).waitFor({timeout:12000});
      await a.mouse.up();
      assert.equal(await a.evaluate(()=>window.__pttTracks.every(t=>t.readyState==='ended')),true);
    }finally{await db.end();}
  }
  await a.getByLabel('Desconectar radio',{exact:true}).click();
  await a.getByText('Radio desconectada',{exact:true}).waitFor();
  await b.getByLabel('Desconectar radio',{exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('OK PTT real: CORS, autorización por grupo, WebRTC/Opus recibido con energía de audio, turno exclusivo, corte al soltar, respuesta tardía segura y push solo a otro miembro.');
}finally{await browser.close();}
