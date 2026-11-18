import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';
if(base!=='http://127.0.0.1:8103')throw Error('Usa solo contacts_test_account.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const errors=[];
const open=async phone=>{
 const context=await browser.newContext({viewport:{width:430,height:932},timezoneId:'America/Mexico_City'});
 await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Radio de prueba detenida"}'}));
 await context.addInitScript(server=>localStorage.setItem('c5i_native_server_url',server),base);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();await page.getByText('PTT',{exact:true}).waitFor();
 return {page,context};
};
const chat=async(page,name)=>{await page.getByText('Chat',{exact:true}).click();await page.getByText(name,{exact:true}).click();};
const send=async(page,text)=>{await page.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).fill(text);await page.getByLabel('Enviar mensaje',{exact:true}).click();};
const bubble=(page,text)=>page.getByTestId(/^chat-message-(?!scroll)/).filter({has:page.getByText(text,{exact:true})});
const hidden=async(page,value)=>page.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>value});document.dispatchEvent(new Event('visibilitychange'));},value);
try{
 const {page:a,context:ac}=await open('7710000301');await chat(a,'Prueba Perfil B');
 await send(a,'Prueba de envío entrega lectura');const first=bubble(a,'Prueba de envío entrega lectura');await first.getByLabel('Enviado',{exact:true}).waitFor({timeout:18000});
 const {page:b,context:bc}=await open('7710000302');
 await first.getByLabel('Entregado',{exact:true}).waitFor({timeout:20000});assert.equal(await first.getByLabel('Leído',{exact:true}).count(),0,'Recibir en PTT no equivale a leer.');
 await chat(b,'Prueba Perfil A');await first.getByLabel('Leído',{exact:true}).waitFor({timeout:18000});
 // No lee mensajes que llegaron mientras se consulta el historial.
 await b.getByTestId('chat-message-scroll').evaluate(e=>{e.scrollTop=0;e.dispatchEvent(new Event('scroll',{bubbles:true}));});await b.waitForTimeout(150);
 await send(a,'Fuera de pantalla');const unseen=bubble(a,'Fuera de pantalla');await unseen.getByLabel('Entregado',{exact:true}).waitFor({timeout:18000});await b.waitForTimeout(4500);assert.equal(await unseen.getByLabel('Leído',{exact:true}).count(),0);
 await b.getByLabel('Ir a los mensajes más recientes',{exact:true}).click();await unseen.getByLabel('Leído',{exact:true}).waitFor({timeout:18000});
 await hidden(b,true);await send(a,'Mensaje con app en segundo plano');const background=bubble(a,'Mensaje con app en segundo plano');await background.getByLabel('Enviado',{exact:true}).waitFor({timeout:18000});await b.waitForTimeout(5000);assert.equal(await background.getByLabel('Leído',{exact:true}).count(),0);
 await hidden(b,false);await background.getByLabel('Leído',{exact:true}).waitFor({timeout:18000});
 await b.getByLabel('Volver a los chats',{exact:true}).click();await b.getByText('Perfil',{exact:true}).click();await b.getByLabel('Configuración y ajustes',{exact:true}).click();
 const privacy=b.getByLabel('Confirmaciones de lectura',{exact:true});await privacy.waitFor();assert.equal(await privacy.isChecked(),true);await privacy.click();await b.waitForFunction(()=>document.querySelector('[aria-label="Confirmaciones de lectura"]').checked===false);
 await b.reload();await b.getByText('Perfil',{exact:true}).click();await b.getByLabel('Configuración y ajustes',{exact:true}).click();assert.equal(await b.getByLabel('Confirmaciones de lectura',{exact:true}).isChecked(),false);
 await b.getByLabel('Volver al perfil',{exact:true}).click();await chat(b,'Prueba Perfil A');
 await send(a,'Lectura privada');const privateBubble=bubble(a,'Lectura privada');await privateBubble.getByLabel('Entregado',{exact:true}).waitFor({timeout:18000});await b.getByText('Lectura privada',{exact:true}).waitFor();await b.waitForTimeout(5000);assert.equal(await privateBubble.getByLabel('Leído',{exact:true}).count(),0);
 await hidden(b,true);await a.getByText(/^Última vez /).waitFor({timeout:22000});await hidden(b,false);
 await a.route(base+'/**',route=>route.abort());
 await a.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}));
 await send(a,'Envío sin conexión persistente');await bubble(a,'Envío sin conexión persistente').getByLabel('Pendiente de envío',{exact:true}).waitFor();
 await a.reload();await a.getByText('Chat',{exact:true}).click();await a.getByText('Prueba Perfil B',{exact:true}).click();await bubble(a,'Envío sin conexión persistente').getByLabel('Pendiente de envío',{exact:true}).waitFor();
 const local=await a.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('walkiet_outbox_v1:')));assert.equal(local.length,1);assert.ok(!local[0][1].includes('authToken'));
 await a.unroute(base+'/**');await a.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'));});
 await bubble(a,'Envío sin conexión persistente').getByLabel('Entregado',{exact:true}).waitFor({timeout:22000});await b.getByText('Envío sin conexión persistente',{exact:true}).waitFor();
 await a.waitForFunction(()=>!Object.keys(localStorage).some(key=>key.startsWith('walkiet_outbox_v1:')));
 // El servidor acepta el envío, pero la respuesta se pierde. El reintento no duplica.
 let dropped=false;await a.route('**/chat-sync.php**',async route=>{
  const req=route.request();if(!dropped&&req.method()==='POST'&&req.postDataJSON()?.action==='send'){dropped=true;await route.fetch();return route.abort();}return route.continue();
 });
 await send(a,'Respuesta perdida sin duplicado');await b.getByText('Respuesta perdida sin duplicado',{exact:true}).waitFor({timeout:22000});await bubble(a,'Respuesta perdida sin duplicado').getByLabel('Entregado',{exact:true}).waitFor({timeout:22000});
 await a.waitForTimeout(4500);assert.equal(await b.getByText('Respuesta perdida sin duplicado',{exact:true}).count(),1);
 await a.screenshot({path:'/tmp/chat-receipts-mobile.png',fullPage:true});await b.getByLabel('Volver a los chats',{exact:true}).click();await b.getByText('Perfil',{exact:true}).click();await b.getByLabel('Configuración y ajustes',{exact:true}).click();await b.screenshot({path:'/tmp/chat-read-privacy.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('OK UI PHP/MySQL: una/dos palomitas por acuses reales, lectura visible, privacidad persistente, última vez, cola offline tras reload y reintento sin duplicados tras respuesta perdida.');
 await ac.close();await bc.close();
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/receipt-failure-'+browser.contexts().indexOf(context)+'.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();}
