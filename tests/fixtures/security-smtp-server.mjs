// SMTP local con STARTTLS, certificado de prueba y credenciales sintéticas. Nunca envía al exterior.
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import fs from 'node:fs';
import {readSecurityMime} from './security-mime.mjs';
const certPath=process.env.WALKIET_SMTP_TEST_CERT,keyPath=process.env.WALKIET_SMTP_TEST_KEY;
if(!certPath||!keyPath)throw Error('Indica certificado/clave de pruebas fuera del repositorio.');
const secureContext=tls.createSecureContext({cert:fs.readFileSync(certPath),key:fs.readFileSync(keyPath)});
const events=[],transactions=[];let failure='';
const server=net.createServer(socket=>{
  let secure=false,authenticated=false,authStep=0,user='',recipient='',data=false,lines=[],buffer='';
  const transaction={tls:false,authBeforeTls:false,authCommands:0};transactions.push(transaction);
  const write=line=>socket.write(line+'\r\n');
  const onData=chunk=>{
    buffer+=chunk.toString();
    while(buffer.includes('\r\n')){
      const split=buffer.indexOf('\r\n'),line=buffer.slice(0,split);buffer=buffer.slice(split+2);
      if(data){
        if(line!=='.'){lines.push(line.startsWith('..')?line.slice(1):line);continue;}
        data=false;
        if(failure==='send'){write('451 4.3.0 synthetic temporary failure');continue;}
        const message=readSecurityMime(lines.join('\r\n'));
        const code=message.plain.match(/\b\d{6}\b/)?.[0];
        if(!code){write('550 5.6.0 invalid synthetic message');continue;}
        events.push({...message,to:recipient,code,tls:secure});write('250 2.0.0 synthetic queued');continue;
      }
      if(authStep===1){user=Buffer.from(line,'base64').toString();authStep=2;write('334 UGFzc3dvcmQ6');continue;}
      if(authStep===2){authStep=0;const password=Buffer.from(line,'base64').toString();authenticated=secure&&user==='sender@example.test'&&password==='abcdefghijklmnop'&&failure!=='auth';write(authenticated?'235 2.7.0 accepted':'535 5.7.8 synthetic authentication failure');continue;}
      const command=line.split(' ')[0].toUpperCase();
      if(command==='EHLO'){write('250-localhost');if(!secure&&failure!=='tls')write('250-STARTTLS');write('250 AUTH LOGIN');}
      else if(command==='STARTTLS'){
        if(failure==='tls'){write('454 4.7.0 synthetic TLS unavailable');continue;}
        if(secure){write('503 Already TLS');continue;}
        write('220 2.0.0 Start TLS');socket.removeListener('data',onData);
        socket=new tls.TLSSocket(socket,{isServer:true,secureContext});socket.on('error',()=>{});
        socket.on('secure',()=>{secure=true;transaction.tls=true;});socket.on('data',onData);
      }else if(command==='AUTH'){
        transaction.authCommands++;
        if(!secure){transaction.authBeforeTls=true;write('530 STARTTLS required');continue;}
        authStep=1;write('334 VXNlcm5hbWU6');
      }else if(command==='MAIL')write(authenticated?'250 OK':'530 Authentication required');
      else if(command==='RCPT'){recipient=line.match(/<([^>]+)>/)?.[1]||'';write(authenticated&&recipient?'250 OK':'550 Invalid recipient');}
      else if(command==='DATA'){if(!authenticated){write('530 Authentication required');continue;}data=true;lines=[];write('354 End with dot');}
      else if(command==='QUIT'){write('221 Bye');socket.end();}
      else if(command==='RSET'){data=false;lines=[];write('250 OK');}
      else write('500 Unsupported synthetic command');
    }
  };
  socket.on('error',()=>{});socket.on('data',onData);write('220 localhost synthetic SMTP');
});
server.listen(8114,'127.0.0.1');
http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/test/events')return res.end(JSON.stringify(events));
  if(req.url==='/test/transactions')return res.end(JSON.stringify(transactions));
  if(req.url==='/test/control'){let raw='';for await(const chunk of req)raw+=chunk;failure=JSON.parse(raw||'{}').failure||'';return res.end('{"ok":true}');}
  res.statusCode=404;res.end('{}');
}).listen(8115,'127.0.0.1',()=>console.log('SMTP sintético STARTTLS 8114, control HTTP 8115; sin envío externo.'));
