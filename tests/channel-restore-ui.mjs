import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import mysql from 'mysql2/promise';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const backend=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';
if(backend!=='http://127.0.0.1:8103'||!process.env.CONTACTS_TEST_SOCKET)throw Error('Usa únicamente contacts_test_account y backend local.');
const db=await mysql.createConnection({socketPath:process.env.CONTACTS_TEST_SOCKET,user:'root',database:'contacts_test_account'});
const post=async(path,token,data)=>{const r=await fetch(backend+path,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});assert.ok(r.ok,`${path} HTTP ${r.status}`);return r.json();};
const login=async phone=>(await post('/login.php',null,{phone_number:phone,password:'profile-test-password'})).token;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const errors=[];const contexts=[];
async function context(){const c=await browser.newContext({viewport:{width:430,height:932}});contexts.push(c);await c.route('**/walkiet.alwaysdata.net/**',r=>r.abort());await c.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Radio de prueba detenida'})}));await c.addInitScript(server=>{localStorage.setItem('c5i_native_server_url',server);window.__micCalls=0;navigator.mediaDevices.getUserMedia=async()=>{window.__micCalls++;throw Error('Sin captura en esta prueba');};},backend);return c;}
async function signIn(page,phone){page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();}
const initialName='GRUPO DE PRUEBA DE PERFIL';
try{
 const a=await login('7710000301'),b=await login('7710000302');
 await post('/account.php',b,{action:'update',fields:{name:'Carlos de prueba'}});
 const cb=await context(),page=await cb.newPage();let first=true,requests=0,concurrent=0,maxConcurrent=0;
 await page.route('**/api/channels',async route=>{if(route.request().method()!=='GET')return route.continue();requests++;concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);try{if(first){first=false;const response=await route.fetch();await new Promise(r=>setTimeout(r,6500));await route.fulfill({response});}else await route.continue();}finally{concurrent--;}});
 await signIn(page,'7710000302');
 await page.getByText('Recuperando tu canal…',{exact:true}).waitFor();
 await page.waitForTimeout(4500);assert.equal(requests,1,'El sondeo de 4s no debe invalidar una lectura lenta.');assert.equal(maxConcurrent,1);
 assert.equal(await page.getByText('Ningún grupo seleccionado',{exact:true}).count(),0);
 await page.getByText(initialName,{exact:true}).waitFor();
 assert.ok((await page.getByLabel('Ver usuarios dentro del canal',{exact:true}).textContent()).includes('2'));
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('c5i_native_user')).authToken);
 await page.screenshot({path:'/tmp/channel-restored-carlos.png',fullPage:true});
 // Abrir de nuevo conserva la sesión válida y recupera el canal sin pedir contraseña.
 await page.close();const reopened=await cb.newPage();reopened.on('pageerror',e=>errors.push(e.message));await reopened.goto(url);await reopened.getByText(initialName,{exact:true}).waitFor();assert.equal(await reopened.getByText('Iniciar Sesión',{exact:true}).count(),0);
 assert.equal(await reopened.evaluate(()=>JSON.parse(localStorage.getItem('c5i_native_user')).authToken),before);
 const ca=await context(),peer=await ca.newPage();await signIn(peer,'7710000301');await peer.getByText(initialName,{exact:true}).waitFor();await peer.getByLabel('Ver usuarios dentro del canal',{exact:true}).click();await peer.getByText('Carlos de prueba',{exact:true}).waitFor();await peer.getByText('2 miembros • Táctico',{exact:true}).waitFor();await peer.getByLabel('Cerrar miembros del grupo',{exact:true}).click();
 // Sin preferencia local en otro dispositivo, la membresía del servidor basta.
 const clean=await context(),second=await clean.newPage();await signIn(second,'7710000302');await second.getByText(initialName,{exact:true}).waitFor();
 await second.close();await clean.close();
 // Tener otro grupo más reciente no desplaza la preferencia existente.
 const created=await post('/channels.php',a,{action:'create',name:'SEGUNDO CANAL DE PRUEBA',pin:'8284'});const extra=created.channel;
 await post('/channels.php',b,{action:'join',pin:'8284'});
 await reopened.reload();await reopened.getByText(initialName,{exact:true}).waitFor();
 await db.execute('UPDATE channels SET name=? WHERE id=?',['CANAL RENOMBRADO','account-group']);await reopened.reload();await reopened.getByText('CANAL RENOMBRADO',{exact:true}).waitFor();
 await reopened.getByText('Grupos',{exact:true}).click();await reopened.getByLabel('Sintonizar SEGUNDO CANAL DE PRUEBA',{exact:true}).click();await reopened.getByText('COMENZAR A TRANSMITIR',{exact:true}).click();await reopened.getByText('SEGUNDO CANAL DE PRUEBA',{exact:true}).waitFor();
 // Login nuevo del mismo ID emite otro token, pero conserva el grupo elegido.
 await reopened.getByText('Perfil',{exact:true}).click();await reopened.getByLabel('Cerrar sesión',{exact:true}).click();await reopened.getByText('Iniciar Sesión',{exact:true}).waitFor();
 await reopened.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill('7710000302');await reopened.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await reopened.getByText('Iniciar Sesión',{exact:true}).click();await reopened.getByText('SEGUNDO CANAL DE PRUEBA',{exact:true}).waitFor();
 // Un error inicial no debe convertirse en una cuenta sin grupos ni borrar la selección.
 await reopened.route('**/api/channels',r=>r.request().method()==='GET'?r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Consulta de grupos temporalmente no disponible'})}):r.continue());
 await reopened.reload();await reopened.getByText('No se pudieron recuperar tus grupos',{exact:true}).waitFor();assert.equal(await reopened.getByText('Ningún grupo seleccionado',{exact:true}).count(),0);assert.equal(await reopened.getByText('Crea un grupo o únete a uno para comunicarte',{exact:true}).count(),0);
 await reopened.unroute('**/api/channels');await reopened.getByText('Reintentar grupos',{exact:true}).click();await reopened.getByText('SEGUNDO CANAL DE PRUEBA',{exact:true}).waitFor();
 // Salir retira membresía y selecciona el grupo que realmente queda.
 const currentToken=await reopened.evaluate(()=>JSON.parse(localStorage.getItem('c5i_native_user')).authToken);
 await post('/channels.php',currentToken,{action:'leave',id:extra.id});await reopened.getByText('CANAL RENOMBRADO',{exact:true}).waitFor();
 await post('/channels.php',currentToken,{action:'leave',id:'account-group'});await reopened.getByText('Ningún grupo seleccionado',{exact:true}).waitFor();await reopened.reload();await reopened.getByText('Ningún grupo seleccionado',{exact:true}).waitFor();
 await reopened.getByText('Perfil',{exact:true}).click();await reopened.getByLabel('Cerrar sesión',{exact:true}).click();await reopened.getByText('Iniciar Sesión',{exact:true}).waitFor();await reopened.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill('7710000303');await reopened.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await reopened.getByText('Iniciar Sesión',{exact:true}).click();await reopened.getByText('Ningún grupo seleccionado',{exact:true}).waitFor();
 await reopened.getByText('Grupos',{exact:true}).click();await reopened.getByText('Sin ningún grupo registrado',{exact:true}).waitFor();
 assert.equal(await reopened.evaluate(()=>window.__micCalls),0);assert.deepEqual(errors,[]);
 console.log('OK restauración: membresía y contador coinciden entre cuentas, consulta de 6.5s sin sondeos superpuestos, dispositivo nuevo, sesión al reabrir, último canal con token nuevo/renombre, errores sin vacío falso, salida y aislamiento de cuenta nueva.');
}finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await db.end();}
