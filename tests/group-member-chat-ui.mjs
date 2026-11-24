// Requiere el backend PHP y la BD sintética contacts_test_account; nunca producción.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import mysql from 'mysql2/promise';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const backend=process.env.ACCOUNT_TEST_BACKEND;
if(backend!=='http://127.0.0.1:8103'||!process.env.CONTACTS_TEST_SOCKET?.startsWith('/tmp/'))throw Error('Usa solo la fixture local contacts_test_account.');
const db=await mysql.createConnection({socketPath:process.env.CONTACTS_TEST_SOCKET,user:'root',database:'contacts_test_account'});
const post=async(path,token,data)=>{
  const res=await fetch(backend+path,{method:'POST',headers:{'Content-Type':'text/plain',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
  const body=await res.json();assert.ok(res.ok,body.message);return body;
};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
  const [[seed]]=await db.execute("SELECT name FROM users WHERE id='account-a'");assert.equal(seed.name,'Prueba Perfil A');
  await db.execute("INSERT IGNORE INTO channel_members(id,channel_id,user_id) VALUES('acm-c','account-group','account-c')");
  const session=await post('/login.php',null,{phone_number:'7710000301',password:'profile-test-password'});
  await post('/contacts.php',session.token,{action:'create',name:'Mi compa',phone_number:'7710000302',email:''});
  const context=await browser.newContext({viewport:{width:430,height:932}});
  await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());
  await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Radio de prueba detenida"}'}));
  await context.addInitScript(({server,user,token})=>{
    localStorage.setItem('c5i_native_server_url',server);
    localStorage.setItem('c5i_native_user',JSON.stringify({...user,authToken:token}));
  },{server:backend,user:session.user,token:session.token});
  const page=await context.newPage(),errors=[],targets=[];
  page.on('pageerror',e=>errors.push(e.message));
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/chat-sync.php**',async route=>{
    const req=route.request();
    if(req.method()!=='POST'||req.postDataJSON()?.action!=='direct')return route.continue();
    targets.push(req.postDataJSON().target_user_id);
    if(targets.length===1)return route.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"No se pudo abrir el chat de prueba"}'});
    if(targets.length===2)await gate;
    return route.continue();
  });
  await page.goto(process.env.ACCOUNT_UI_URL||'http://localhost:3002');
  const openMembers=async()=>{
    await page.getByText('PTT',{exact:true}).click();
    await page.getByLabel('Ver usuarios dentro del canal',{exact:true}).click();
    await page.getByText('Prueba Perfil A (Tú)',{exact:true}).waitFor();
    await page.getByLabel('Enviar mensaje a Mi compa',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:/Enviar mensaje a/}).count(),2);
    assert.equal(await page.getByLabel('Enviar mensaje a Prueba Perfil A',{exact:true}).count(),0);
  };
  await openMembers();
  await page.getByText('3 miembros • Táctico',{exact:true}).waitFor();
  await page.screenshot({path:'/tmp/group-member-chat-mobile.png',fullPage:true});
  await page.setViewportSize({width:320,height:740});
  const button=page.getByLabel('Enviar mensaje a Mi compa',{exact:true});
  const rect=await button.boundingBox();assert.ok(rect.width>=44&&rect.height>=44&&rect.x+rect.width<=320);
  await page.screenshot({path:'/tmp/group-member-chat-small.png',fullPage:true});
  await page.setViewportSize({width:430,height:932});
  await button.click();await page.getByText('No se pudo abrir el chat de prueba',{exact:true}).waitFor();
  await page.getByLabel('Entendido',{exact:true}).click();
  await page.getByLabel('Cerrar miembros del grupo',{exact:true}).waitFor();
  assert.equal(await page.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).count(),0);
  // Dos pulsaciones rápidas producen una sola solicitud y muestran carga.
  await button.evaluate(el=>{el.click();el.click();});
  await page.waitForFunction(()=>document.querySelector('[aria-label="Enviar mensaje a Mi compa"]')?.getAttribute('aria-disabled')==='true');
  assert.equal(targets.length,2);release();
  await page.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).waitFor();
  await page.getByLabel('Cerrar miembros del grupo',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.getByLabel('Cerrar miembros del grupo',{exact:true}).count(),0);
  await page.getByText('Mi compa',{exact:true}).waitFor();
  await page.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).fill('Mensaje privado desde los integrantes');
  await page.getByLabel('Enviar mensaje',{exact:true}).click();
  await page.getByText('Mensaje privado desde los integrantes',{exact:true}).waitFor();
  await page.getByLabel('Volver a los chats',{exact:true}).click();await openMembers();
  await page.getByLabel('Enviar mensaje a Mi compa',{exact:true}).click();
  await page.getByText('Mensaje privado desde los integrantes',{exact:true}).waitFor();
  const [[direct]]=await db.execute("SELECT COUNT(*) n FROM chat_threads t INNER JOIN chat_thread_members a ON a.thread_id=t.id AND a.user_id='account-a' INNER JOIN chat_thread_members b ON b.thread_id=t.id AND b.user_id='account-b' WHERE t.kind='direct'");
  assert.equal(Number(direct.n),1,'Reutiliza el chat existente.');
  await page.getByLabel('Volver a los chats',{exact:true}).click();await openMembers();
  await page.getByLabel('Enviar mensaje a Prueba Perfil C',{exact:true}).click();
  await page.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).waitFor();
  await page.getByText('Prueba Perfil C',{exact:true}).waitFor();
  assert.deepEqual(targets,['account-b','account-b','account-b','account-c']);
  const [[contacts]]=await db.execute("SELECT COUNT(*) n FROM contactos WHERE owner_user_id='account-a'");
  assert.equal(Number(contacts.n),1,'No agrega al integrante a la agenda automáticamente.');
  assert.deepEqual(errors,[]);
  console.log('OK miembros → chat PHP/MySQL: apodo, otro integrante sin contacto, sin opción propia, error conserva modal, bloqueo de doble pulsación, conversación existente sin duplicar y diseño móvil de 320/430 px.');
} finally {await browser.close();await db.end();}
