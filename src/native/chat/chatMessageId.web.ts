export async function serverMessageId(userId:string, clientId:string) {
  const bytes=new TextEncoder().encode(userId+':'+clientId);
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return 'cm-'+Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('').slice(0,32);
}
