import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';
if(base!=='http://127.0.0.1:8103')throw Error('Usa solo contacts_test_account.');
const post=async(path,token,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'text/plain',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});assert.ok(r.ok);return r.json();};
const login=async phone=>(await post('/login.php',null,{phone_number:phone,password:'profile-test-password'})).token;
const aToken=await login('7710000301'),bToken=await login('7710000302');
const saved=await post('/contacts.php',aToken,{action:'create',name:'Mi compa',phone_number:'7710000302',email:''});
await post('/contacts.php',bToken,{action:'create',name:'Mi colega',phone_number:'7710000301',email:''});
const thread=(await post('/chat-sync.php',aToken,{action:'direct',target_user_id:'account-b'})).thread_id;
await post('/chat-sync.php',aToken,{action:'send',thread_id:thread,mediaType:'text',text:'Mensaje para comprobar el apodo'});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const errors=[];
const open=async phone=>{
 const context=await browser.newContext({viewport:{width:430,height:932}});
 await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Radio de prueba detenida"}'}));
 await context.addInitScript(server=>localStorage.setItem('c5i_native_server_url',server),base);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();await page.getByText('PTT',{exact:true}).waitFor();await page.getByText('Chat',{exact:true}).click();return page;
};
try{
 const a=await open('7710000301'),b=await open('7710000302');
 await a.getByText('Mi compa',{exact:true}).click();await b.getByText('Mi colega',{exact:true}).click();
 await a.waitForTimeout(7000);await a.getByText('Mi compa',{exact:true}).waitFor();await b.getByText('Mi colega',{exact:true}).waitFor();
 assert.equal(await a.getByText('Prueba Perfil B',{exact:true}).count(),0);assert.equal(await b.getByText('Mi compa',{exact:true}).count(),0);
 await a.reload();await a.getByText('Chat',{exact:true}).click();await a.getByText('Mi compa',{exact:true}).click();await a.getByText('Mensaje para comprobar el apodo',{exact:true}).waitFor();
 await a.getByLabel('Volver a los chats',{exact:true}).click();await a.getByText('Contactos',{exact:true}).click();await a.getByText('Mi compa',{exact:true}).click();await a.getByText('Editar',{exact:true}).click();
 await a.getByPlaceholder('Ej. Juan Carlos',{exact:true}).fill('Compadre');await a.getByPlaceholder('Ej. Perez Hernandez',{exact:true}).fill('');await a.getByLabel('Guardar contacto',{exact:true}).click();
 const alert=a.getByRole('dialog',{name:'Listo',exact:true});await alert.getByRole('button',{name:'Entendido',exact:true}).click();
 await a.getByLabel('Cerrar detalle del contacto',{exact:true}).click();await a.getByText('Chat',{exact:true}).click();await a.getByText('Compadre',{exact:true}).click();await a.waitForTimeout(7000);await a.getByText('Compadre',{exact:true}).waitFor();await b.getByText('Mi colega',{exact:true}).waitFor();
 await post('/contacts.php',aToken,{action:'delete',id:saved.contact.id});await a.getByText('Prueba Perfil B',{exact:true}).waitFor({timeout:16000});await a.getByText('Mensaje para comprobar el apodo',{exact:true}).waitFor();
 await b.getByText('Mi colega',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('OK UI apodos: lista/encabezado privados por cuenta, no se sobrescriben al sincronizar, persisten tras reload, editar desde Contactos actualiza el chat y borrar recupera el nombre de cuenta conservando mensajes.');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'/tmp/chat-names-failure-'+browser.contexts().indexOf(context)+'.png',fullPage:true}).catch(()=>{});throw error;}
finally{await browser.close();}
