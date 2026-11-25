import assert from 'node:assert/strict';
import { ApiService, DEFAULT_SERVER_URL, getBackendUrl, resolveBackendUrl } from '../src/services/apiService.ts';

assert.equal(resolveBackendUrl(null), 'https://walkiet.alwaysdata.net');
assert.equal(resolveBackendUrl('http://walkt.gt.tc'), DEFAULT_SERVER_URL);
assert.equal(resolveBackendUrl('https://walkt.gt.tc/'), DEFAULT_SERVER_URL);
assert.equal(resolveBackendUrl('http://127.0.0.1:8103'), 'http://127.0.0.1:8103');
assert.equal(resolveBackendUrl('https://custom.example.test/php'), 'https://custom.example.test/php');
assert.equal(resolveBackendUrl('https://walkt.gt.tc.example.test'), 'https://walkt.gt.tc.example.test');
assert.equal(resolveBackendUrl(''), '', 'Conservar el uso relativo del servidor Node local.');

const storage=new Map([['c5i_backend_url','http://walkt.gt.tc']]);
const originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
const originalFetch=globalThis.fetch;
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
try {
  assert.equal(getBackendUrl(),DEFAULT_SERVER_URL);
  assert.equal(storage.get('c5i_backend_url'),DEFAULT_SERVER_URL,'La dirección migrada se conserva para la próxima apertura.');
  let calls=0;
  const real={status:'ONLINE',tables:{users:0}};
  globalThis.fetch=async()=>{calls++;return Response.json(real);};
  assert.deepEqual(await ApiService.getDbStatus(),real);assert.equal(calls,1);
  globalThis.fetch=async()=>Response.json({message:'No disponible'},{status:503});
  await assert.rejects(ApiService.getDbStatus(),/No se pudo consultar/);
  globalThis.fetch=async()=>{throw new TypeError('Sin red');};
  await assert.rejects(ApiService.getDbStatus(),/No se pudo consultar/,'Sin red no informa una conexión ficticia.');
  console.log('OK rutas: Alwaysdata, migración de dirección retirada, servidor personalizado/local y diagnóstico sin datos simulados.');
} finally {
  globalThis.fetch=originalFetch;
  if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);
  else Reflect.deleteProperty(globalThis,'localStorage');
}
