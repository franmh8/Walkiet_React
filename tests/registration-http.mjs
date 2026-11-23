import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
const base=process.env.REGISTRATION_TEST_BACKEND;
if(base!=='http://127.0.0.1:8119'||!process.env.CONTACTS_TEST_SOCKET?.startsWith('/tmp/'))throw Error('Usa solo la fixture local de registro.');
const db=await mysql.createConnection({socketPath:process.env.CONTACTS_TEST_SOCKET,user:'root',database:'contacts_test_registration'});
const post=async(path,data)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(data)});return {status:res.status,body:await res.json(),cache:res.headers.get('cache-control')};};
const api=(action,data)=>post('/registration.php',{action,...data});
const data=(suffix)=>({name:'Registro Pruebas',phone_number:'77100008'+suffix,correo:'registration-'+suffix+'@example.test',password:'Synthetic-pass-28!'});
const send=d=>api('request',d);
const mail=async email=>(await(await fetch('http://127.0.0.1:8110/test/events')).json()).filter(m=>m.to===email).at(-1);
const clearRate=()=>db.execute('DELETE FROM security_rate_limits');
try {
  const d=data('01'); const sent=await send(d);
  assert.equal(sent.status,200);assert.equal(sent.cache,'no-store');assert.equal(sent.body.expires_in,180);assert.equal(sent.body.resend_after,60);
  assert.match(sent.body.challenge_id,/^[a-f0-9]{64}$/);assert.equal('code' in sent.body,false);
  const message=await mail(d.correo);assert.ok(message?.code);assert.match(message.subject,/Verifica tu correo/);assert.match(message.plain,/completar el registro/);assert.ok(message.html.includes('#691c32'));
  const [[stored]]=await db.execute('SELECT code_hash,TIMESTAMPDIFF(SECOND,created_at,expires_at) AS ttl FROM registration_email_challenges WHERE id=?',[sent.body.challenge_id]);assert.notEqual(stored.code_hash,message.code);assert.equal(Number(stored.ttl),180);
  assert.equal((await send(d)).status,429);
  assert.equal((await post('/register.php',d)).status,400,'No permite crear una cuenta sin código.');
  assert.equal((await post('/verify-otp.php',{phone:d.phone_number,code:'123456'})).status,410);
  const complete={...d,challenge_id:sent.body.challenge_id,code:message.code};
  assert.equal((await api('complete',{...complete,correo:'other@example.test'})).status,400);
  assert.equal((await api('complete',{...complete,phone_number:'7710000899'})).status,400);
  assert.equal((await api('complete',{...complete,code:'000000'})).status,400);
  if(message.code!=='123456')assert.equal((await api('complete',{...complete,code:'123456'})).status,400);
  const results=await Promise.all([api('complete',complete),api('complete',complete)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
  const [[created]]=await db.execute('SELECT * FROM users WHERE phone_number=?',[d.phone_number]);assert.equal(created.correo,d.correo);assert.equal(created.status,'offline');assert.match(created.password_hash,/^\$2[aby]\$/);
  const [[settings]]=await db.execute('SELECT COUNT(*) n FROM user_settings WHERE user_id=?',[created.id]);assert.equal(Number(settings.n),1);
  assert.equal((await post('/login.php',{identificador:d.correo,password:d.password})).status,200);
  await clearRate();assert.equal((await send(d)).status,409);
  const locked=data('02'),l=await send(locked),lc=(await mail(locked.correo)).code;
  for(let i=0;i<5;i++)assert.equal((await api('complete',{...locked,challenge_id:l.body.challenge_id,code:'000000'})).status,400);
  assert.equal((await api('complete',{...locked,challenge_id:l.body.challenge_id,code:lc})).status,400);
  const expired=data('03'),ex=await send(expired),ec=(await mail(expired.correo)).code;
  await db.execute('UPDATE registration_email_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',[ex.body.challenge_id]);
  assert.equal((await api('complete',{...expired,challenge_id:ex.body.challenge_id,code:ec})).status,400);
  const renewed=data('04'),old=await send(renewed),oldCode=(await mail(renewed.correo)).code;
  await clearRate();const next=await send(renewed);assert.equal(next.status,200);
  assert.equal((await api('complete',{...renewed,challenge_id:old.body.challenge_id,code:oldCode})).status,400);
  const newCode=(await mail(renewed.correo)).code;
  assert.equal((await post('/register.php',{...renewed,challenge_id:next.body.challenge_id,code:newCode})).status,200);
  await clearRate();await fetch('http://127.0.0.1:8110/test/control',{method:'POST',body:JSON.stringify({failure:'send'})});
  try {assert.equal((await send(data('05'))).status,503);const [[failure]]=await db.execute("SELECT status FROM registration_email_challenges WHERE email=?",[data('05').correo]);assert.equal(failure.status,'failed');}
  finally {await fetch('http://127.0.0.1:8110/test/control',{method:'POST',body:'{}'});}
  // La creación y el consumo se revierten juntos si falla guardar las preferencias.
  await clearRate();const rollback=data('06'),r=await send(rollback),rc=(await mail(rollback.correo)).code;
  await db.query('RENAME TABLE user_settings TO registration_settings_backup');
  try {assert.equal((await api('complete',{...rollback,challenge_id:r.body.challenge_id,code:rc})).status,503);}
  finally {await db.query('RENAME TABLE registration_settings_backup TO user_settings');}
  const [[missing]]=await db.execute('SELECT COUNT(*) n FROM users WHERE correo=?',[rollback.correo]);assert.equal(Number(missing.n),0);
  assert.equal((await api('complete',{...rollback,challenge_id:r.body.challenge_id,code:rc})).status,200);
  console.log('OK registro PHP/MySQL/correo: envío MIME real al proveedor controlado, sin códigos en JSON, intentos/caducidad/reenvío, identidad ligada, sin bypass, alta y consumo atómicos, duplicados, login y error de proveedor.');
} finally {await db.end();}
