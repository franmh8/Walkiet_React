// Proveedor local controlado: no contacta a Expo, FCM ni APNs.
import http from 'node:http';
const events=[];
const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/events'){res.end(JSON.stringify(events));return;}
  if(req.url==='/push' && req.method==='POST') {
    let raw='';for await(const chunk of req) raw+=chunk;
    const batch=JSON.parse(raw);events.push(...batch);
    res.end(JSON.stringify({data:batch.map((_,i)=>({status:'ok',id:'local-ticket-'+events.length+'-'+i}))}));return;
  }
  res.writeHead(404);res.end('{}');
});
server.listen(8102,'127.0.0.1',()=>console.log('Proveedor push sintético en 127.0.0.1:8102'));
