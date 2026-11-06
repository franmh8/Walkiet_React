import assert from 'node:assert/strict';
const base=process.env.CONTACTS_TEST_NODE_BACKEND;
if(!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Requiere backend Node local de pruebas');
const health=await(await fetch(base+'/api/database/status')).json();
assert.equal(health.database_name,'contacts_test_node');
async function request(path,body,token,method='POST') {
 const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'text/plain;charset=UTF-8'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
}
const login=async(phone,password)=>{
 const result=await request('/login.php',{identificador:phone,password});
 assert.equal(result.status,200);assert.ok(result.data.token);return result.data.token;
};
const a=await login('7710000001','fixture');
const b=await login('7710000002','fixture');
assert.equal((await request('/api/contacts',undefined,undefined,'GET')).status,401);
const input={name:'HTTP personal A',phone_number:'7716999999',email:'http@example.com',owner_user_id:'b',action:'create'};
const created=await request('/api/contacts',input,a);assert.equal(created.status,201);
const id=created.data.contact.id;
assert.equal((await request('/api/contacts',{...input,action:'update',id,name:'Alterado'},b)).status,404);
assert.equal((await request('/api/contacts',{action:'delete',id,owner_user_id:'a'},b)).status,404);
const page=await request('/api/contacts?q=HTTP&owner_user_id=a',undefined,b,'GET');
assert.equal(page.data.contacts.length,0);
assert.equal((await request('/api/contacts',{...input,name:'Alias B'},b)).status,201);
assert.equal((await request('/reset-password.php',{identifier:'7710000001',new_password:'changed'})).status,401);
assert.equal((await request('/reset-password.php',{identifier:'7710000001',new_password:'changed-b'},b)).status,200);
assert.equal((await request('/api/contacts',undefined,b,'GET')).status,401);
await login('7710000001','fixture');
const phone='7717'+String(Date.now()).slice(-6);
const registered=await request('/register.php',{name:'HTTP cuenta nueva',phone_number:phone,password:'new-user-password'});
assert.equal(registered.status,201);
const c=await login(phone,'new-user-password');
assert.deepEqual((await request('/api/contacts',undefined,c,'GET')).data.contacts,[]);
assert.equal((await request('/logout.php',undefined,a)).status,200);
assert.equal((await request('/api/contacts',undefined,a,'GET')).status,401);
console.log('OK: Node HTTP real: sesiones, cuentas registradas con agenda vacía, CRUD aislado y revocación');
