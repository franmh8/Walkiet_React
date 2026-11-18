// Contrato controlado de chat-sync.php. Solo pruebas locales: las cuentas,
// sesiones, presencia y contactos usan el PHP/MySQL real de tests.
export function createChatSyncBrowserFixture(backend) {
 if(backend!=='http://127.0.0.1:8103')throw Error('Usa exclusivamente la instancia contacts_test_account.');
 const threads=new Map();const messages=new Map();let sequence=0;
 const users={'account-a':{name:'Prueba Perfil A',callsign:'ACCOUNT-A'},'account-b':{name:'Compañero B',callsign:'ACCOUNT-B'},'account-c':{name:'Prueba Perfil C',callsign:'ACCOUNT-C'}};
 const operations=[];const attempts=new Map();
 const install=async context=>context.route('**/chat-sync.php**',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==backend)return route.abort();
  const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  try{
   const auth=req.headers().authorization;
   const check=await fetch(backend+'/account.php',{method:'POST',headers:{Authorization:auth||'','Content-Type':'text/plain'},body:'{"action":"get"}'});const account=await check.json();
   if(!check.ok)return reply(401,{success:false,message:'Sesión de prueba vencida'});
   const owner=account.user.id;const data=req.method()==='POST'?req.postDataJSON():Object.fromEntries(url.searchParams);
   operations.push({owner,action:data.action});
   const dto=t=>{const peer=t.members.find(id=>id!==owner);const list=messages.get(t.id)||[];return {id:t.id,type:t.type,name:t.type==='direct'?users[peer].name:t.name,targetUserId:t.type==='direct'?peer:null,participantCount:t.members.length,isOnline:true,hasMessages:list.length>0,lastMessage:list.at(-1)?.text||'',lastMessageTime:list.at(-1)?.timestamp||''};};
   if(data.action==='threads')return reply(200,{success:true,features:['receipts','idempotentSend'],threads:[...threads.values()].filter(t=>t.members.includes(owner)&&(t.type==='group'||(messages.get(t.id)||[]).length>0)).map(dto)});
   if(data.action==='direct'){
    if(!users[data.target_user_id]||data.target_user_id===owner)return reply(400,{success:false,message:'Destinatario inválido'});
    const members=[owner,data.target_user_id].sort();const id='fixture-direct-'+members.join('_');
    if(!threads.has(id))threads.set(id,{id,type:'direct',members});return reply(200,{success:true,thread_id:id});
   }
   if(data.action==='group'){
    const id='fixture-group-'+(++sequence);threads.set(id,{id,type:'group',name:data.name,members:[...new Set([owner,...data.member_ids])]});return reply(200,{success:true,thread_id:id});
   }
   if(data.action==='inbox')return reply(200,{success:true,messages:[]});
   if(data.action==='receipts')return reply(200,{success:true,read_recorded:true});
   const t=threads.get(data.thread_id);if(!t?.members.includes(owner))return reply(404,{success:false,message:'Conversación no disponible'});
   if(data.action==='messages')return reply(200,{success:true,messages:messages.get(t.id)||[]});
   if(data.action==='send'){
    const key=owner+':'+data.client_message_id;if(attempts.has(key))return reply(200,attempts.get(key));
    const id='fixture-message-'+(++sequence),timestamp='12:00';const message={id,sender_id:owner,sender_name:users[owner].name,sender_callsign:users[owner].callsign,text:data.text,timestamp,mediaType:data.mediaType,mediaUrl:data.mediaUrl,fileName:data.fileName};
    messages.set(t.id,[...(messages.get(t.id)||[]),message]);const saved={success:true,id,timestamp};attempts.set(key,saved);return reply(201,saved);
   }
   return reply(400,{success:false,message:'Acción de prueba desconocida'});
  }catch{return reply(503,{success:false,message:'No se pudo completar la fixture de chat'});}
 });
 return {install,operations};
}
