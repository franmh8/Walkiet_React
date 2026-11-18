import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';
if(base!=='http://127.0.0.1:8103')throw Error('Usa solo contacts_test_account.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const errors=[];
const post=async(path,token,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'text/plain',Authorization:'Bearer '+token},body:JSON.stringify(data)});assert.ok(r.ok);return r.json();};
const open=async phone=>{
 const context=await browser.newContext({viewport:{width:430,height:932}});
 await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Radio de prueba detenida"}'}));
 await context.addInitScript(server=>localStorage.setItem('c5i_native_server_url',server),base);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();await page.getByText('PTT',{exact:true}).waitFor();
 return page;
};
try{
 const a=await open('7710000301'),b=await open('7710000302');
 const token=await a.evaluate(()=>JSON.parse(localStorage.getItem('c5i_native_user')).authToken);
 await post('/contacts.php',token,{action:'create',name:'Contacto de prueba',phone_number:'7710000302',email:''});
 await a.reload();await a.getByText('Chat',{exact:true}).click();await b.getByText('Chat',{exact:true}).click();
 await a.getByText('Todos (0)',{exact:true}).waitFor();await b.getByText('Todos (0)',{exact:true}).waitFor();
 const start=async()=>{await a.getByLabel('Nueva conversación',{exact:true}).click();await a.getByText('Contacto de prueba',{exact:true}).click();await a.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).waitFor();};
 await start();const id=(await post('/chat-sync.php',token,{action:'direct',target_user_id:'account-b'})).thread_id;
 // Simula el PHP anterior: todavía incluye una fila vacía en threads.
 await a.route('**/chat-sync.php**',async route=>{
  const req=route.request(),u=new URL(req.url());if(req.method()!=='GET'||u.searchParams.get('action')!=='threads')return route.continue();
  const response=await route.fetch(),data=await response.json();if(!data.threads.some(t=>t.id===id))data.threads.push({id,type:'direct',name:'Prueba Perfil B',targetUserId:'account-b',lastMessage:'',lastMessageTime:'',lastMessageAt:null});
  return route.fulfill({response,json:data});
 });
 await a.waitForTimeout(7000);await a.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).fill('Borrador sin enviar');
 assert.equal(await b.getByText('Prueba Perfil A',{exact:true}).count(),0);
 await a.getByLabel('Volver a los chats',{exact:true}).click();await a.getByText('Todos (0)',{exact:true}).waitFor();assert.equal(await a.getByText('Prueba Perfil B',{exact:true}).count(),0);
 await a.reload();await a.getByText('Chat',{exact:true}).click();await a.getByText('Todos (0)',{exact:true}).waitFor();await start();
 await a.waitForTimeout(7000);await a.route(base+'/**',route=>route.abort());await a.evaluate(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}));
 await a.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).fill('Primer mensaje offline');await a.getByLabel('Enviar mensaje',{exact:true}).click();await a.getByLabel('Pendiente de envío',{exact:true}).waitFor();
 await a.getByLabel('Volver a los chats',{exact:true}).click();await a.getByText('Todos (1)',{exact:true}).waitFor();await b.getByText('Todos (0)',{exact:true}).waitFor();
 await a.reload();await a.getByText('Chat',{exact:true}).click();await a.getByText('Primer mensaje offline',{exact:true}).click();await a.getByLabel('Pendiente de envío',{exact:true}).waitFor();
 await a.unroute(base+'/**');await a.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'));});
 await a.getByLabel('Entregado',{exact:true}).waitFor({timeout:25000});await b.getByText('Prueba Perfil A',{exact:true}).waitFor({timeout:16000});await b.getByText('Todos (1)',{exact:true}).waitFor();
 await a.getByLabel('Volver a los chats',{exact:true}).click();await a.getByText('Todos (1)',{exact:true}).waitFor();assert.equal(await a.getByText('Primer mensaje offline',{exact:true}).count(),1);
 await a.reload();await a.getByText('Chat',{exact:true}).click();await a.getByText('Todos (1)',{exact:true}).waitFor();await a.getByText('Primer mensaje offline',{exact:true}).waitFor();
 await post('/chat-sync.php',token,{action:'group',name:'Grupo nuevo sin mensajes',member_ids:['account-b']});
 await a.getByText('Grupo nuevo sin mensajes',{exact:true}).waitFor({timeout:16000});await b.getByText('Grupo nuevo sin mensajes',{exact:true}).waitFor({timeout:16000});await a.getByText('Grupos (1)',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('OK UI chats vacíos: sin tarjetas ni contadores al abrir/cerrar/reiniciar, editor sobrevive al refresco, compatibilidad con PHP anterior, primer pendiente offline persiste y se sincroniza para ambos, grupos vacíos visibles.');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/empty-chat-failure-'+browser.contexts().indexOf(context)+'.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();}
