// Sustituye solo los dos endpoints HTTP de Google en una BD contacts_test_ y proceso marcado de pruebas.
// No envía correo y no se usa desde la aplicación publicada.
import http from 'node:http';
import {readSecurityMime} from './security-mime.mjs';
const events=[];let failure='';
http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  const respond=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
  if(req.method==='GET'&&req.url==='/test/events')return respond(200,events);
  let raw='';for await(const chunk of req)raw+=chunk;
  if(req.url==='/test/control'){failure=JSON.parse(raw||'{}').failure||'';return respond(200,{ok:true});}
  if(req.url==='/token'){
    const form=new URLSearchParams(raw);
    if(form.get('client_id')!=='synthetic-google-client'||form.get('client_secret')!=='synthetic-google-secret'||form.get('refresh_token')!=='synthetic-google-refresh'||form.get('grant_type')!=='refresh_token')return respond(401,{error:'invalid_grant'});
    if(failure==='token')return respond(401,{error:'invalid_grant'});
    return respond(200,{access_token:'synthetic-google-access',token_type:'Bearer'});
  }
  if(req.url==='/send'){
    if(req.headers.authorization!=='Bearer synthetic-google-access')return respond(401,{error:'unauthorized'});
    if(failure==='send')return respond(503,{error:'unavailable'});
    const mime=Buffer.from(JSON.parse(raw).raw,'base64url').toString();
    const message=readSecurityMime(mime);
    const code=message.plain.match(/\b\d{6}\b/)?.[0]; const to=message.to;
    if(!code||!to)return respond(400,{error:'invalid_mime'});
    events.push({...message,to,code});
    return respond(200,{id:'synthetic-message-'+events.length});
  }
  respond(404,{error:'not_found'});
}).listen(8110,'127.0.0.1',()=>console.log('Proveedor de correo controlado en 127.0.0.1:8110; sin envío externo.'));
