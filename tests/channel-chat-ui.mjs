import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import mysql from 'mysql2/promise';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ACCOUNT_TEST_BACKEND;
if(base!=='http://127.0.0.1:8103'||!process.env.CONTACTS_TEST_SOCKET?.startsWith('/tmp/'))throw Error('Usa solo contacts_test_account local.');
const db=await mysql.createConnection({socketPath:process.env.CONTACTS_TEST_SOCKET,user:'root',database:'contacts_test_account'});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const errors=[];
const login=async phone=>{
  const r=await fetch(base+'/login.php',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({phone_number:phone,password:'profile-test-password'})});assert.equal(r.status,200);return r.json();
};
const open=async phone=>{
  const session=await login(phone),context=await browser.newContext({viewport:{width:430,height:932}});
  await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());
  await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Radio de prueba detenida"}'}));
  await context.addInitScript(({user,token})=>{localStorage.setItem('c5i_native_server_url','http://127.0.0.1:8103');localStorage.setItem('c5i_native_user',JSON.stringify({...user,authToken:token}));},session);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.ACCOUNT_UI_URL||'http://localhost:3002');return page;
};
const initial='GRUPO DE PRUEBA DE PERFIL',second='SEGUNDO CANAL COMPARTIDO';
const listGroups=async(page,count)=>{await page.getByText('Chat',{exact:true}).last().click();await page.getByText(`Grupos (${count})`,{exact:true}).click();};
const send=async(page,text)=>{await page.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).fill(text);await page.getByLabel('Enviar mensaje',{exact:true}).click();await page.getByText(text,{exact:true}).waitFor();};
try {
  const [[seed]]=await db.execute("SELECT COUNT(*) n FROM channel_members WHERE user_id='account-a'");assert.equal(Number(seed.n),1);
  const page=await open('7710000301');await page.getByText(initial,{exact:true}).waitFor();
  await listGroups(page,1);await page.getByText(initial,{exact:true}).click();
  await send(page,'Conversación del primer canal');
  const peer=await open('7710000302');await peer.getByText(initial,{exact:true}).waitFor();
  await listGroups(peer,1);await peer.getByText(initial,{exact:true}).click();await peer.getByText('Conversación del primer canal',{exact:true}).waitFor();
  await send(peer,'Respuesta desde otro integrante');await page.getByText('Respuesta desde otro integrante',{exact:true}).waitFor();
  await page.getByLabel('Volver a los chats',{exact:true}).click();await page.getByText('Grupos',{exact:true}).click();
  await page.getByLabel('Crear un nuevo canal táctico',{exact:true}).click();
  await page.getByLabel('Nombre del grupo',{exact:true}).fill(second);
  await page.getByLabel('PIN del nuevo grupo',{exact:true}).fill('8462');
  await page.getByText('CREAR Y SINTONIZAR CANAL',{exact:true}).click();
  await page.getByText('COMENZAR A TRANSMITIR',{exact:true}).click();await page.getByText(second,{exact:true}).waitFor();
  await listGroups(page,2);assert.equal(await page.getByText(initial,{exact:true}).count(),1);await page.getByText(second,{exact:true}).click();await send(page,'Mensaje del segundo canal');
  // Cambiar la radio conserva el chat y el historial del otro canal.
  await page.getByLabel('Volver a los chats',{exact:true}).click();await page.getByText('Grupos',{exact:true}).click();await page.getByLabel(`Sintonizar ${initial}`,{exact:true}).click();await page.getByText('COMENZAR A TRANSMITIR',{exact:true}).click();
  await listGroups(page,2);await page.getByText(second,{exact:true}).click();await page.getByText('Mensaje del segundo canal',{exact:true}).waitFor();
  await page.getByLabel('Volver a los chats',{exact:true}).click();await page.getByText('Grupos (2)',{exact:true}).click();
  await page.getByText(initial,{exact:true}).click();await page.getByText('Conversación del primer canal',{exact:true}).waitFor();await page.getByText('Respuesta desde otro integrante',{exact:true}).waitFor();
  // La cuenta del compañero se incorpora por PIN y ve el mensaje guardado del mismo canal.
  await peer.getByLabel('Volver a los chats',{exact:true}).click();await peer.getByText('Grupos',{exact:true}).click();await peer.getByLabel('Unirse a un canal con PIN o QR',{exact:true}).click();
  await peer.getByLabel('PIN para unirse al grupo',{exact:true}).fill('8462');await peer.getByText('UNIRME AL CANAL',{exact:true}).click();await peer.getByText('COMENZAR A TRANSMITIR',{exact:true}).click();
  await listGroups(peer,2);await peer.getByText(second,{exact:true}).click();await peer.getByText('Mensaje del segundo canal',{exact:true}).waitFor();
  await page.reload();await page.getByText(initial,{exact:true}).waitFor();await listGroups(page,2);
  await page.screenshot({path:'/tmp/channel-chats-persisted.png',fullPage:true});
  await page.getByText(second,{exact:true}).click();await page.getByText('Mensaje del segundo canal',{exact:true}).waitFor();
  const [[count]]=await db.query('SELECT COUNT(*) n FROM chat_channel_threads');assert.equal(Number(count.n),2);
  const outsider=await open('7710000303');await outsider.getByText('Ningún grupo seleccionado',{exact:true}).waitFor();await listGroups(outsider,0);await outsider.getByText('Sin conversaciones todavía',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('OK interfaz chats de canal: vacío automático, envío/recepción entre dos cuentas, crear/unirse por PIN, cambiar de sintonía, ambos historiales tras recarga, sin duplicados ni chats de otra cuenta.');
} finally {await browser.close();await db.end();}
