export class SecurityApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function createSecurityApi(server: string, token = '', fetcher: typeof fetch = fetch) {
  const base=server.trim().replace(/\/+$/, '');
  const endpoint=base+(/alwaysdata\.net|\.php(?:$|\/)/i.test(base)?'/security.php':'/api/security');
  async function request(action: string, payload: object, authenticated = false) {
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),30000);
    try {
      const res=await fetcher(endpoint,{method:'POST',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'text/plain;charset=UTF-8',Accept:'application/json',...(authenticated?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,...payload})});
      const value=await res.json().catch(()=>null);
      if (!res.ok || value?.success!==true) throw new SecurityApiError(value?.message || 'No se pudo completar la verificación.',res.status);
      return value;
    } catch (cause) {
      if (cause instanceof SecurityApiError) throw cause;
      throw new Error('No se pudo contactar al servicio. Tu cambio todavía no está confirmado.');
    } finally { clearTimeout(timeout); }
  }
  return {
    emailRequest: (email: string,password: string)=>request('email_request',{email,password},true),
    emailVerify: (challenge_id: string,code: string)=>request('email_verify',{challenge_id,code},true),
    recoveryRequest: (identifier: string)=>request('recovery_request',{identifier}),
    recoveryVerify: (challenge_id: string,code: string)=>request('recovery_verify',{challenge_id,code}),
    recoveryReset: (challenge_id: string,reset_token: string,new_password: string)=>request('recovery_reset',{challenge_id,reset_token,new_password}),
  };
}
