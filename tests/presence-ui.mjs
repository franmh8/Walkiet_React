import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';
if(base!=='http://127.0.0.1:8103')throw Error('Usa únicamente contacts_test_account local.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const errors=[];
try{
 const open=async phone=>{
  const context=await browser.newContext({viewport:{width:430,height:932},colorScheme:'light'});
  await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());
  await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Radio de prueba detenida"}'}));
  await context.addInitScript(server=>localStorage.setItem('c5i_native_server_url',server),base);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();await page.getByText('PTT',{exact:true}).waitFor();
  return {page,context};
 };
 const {page:a}=await open('7710000301');
 const token=await a.evaluate(()=>JSON.parse(localStorage.getItem('c5i_native_user')).authToken);
 const r=await fetch(base+'/contacts.php',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({action:'create',name:'Compañero B',phone_number:'7710000302',email:''})});assert.equal(r.status,201);
 await a.reload();await a.getByText('Chat',{exact:true}).click();await a.getByLabel('Nueva conversación',{exact:true}).click();await a.getByText('Compañero B',{exact:true}).click();
 await a.getByText('desconectado',{exact:true}).waitFor();assert.equal(await a.getByText('en línea',{exact:true}).count(),0,'El estado antiguo online de la BD no debe usarse.');
 const {page:b,context:bc}=await open('7710000302');await a.getByText('en línea',{exact:true}).waitFor({timeout:22000});
 const background=async(page,value)=>page.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>value});document.dispatchEvent(new Event('visibilitychange'));},value);
 await background(b,true);await a.getByText(/^últ\. vez /).waitFor({timeout:22000});await a.screenshot({path:'/tmp/presence-last-seen-mobile.png',fullPage:true});
 await background(b,false);await a.getByText('en línea',{exact:true}).waitFor({timeout:22000});
 // Dos pestañas comparten token, pero no conexión: cerrar una no apaga la otra.
 const btab=await bc.newPage();await btab.goto(url);await btab.getByText('PTT',{exact:true}).waitFor();await background(b,true);await a.waitForTimeout(16000);await a.getByText('en línea',{exact:true}).waitFor();
 await btab.getByText('Perfil',{exact:true}).click();await btab.getByLabel('Configuración y ajustes',{exact:true}).click();
 await btab.getByLabel('Mostrar última conexión',{exact:true}).waitFor();assert.equal(await btab.getByLabel('Mostrar última conexión',{exact:true}).isChecked(),true);
 await btab.getByLabel('Mostrar última conexión',{exact:true}).click();await btab.waitForFunction(()=>document.querySelector('[aria-label="Mostrar última conexión"]').checked===false);
 await btab.getByLabel('Tema Oscuro',{exact:true}).click();await btab.waitForFunction(()=>document.querySelector('[aria-label="Tema Oscuro"]').getAttribute('aria-checked')==='true');await btab.screenshot({path:'/tmp/presence-privacy-dark.png',fullPage:true});
 await btab.reload();await btab.getByText('Perfil',{exact:true}).click();await btab.getByLabel('Configuración y ajustes',{exact:true}).click();assert.equal(await btab.getByLabel('Mostrar última conexión',{exact:true}).isChecked(),false,'La preferencia sobrevive al reinicio.');
 await background(btab,true);await a.getByText('desconectado',{exact:true}).waitFor({timeout:22000});assert.equal(await a.getByText(/^últ\. vez /).count(),0,'Fecha oculta en el chat.');
 await background(btab,false);await a.getByText('en línea',{exact:true}).waitFor({timeout:22000});
 // Una caída de red no conserva el punto verde ni la fecha almacenada.
 await a.route('**/api/account',async route=>{if(route.request().postDataJSON()?.action==='presence')return route.abort();return route.continue();});
 await a.getByText('Estado no disponible',{exact:true}).waitFor({timeout:22000});await a.unroute('**/api/account');await a.getByText('en línea',{exact:true}).waitFor({timeout:22000});
 await a.getByLabel('Volver a los chats',{exact:true}).click();assert.equal(await a.locator('[data-testid="peer-online-dot"]').count(),1);
 assert.deepEqual(errors,[]);console.log('OK UI presencia: dos cuentas reales de prueba, sin falso online inicial, primer plano/fondo, dos pestañas, última conexión, privacidad persistente y tema oscuro, desconexión y recuperación de red.');
}finally{await browser.close();}
