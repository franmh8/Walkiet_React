// Lee las partes MIME de los mensajes generados por el backend, sin enviar correo.
export function readSecurityMime(mime) {
  const separator=mime.indexOf('\r\n\r\n');const headers=mime.slice(0,separator).replace(/\r\n[ \t]+/g,' '),body=mime.slice(separator+4);
  const header=(text,name)=>text.match(new RegExp('^'+name+':\\s*(.+)$','im'))?.[1].trim()||'';
  const decode=(value,encoding)=>encoding.toLowerCase()==='base64'?Buffer.from(value.replace(/\s/g,''),'base64').toString():value;
  let plain='',html='';
  const boundary=header(headers,'Content-Type').match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if(boundary){
    for(const part of body.split('--'+(boundary[1]||boundary[2])).slice(1,-1)){
      const source=part.replace(/^\r\n/,'');const split=source.indexOf('\r\n\r\n');const fields=source.slice(0,split);
      const value=decode(source.slice(split+4),header(fields,'Content-Transfer-Encoding'));
      const type=header(fields,'Content-Type');if(type.startsWith('text/plain'))plain=value;if(type.startsWith('text/html'))html=value;
    }
  }else plain=decode(body,header(headers,'Content-Transfer-Encoding'));
  return{plain,html,to:header(headers,'To').replace(/^.*<([^>]+)>.*$/,'$1'),subject:header(headers,'Subject')};
}
