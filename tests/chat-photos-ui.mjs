import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';if(base!=='http://127.0.0.1:8103')throw Error('Usa solo contacts_test_account.');
const post=async(path,token,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'text/plain',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});assert.ok(r.ok,await r.clone().text());return r.json();};
const login=async phone=>(await post('/login.php',null,{phone_number:phone,password:'profile-test-password'})).token;
const aToken=await login('7710000301'),bToken=await login('7710000302');await post('/contacts.php',aToken,{action:'create',name:'Compañero B',phone_number:'7710000302',email:''});const thread=(await post('/chat-sync.php',aToken,{action:'direct',target_user_id:'account-b'})).thread_id;
const messages=async()=>{const r=await fetch(base+'/chat-sync.php?'+new URLSearchParams({action:'messages',thread_id:thread}),{headers:{Authorization:'Bearer '+aToken}});assert.ok(r.ok);return (await r.json()).messages;};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const errors=[],downloads=[];
const open=async phone=>{
 const context=await browser.newContext({viewport:{width:430,height:932},permissions:['camera'],hasTouch:true,timezoneId:'America/Mexico_City'});
 await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Radio de prueba detenida"}'}));
 await context.addInitScript(server=>localStorage.setItem('c5i_native_server_url',server),base);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d));await page.goto(url);await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();await page.getByText('PTT',{exact:true}).waitFor();await page.getByText('Chat',{exact:true}).click();return page;
};
try{
 const a=await open('7710000301'),b=await open('7710000302');await a.getByLabel('Nueva conversación',{exact:true}).click();await a.getByText('Compañero B',{exact:true}).click();
 await a.getByLabel('Adjuntar archivo o evidencia',{exact:true}).click();await a.getByText('Cámara',{exact:true}).click();
 await a.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.videoWidth>0;});await a.getByRole('button',{name:'Capturar foto',exact:true}).click();
 await a.getByLabel('Abrir imagen',{exact:true}).waitFor();await a.getByLabel('Entregado',{exact:true}).waitFor({timeout:15000});
 let photos=(await messages()).filter(m=>m.mediaType==='image');assert.equal(photos.length,1);assert.equal(photos[0].text,'');assert.ok(photos[0].mediaUrl.startsWith('data:image/jpeg;base64,'));assert.equal(await a.getByText(/Foto [Cc]apturada/).count(),0);
 await b.getByText('Prueba Perfil A',{exact:true}).click();await b.getByLabel('Abrir imagen',{exact:true}).waitFor();await b.getByLabel('Abrir imagen',{exact:true}).click();
 const viewer=b.getByTestId('photo-viewer'),canvas=viewer.getByTestId('photo-canvas');await viewer.waitFor();await viewer.getByRole('button',{name:'Acercar imagen',exact:true}).click();await viewer.getByText('150%',{exact:true}).waitFor();
 await canvas.dblclick();await viewer.getByText('100%',{exact:true}).waitFor();await canvas.dblclick();await viewer.getByText('200%',{exact:true}).waitFor();
 const box=await canvas.boundingBox();await b.mouse.move(box.x+box.width/2,box.y+box.height/2);await b.mouse.down();await b.mouse.move(box.x+box.width/2+80,box.y+box.height/2,{steps:8});await b.mouse.up();assert.match(await canvas.locator('img').getAttribute('style'),/translate\([1-9]/);
 await viewer.getByRole('button',{name:'Restablecer zoom',exact:true}).click();await viewer.getByText('100%',{exact:true}).waitFor();
 const cdp=await b.context().newCDPSession(b);const cx=box.x+box.width/2,cy=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-35,y:cy},{x:cx+35,y:cy}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-85,y:cy},{x:cx+85,y:cy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await b.waitForFunction(()=>Number(document.querySelector('[aria-label="Restablecer zoom"]').textContent.replace('%',''))>200);await cdp.detach();
 assert.equal(downloads.length,0,'La web no descarga automáticamente ni al abrir/recibir fotos.');
 const download=b.waitForEvent('download');await viewer.getByRole('button',{name:'Descargar imagen',exact:true}).click();assert.match((await download).suggestedFilename(),/foto-chat\.jpg/);
 await b.screenshot({path:'/tmp/chat-photo-zoom-mobile.png',fullPage:true});await b.keyboard.press('Escape');await viewer.waitFor({state:'hidden'});
 const old=await post('/chat-sync.php',bToken,{action:'send',thread_id:thread,mediaType:'image',text:'📸 Foto Capturada con Cámara Táctica',mediaUrl:photos[0].mediaUrl,fileName:'legacy.jpg'});
 await a.getByTestId('chat-message-'+old.id).getByLabel('Abrir imagen',{exact:true}).waitFor();assert.equal(await a.getByText(/Foto [Cc]apturada/).count(),0,'Tampoco muestra el rótulo de fotos anteriores.');
 await a.reload();await a.getByText('Chat',{exact:true}).click();await a.getByText('Compañero B',{exact:true}).click();await a.getByLabel('Abrir imagen',{exact:true}).nth(1).waitFor();assert.equal(await a.getByLabel('Abrir imagen',{exact:true}).count(),2);await a.screenshot({path:'/tmp/chat-photos-mobile.png',fullPage:true});
 await b.getByLabel('Volver a los chats',{exact:true}).click();await b.getByText('Perfil',{exact:true}).click();await b.getByLabel('Configuración y ajustes',{exact:true}).click();const pref=b.getByLabel('Guardar fotos automáticamente',{exact:true});await pref.waitFor();assert.equal(await pref.isChecked(),true);await pref.click();await b.waitForFunction(()=>document.querySelector('[aria-label="Guardar fotos automáticamente"]').checked===false);
 await b.reload();await b.getByText('Perfil',{exact:true}).click();await b.getByLabel('Configuración y ajustes',{exact:true}).click();assert.equal(await b.getByLabel('Guardar fotos automáticamente',{exact:true}).isChecked(),false);assert.equal((await post('/account.php',bToken,{action:'get'})).settings.autoSavePhotos,false);assert.equal((await post('/account.php',aToken,{action:'get'})).settings.autoSavePhotos,true);
 await b.getByLabel('Guardar fotos automáticamente',{exact:true}).scrollIntoViewIfNeeded();await b.screenshot({path:'/tmp/chat-photo-settings-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('OK fotos UI: cámara real simulada sin leyenda, recepción/recarga, visor, zoom botones/doble toque/pellizco, arrastre, descarga manual y ajuste persistente por cuenta.');
}catch(cause){for(const [i,ctx]of browser.contexts().entries())for(const page of ctx.pages())await page.screenshot({path:'/tmp/photo-failure-'+i+'.png',fullPage:true}).catch(()=>{});throw cause;}
finally{await browser.close();}
