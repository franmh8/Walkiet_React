import type {User} from '../types';

export type RegistrationData = {name: string; phone_number: string; correo: string; password: string; challenge_id: string; code: string};
export class RegistrationApiError extends Error {
  constructor(message: string, public status: number, public retryAfter = 0) { super(message); }
}
export function createRegistrationApi(server: string, fetcher: typeof fetch = fetch) {
  const base=server.trim().replace(/\/+$/, '');
  const endpoint=base+(/alwaysdata\.net|\.php(?:$|\/)/i.test(base)?'/registration.php':'/api/registration');
  async function request(action: string, data: object) {
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),30000);
    try {
      const res=await fetcher(endpoint,{method:'POST',credentials:'omit',signal:controller.signal,headers:{'Content-Type':'text/plain;charset=UTF-8',Accept:'application/json'},body:JSON.stringify({action,...data})});
      const value=await res.json().catch(()=>null);
      if (!res.ok || value?.success!==true) throw new RegistrationApiError(value?.message || 'No se pudo completar el registro.',res.status,Number(res.headers.get('Retry-After'))||0);
      return value;
    } catch (error) {
      if (error instanceof RegistrationApiError) throw error;
      throw new Error('No se pudo contactar al servicio. Revisa tu conexión e intenta nuevamente.');
    } finally { clearTimeout(timer); }
  }
  return {
    sendCode: async (email: string, phone_number: string): Promise<{challenge_id: string; resend_after: number}> => {
      const value=await request('request',{email:email.trim().toLowerCase(),phone_number});
      if (typeof value.challenge_id!=='string' || !/^[a-f0-9]{64}$/.test(value.challenge_id)) throw new Error('El servidor no confirmó el envío del correo.');
      return {challenge_id:value.challenge_id,resend_after:Number(value.resend_after)||60};
    },
    complete: async (data: RegistrationData): Promise<User> => {
      const value=await request('complete',{...data,correo:data.correo.trim().toLowerCase()});
      if (!value.user?.id) throw new Error('El servidor no confirmó la creación de tu cuenta.');
      return value.user;
    },
  };
}
