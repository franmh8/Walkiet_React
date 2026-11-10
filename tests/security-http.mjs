import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
const base=process.env.SECURITY_TEST_BACKEND;
const smtp=process.env.SECURITY_TEST_MAIL==='smtp';
if(base!==(smtp?'http://127.0.0.1:8116':'http://127.0.0.1:8111')||!process.env.CONTACTS_TEST_SOCKET)throw Error('Usa exclusivamente la fixture contacts_test_security.');
const provider=smtp?'http://127.0.0.1:8115':'http://127.0.0.1:8110';
const db=await mysql.createConnection({socketPath:process.env.CONTACTS_TEST_SOCKET,user:'root',database:'contacts_test_security'});
const post=async(path,body,token)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return{status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};};
const api=(action,body={},token)=>post('/security.php',{action,...body},token);
const login=async id=>{const r=await post('/login.php',{identificador:id,password:'security-test-password'});assert.equal(r.status,200);assert.ok(r.body.token);return r.body.token;};
const clearRate=()=>db.query('DELETE FROM security_rate_limits');
const latest=async to=>(await(await fetch(provider+'/test/events')).json()).filter(e=>e.to===to).at(-1);
const codeBody=(request,code)=>({challenge_id:request.body.challenge_id,code});
try{
  const a=await login('7710000401'),b=await login('7710000402');
  assert.equal((await api('email_request',{email:'new@example.test',password:'security-test-password'})).status,401);
  assert.equal((await post('/account.php',{action:'update',fields:{correo:'bypass@example.test'}},a)).status,400);
  const initial=await post('/account.php',{action:'get'},a);assert.equal(initial.body.user.correo,'security-a@example.test');
  const cors=await fetch(base+'/security.php',{method:'OPTIONS',headers:{Origin:'http://localhost:8081','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  assert.equal(cors.status,200);assert.equal(cors.headers.get('access-control-allow-origin'),'http://localhost:8081');
  assert.equal((await api('email_request',{email:'next@example.test',password:'wrong'},a)).status,403);await clearRate();
  assert.equal((await api('email_request',{email:'security-b@example.test',password:'security-test-password'},a)).status,409);await clearRate();
  const change=await api('email_request',{email:'NEW-A@example.test',password:'security-test-password',user_id:'security-b'},a);
  assert.equal(change.status,200);assert.equal(change.cache,'no-store');assert.ok(change.body.challenge_id);assert.equal('code' in change.body,false);
  assert.equal((await post('/account.php',{action:'get'},a)).body.user.correo,'security-a@example.test');
  assert.equal((await api('email_request',{email:'other@example.test',password:'security-test-password'},a)).status,429);
  const sent=await latest('new-a@example.test');assert.ok(sent);assert.match(sent.subject,/Verifica/);
  const [[stored]]=await db.query('SELECT code_hash FROM security_challenges WHERE id=?',[change.body.challenge_id]);assert.notEqual(stored.code_hash,sent.code);
  assert.equal((await api('email_verify',codeBody(change,sent.code),b)).status,400);
  assert.equal((await api('recovery_verify',codeBody(change,sent.code))).status,400);
  assert.equal((await api('email_verify',codeBody(change,'000000'),a)).status,400);
  const double=await Promise.all([api('email_verify',codeBody(change,sent.code),a),api('email_verify',codeBody(change,sent.code),a)]);
  assert.deepEqual(double.map(r=>r.status).sort(),[200,400]);
  assert.equal((await post('/account.php',{action:'get'},a)).body.user.correo,'new-a@example.test');
  assert.equal((await post('/account.php',{action:'get'},b)).body.user.correo,'security-b@example.test');
  await clearRate();const known=await api('recovery_request',{identifier:'7710000401'});const unknown=await api('recovery_request',{identifier:'7710000499'});
  assert.equal(known.status,200);assert.equal(unknown.status,200);assert.equal(known.body.message,unknown.body.message);assert.deepEqual(Object.keys(known.body).sort(),Object.keys(unknown.body).sort());
  assert.equal('code' in known.body,false);assert.equal('token' in known.body,false);assert.equal('user' in known.body,false);
  const resetCode=(await latest('new-a@example.test')).code;
  assert.equal((await api('recovery_reset',{challenge_id:known.body.challenge_id,new_password:'hacked-password'})).status,400);
  assert.equal((await api('recovery_verify',codeBody(unknown,resetCode))).status,400);
  assert.equal((await api('email_verify',codeBody(known,resetCode),a)).status,400);
  const proof=await api('recovery_verify',codeBody(known,resetCode));assert.equal(proof.status,200);assert.match(proof.body.reset_token,/^[a-f0-9]{64}$/);
  assert.equal((await api('recovery_verify',codeBody(known,resetCode))).status,400);
  assert.equal((await api('recovery_reset',{challenge_id:known.body.challenge_id,reset_token:proof.body.reset_token,new_password:'short'})).status,422);
  assert.equal((await api('recovery_reset',{challenge_id:known.body.challenge_id,reset_token:proof.body.reset_token,new_password:' leading-space'})).status,422);
  assert.equal((await api('recovery_reset',{challenge_id:known.body.challenge_id,reset_token:proof.body.reset_token,new_password:'éééé'})).status,422);
  await db.execute("UPDATE users SET locked_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR),failed_login_attempts=7 WHERE id='security-a'");
  const reset=await api('recovery_reset',{challenge_id:known.body.challenge_id,reset_token:proof.body.reset_token,new_password:'new-secure-password',identifier:'7710000402'});
  assert.equal(reset.status,200);assert.equal((await post('/account.php',{action:'get'},a)).status,401);assert.equal((await post('/account.php',{action:'get'},b)).status,200);
  assert.equal((await api('recovery_reset',{challenge_id:known.body.challenge_id,reset_token:proof.body.reset_token,new_password:'another-password'})).status,400);
  assert.equal((await post('/login.php',{identificador:'new-a@example.test',password:'new-secure-password'})).status,200);
  assert.equal((await post('/login.php',{identificador:'7710000401',password:'security-test-password'})).status,401);
  await clearRate();const locked=await api('recovery_request',{identifier:'security-b@example.test'});const correct=(await latest('security-b@example.test')).code;
  for(let i=0;i<5;i++)assert.equal((await api('recovery_verify',codeBody(locked,'000000'))).status,400);
  assert.equal((await api('recovery_verify',codeBody(locked,correct))).status,400);
  await clearRate();const expired=await api('recovery_request',{identifier:'7710000402'});const expiredCode=(await latest('security-b@example.test')).code;
  await db.execute('UPDATE security_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',[expired.body.challenge_id]);
  assert.equal((await api('recovery_verify',codeBody(expired,expiredCode))).status,400);
  await clearRate();const old=await api('recovery_request',{identifier:'7710000402'});const oldCode=(await latest('security-b@example.test')).code;
  await db.execute('UPDATE security_rate_limits SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE expires_at<DATE_ADD(UTC_TIMESTAMP(),INTERVAL 65 SECOND)');
  const renewed=await api('recovery_request',{identifier:'7710000402'});assert.equal(renewed.status,200);assert.equal((await api('recovery_verify',codeBody(old,oldCode))).status,400);
  const verified=await api('recovery_verify',codeBody(renewed,(await latest('security-b@example.test')).code));assert.equal(verified.status,200);
  await db.execute('UPDATE security_challenges SET proof_expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE id=?',[renewed.body.challenge_id]);
  assert.equal((await api('recovery_reset',{challenge_id:renewed.body.challenge_id,reset_token:verified.body.reset_token,new_password:'never-written'})).status,400);
  await clearRate();await fetch(provider+'/test/control',{method:'POST',body:JSON.stringify({failure:'send'})});
  try{
    assert.equal((await api('email_request',{email:'failed@example.test',password:'security-test-password'},b)).status,503);
    assert.equal((await post('/account.php',{action:'get'},b)).body.user.correo,'security-b@example.test');
    const failed=await api('recovery_request',{identifier:'security-c@example.test'});assert.equal(failed.status,200);assert.equal(failed.body.message,unknown.body.message);
  }finally{await fetch(provider+'/test/control',{method:'POST',body:'{}'});}
  if(smtp){
    await clearRate();await fetch(provider+'/test/control',{method:'POST',body:JSON.stringify({failure:'auth'})});
    try{assert.equal((await api('email_request',{email:'auth-failed@example.test',password:'security-test-password'},b)).status,503);assert.equal((await post('/account.php',{action:'get'},b)).body.user.correo,'security-b@example.test');}
    finally{await fetch(provider+'/test/control',{method:'POST',body:'{}'});}
    const transactions=await(await fetch(provider+'/test/transactions')).json();assert.ok(transactions.some(t=>t.tls));assert.ok(transactions.every(t=>!t.authBeforeTls));
    const messages=await(await fetch(provider+'/test/events')).json();assert.ok(messages.length>0&&messages.every(m=>m.tls));
  }
  await clearRate();for(let i=0;i<5;i++){const r=await api('recovery_request',{identifier:'nobody@example.test'});assert.equal(r.status,200);await db.execute('UPDATE security_rate_limits SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE expires_at<DATE_ADD(UTC_TIMESTAMP(),INTERVAL 65 SECOND)');}
  assert.equal((await api('recovery_request',{identifier:'nobody@example.test'})).status,429);
  console.log(`OK PHP/MySQL/${smtp?'SMTP STARTTLS':'OAuth'} controlado: MIME Gmail, cambio solo tras código, contraseña actual, sin bypass correo, sesiones/propósitos aislados, recuperación teléfono/correo con respuesta genérica, intentos/caducidad/reenvío, prueba de acceso de un uso, revocación y errores de proveedor sin cambios ficticios.`);
}finally{await db.end();}
