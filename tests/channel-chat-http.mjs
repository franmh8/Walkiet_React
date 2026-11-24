// Backend real con cuentas sintéticas. Nunca ejecutar contra producción.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import mysql from 'mysql2/promise';
const base=process.env.ACCOUNT_TEST_BACKEND;
if(base!=='http://127.0.0.1:8103'||!process.env.CONTACTS_TEST_SOCKET?.startsWith('/tmp/'))throw Error('Usa solo contacts_test_account local.');
const db=await mysql.createConnection({socketPath:process.env.CONTACTS_TEST_SOCKET,user:'root',database:'contacts_test_account'});
const request=async(path,token,data)=>{
  const response=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'text/plain',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});
  return {status:response.status,body:await response.json()};
};
const ok=async(path,token,data)=>{const r=await request(path,token,data);assert.ok(r.status<300,JSON.stringify(r));return r.body;};
const chat=(token,data)=>ok('/chat-sync.php',token,data);
const threads=async token=>(await ok('/chat-sync.php?action=threads',token)).threads;
const messages=(token,id)=>request('/chat-sync.php?'+new URLSearchParams({action:'messages',thread_id:id}),token);
const send=(token,id,text,extra={})=>request('/chat-sync.php',token,{action:'send',thread_id:id,mediaType:'text',text,client_message_id:randomUUID(),...extra});
try {
  const [[seed]]=await db.execute("SELECT name FROM users WHERE id='account-a'");assert.equal(seed.name,'Prueba Perfil A');
  // La nueva tabla no debe reemplazar ni borrar los grupos manuales previos.
  await db.query('DROP TABLE IF EXISTS chat_channel_threads');
  const sessions=await Promise.all(['7710000301','7710000302','7710000303'].map(phone=>ok('/login.php',null,{phone_number:phone,password:'profile-test-password'})));
  const [a,b,c]=sessions.map(session=>session.token);
  const manual=await chat(a,{action:'group',name:'Grupo manual independiente',member_ids:['account-b']});
  const oldMessage=await send(a,manual.thread_id,'Mensaje previo a la migración');assert.equal(oldMessage.status,201);
  await db.execute("INSERT INTO chat_message_receipts(message_id,user_id,delivered_at,read_at) VALUES(?,'account-b','2026-11-23 10:00:00','2026-11-23 10:01:00')",[oldMessage.body.id]);
  // Simula 008 original: el backend ya usa seen_at, pero la BD aún no lo tiene.
  await db.query('ALTER TABLE chat_message_receipts DROP COLUMN IF EXISTS seen_at');
  const sql=await readFile(new URL('../backend-alwaysdata/migrations/012_channel_group_chats.sql',import.meta.url),'utf8');
  const migrate=async()=>{for(const statement of sql.split(';'))if(statement.trim())await db.query(statement);};
  await migrate();
  const [[priorRead]]=await db.execute('SELECT read_at,seen_at FROM chat_message_receipts WHERE message_id=?',[oldMessage.body.id]);
  assert.deepEqual(priorRead.seen_at,priorRead.read_at);
  assert.ok((await threads(a)).some(t=>t.id===manual.thread_id));
  // Dos miembros y dispositivos descubren un mismo grupo ya existente, incluso vacío.
  const lists=await Promise.all([threads(a),threads(b),threads(a),threads(b)]);
  const first=lists[0].find(t=>t.name==='GRUPO DE PRUEBA DE PERFIL');assert.ok(first);assert.equal(first.type,'group');assert.equal(first.participantCount,2);assert.equal(first.hasMessages,false);
  for(const list of lists)assert.equal(list.filter(t=>t.id===first.id).length,1);
  assert.deepEqual(await threads(c),[]);
  assert.equal((await messages(c,first.id)).status,403);assert.equal((await send(c,first.id,'Ajeno')).status,403);
  const sent=await send(a,first.id,'Historial persistente del canal');assert.equal(sent.status,201);
  assert.equal((await messages(b,first.id)).body.messages[0].text,'Historial persistente del canal');
  const extra=await ok('/channels.php',a,{action:'create',name:'SEGUNDO CANAL COMPARTIDO',pin:'8462'});
  let second=(await threads(a)).find(t=>t.name===extra.channel.name);assert.ok(second);assert.notEqual(second.id,first.id);
  assert.ok(!(await threads(b)).some(t=>t.id===second.id));
  await ok('/channels.php',b,{action:'join',pin:'8462'});
  assert.equal((await threads(b)).find(t=>t.id===second.id).participantCount,2);
  await Promise.all([ok('/channels.php',c,{action:'join',pin:'8462'}),threads(a)]);
  assert.equal((await threads(c)).find(t=>t.id===second.id).participantCount,3);
  assert.equal((await send(b,second.id,'Mensaje del segundo canal')).status,201);
  // La sintonía no elimina membresías: ambos historiales sobreviven a un login nuevo.
  const fresh=await ok('/login.php',null,{phone_number:'7710000301',password:'profile-test-password'});
  assert.ok((await threads(fresh.token)).some(t=>t.id===first.id));
  assert.equal((await messages(fresh.token,first.id)).body.messages[0].text,'Historial persistente del canal');
  await migrate();assert.equal((await messages(b,first.id)).body.messages[0].id,sent.body.id);
  await db.execute('UPDATE channels SET name=? WHERE id=?',['CANAL RENOMBRADO',extra.channel.id]);
  second=(await threads(a)).find(t=>t.id===second.id);assert.equal(second.name,'CANAL RENOMBRADO');
  await ok('/channels.php',b,{action:'leave',id:extra.channel.id});
  assert.ok(!(await threads(b)).some(t=>t.id===second.id));assert.equal((await messages(b,second.id)).status,403);
  assert.equal((await send(b,second.id,'Después de salir')).status,403);
  assert.equal((await request('/chat-sync.php',b,{action:'receipts',thread_id:second.id,message_ids:[sent.body.id],read:true})).status,403);
  // Incluso una baja por un backend anterior no concede acceso por membresías obsoletas del chat.
  await db.execute('DELETE FROM channel_members WHERE channel_id=? AND user_id=?',[extra.channel.id,'account-c']);
  assert.ok(!(await threads(c)).some(t=>t.id===second.id));assert.equal((await messages(c,second.id)).status,403);
  const inbox=await ok('/chat-sync.php?action=inbox',c);assert.ok(!inbox.messages.some(m=>m.thread_id===second.id));
  await ok('/channels.php',b,{action:'join',pin:'8462'});
  assert.equal((await threads(b)).find(t=>t.id===second.id).id,second.id);
  const source=(await messages(b,second.id)).body.messages[0];assert.equal(source.text,'Mensaje del segundo canal');
  await ok('/channels.php',b,{action:'leave',id:extra.channel.id});
  assert.equal((await send(b,manual.thread_id,'',{source_message_id:source.id})).status,403,'No reenvía mensajes desde un canal revocado.');
  await ok('/channels.php',a,{action:'delete',id:extra.channel.id});
  assert.ok(!(await threads(a)).some(t=>t.id===second.id));assert.equal((await messages(a,second.id)).status,403);
  assert.ok((await threads(a)).some(t=>t.id===manual.thread_id),'El grupo manual se conserva.');
  const [[count]]=await db.query("SELECT COUNT(*) n FROM chat_channel_threads WHERE channel_id='account-group'");assert.equal(Number(count.n),1);
  console.log('OK chats de canal PHP/MySQL: migración repetible, backfill concurrente, chat compartido vacío, crear/unirse, persistencia, renombre, aislamiento y revocación al salir/eliminar, sin afectar grupos manuales.');
} finally {await db.end();}
