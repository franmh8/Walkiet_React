import assert from 'node:assert/strict';
const base=process.env.ACCOUNT_TEST_BACKEND;
if(base!=='http://127.0.0.1:8103')throw Error('Usa solo contacts_test_account local.');
const post=async(path,token,data)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'text/plain',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};};
const login=async phone=>(await post('/login.php',null,{phone_number:phone,password:'profile-test-password'})).body.token;
const a=await login('7710000301'),b=await login('7710000302'),c=await login('7710000303');
const threads=async token=>{const r=await fetch(base+'/chat-sync.php?action=threads',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);return (await r.json()).threads;};
const start=await post('/chat-sync.php',a,{action:'direct',target_user_id:'account-c'});assert.equal(start.status,200);const id=start.body.thread_id;
for(const token of [a,c])assert.ok(!(await threads(token)).some(t=>t.id===id),'Abrir un contacto no agrega el chat vacío a ninguna cuenta.');
const r=await fetch(base+'/chat-sync.php?'+new URLSearchParams({action:'messages',thread_id:id}),{headers:{Authorization:'Bearer '+a}});assert.equal(r.status,200);assert.deepEqual((await r.json()).messages,[],'El editor vacío sigue siendo accesible.');
const reverse=await post('/chat-sync.php',c,{action:'direct',target_user_id:'account-a'});assert.equal(reverse.body.thread_id,id,'Reabrir reutiliza el chat, sin borrar ni duplicar filas.');
const group=await post('/chat-sync.php',a,{action:'group',name:'Grupo vacío explícito',member_ids:['account-c']});assert.equal(group.status,201);
for(const token of [a,c]){const t=(await threads(token)).find(t=>t.id===group.body.thread_id);assert.ok(t);assert.equal(t.hasMessages,false,'Los grupos creados sí se muestran vacíos.');}
// Un adjunto con texto vacío también inicia la conversación.
const sent=await post('/chat-sync.php',a,{action:'send',thread_id:id,mediaType:'image',text:'',mediaUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=',fileName:'synthetic.png'});assert.equal(sent.status,201);
for(const token of [a,c]){const t=(await threads(token)).find(t=>t.id===id);assert.ok(t);assert.equal(t.hasMessages,true);assert.equal(t.lastMessage,'');assert.ok(t.lastMessageAt);}
assert.ok(!(await threads(b)).some(t=>t.id===id),'Se conserva el aislamiento de participantes.');
console.log('OK chats vacíos HTTP: abrir/reabrir no crea tarjetas, editor accesible, grupos vacíos visibles, primer adjunto sin texto inicia el chat para ambos y membresía aislada.');
