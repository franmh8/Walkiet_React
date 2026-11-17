import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
const backend=process.env.ACCOUNT_TEST_BACKEND;
if(backend!=='http://127.0.0.1:8103'||!process.env.CONTACTS_TEST_SOCKET)throw Error('Usa exclusivamente contacts_test_account y el backend local.');
const db=await mysql.createConnection({socketPath:process.env.CONTACTS_TEST_SOCKET,user:'root',database:'contacts_test_account'});
const login=async phone=>{const r=await fetch(backend+'/login.php',{method:'POST',body:JSON.stringify({identificador:phone,password:'profile-test-password'})});return(await r.json()).token;};
const call=async(token,action,extra={})=>{const r=await fetch(backend+'/account.php',{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...extra})});return {status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};};
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
try{
 const a=await login('7710000301'),b=await login('7710000302'),c=await login('7710000303');assert.ok(a&&b&&c);
 assert.equal((await call(null,'avatars',{ids:['account-a']})).status,401);
 assert.equal((await call(a,'avatar',{image:photo})).status,200);
 const shared=await call(b,'avatars',{ids:['account-a','account-b','account-c','missing']});
 assert.equal(shared.cache,'no-store');assert.equal(shared.status,200);
 assert.equal(shared.body.avatars[0].image,photo);const revision=shared.body.avatars[0].revision;assert.match(revision,/^[a-f0-9]{64}$/);
 assert.deepEqual(Object.keys(shared.body).sort(),['avatars','success']);
 assert.deepEqual(Object.keys(shared.body.avatars[0]).sort(),['id','image','revision']);
 for(const item of shared.body.avatars.slice(1))assert.deepEqual(item,{id:item.id,revision:null,image:null});
 const unchanged=await call(b,'avatars',{ids:['account-a'],known:{'account-a':revision}});assert.equal('image' in unchanged.body.avatars[0],false);
 assert.equal((await call(c,'avatars',{ids:['account-a'],owner_user_id:'account-b'})).body.avatars[0].image,null);
 // Guardar a A en la agenda privada de C habilita solo su foto.
 const create=await fetch(backend+'/contacts.php',{method:'POST',headers:{Authorization:'Bearer '+c},body:JSON.stringify({action:'create',name:'Contacto A',phone_number:'7710000301',email:''})});assert.equal(create.status,201);
 assert.equal((await call(c,'avatars',{ids:['account-a']})).body.avatars[0].image,photo);
 // Los teléfonos/miembros antiguos pueden usar otra collation que users.
 await db.execute('ALTER TABLE contactos MODIFY phone_number VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL');
 await db.execute('ALTER TABLE channel_members MODIFY user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci');
 assert.equal((await call(c,'avatars',{ids:['account-a']})).body.avatars[0].image,photo);
 assert.equal((await call(b,'avatars',{ids:['account-a']})).body.avatars[0].image,photo);
 await db.execute("DELETE FROM channel_members WHERE user_id='account-b'");
 const revoked=await call(b,'avatars',{ids:['account-a'],known:{'account-a':revision}});assert.deepEqual(revoked.body.avatars[0],{id:'account-a',revision:null,image:null});
 await db.execute("DELETE FROM contactos WHERE owner_user_id='account-c'");
 assert.equal((await call(c,'avatars',{ids:['account-a'],known:{'account-a':revision}})).body.avatars[0].image,null);
 assert.equal((await call(a,'avatars',{ids:Array.from({length:21},(_,i)=>String(i))})).status,400);
 assert.equal((await call(a,'avatars',{ids:[42]})).status,400);
 assert.equal((await call(a,'avatars',{ids:['x\u0000y']})).status,400);
 assert.equal((await call(a,'avatars',{ids:{one:'account-a'}})).status,400);
 assert.equal((await call(a,'avatars',{ids:["' OR 1=1 --"]})).body.avatars[0].image,null);
 assert.deepEqual((await call(a,'avatars',{ids:[]})).body.avatars,[]);
 await call(a,'avatar',{image:null});
 assert.deepEqual((await call(a,'avatars',{ids:['account-a'],known:{'account-a':revision}})).body.avatars[0],{id:'account-a',revision:null,image:null});
 await db.execute("UPDATE auth_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE user_id='account-c'");
 assert.equal((await call(c,'avatars',{ids:['account-a']})).status,401);
 console.log('OK fotos PHP/MySQL: sesión obligatoria, compañeros/contactos autorizados, sin datos privados, revisión sin reenviar imagen, retirada y revocación limpian caché, collations heredadas, límites y sesión caducada.');
}finally{await db.execute('ALTER TABLE contactos MODIFY phone_number VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');await db.execute('ALTER TABLE channel_members MODIFY user_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');await db.end();}
