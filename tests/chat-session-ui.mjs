import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createChatSyncBrowserFixture} from './fixtures/chat-sync-browser.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const backend=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';
if(backend!=='http://127.0.0.1:8103')throw Error('Usa únicamente contacts_test_account local.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
let release=()=>{};
try{
 const context=await browser.newContext({viewport:{width:430,height:932}});
 await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());await createChatSyncBrowserFixture(backend).install(context);
 await context.addInitScript(base=>localStorage.setItem('c5i_native_server_url',base),backend);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const login=async phone=>{await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();await page.getByText('PTT',{exact:true}).waitFor();};
 await page.goto(url);await login('7710000301');
 const token=await page.evaluate(()=>JSON.parse(localStorage.getItem('c5i_native_user')).authToken);
 const r=await fetch(backend+'/contacts.php',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({action:'create',name:'Compañero B',phone_number:'7710000302',email:''})});assert.equal(r.status,201);
 await page.reload();await page.getByText('Chat',{exact:true}).click();await page.getByLabel('Nueva conversación',{exact:true}).click();await page.getByText('Compañero B',{exact:true}).click();
 let started;const sent=new Promise(resolve=>{started=resolve;});const pending=new Promise(resolve=>{release=resolve;});
 await page.route('**/chat-sync.php**',async route=>{if(route.request().method()!=='POST'||route.request().postDataJSON()?.action!=='send')return route.fallback();started();await pending;return route.fulfill({status:503,contentType:'application/json',body:'{"success":false,"message":"Error tardío de la cuenta anterior"}'});});
 await page.getByPlaceholder('Escribe un mensaje de radio...',{exact:true}).fill('Borrador de la cuenta anterior');await page.getByLabel('Enviar mensaje',{exact:true}).click();await sent;
 await page.getByLabel('Volver a los chats',{exact:true}).click();await page.getByText('Perfil',{exact:true}).click();await page.getByLabel('Cerrar sesión',{exact:true}).click();await page.getByText('Iniciar Sesión',{exact:true}).waitFor();
 await login('7710000303');release();await page.waitForTimeout(700);
 assert.equal(await page.getByRole('dialog').count(),0,'Un error tardío no debe abrir un aviso sobre otra cuenta.');
 await page.getByText('Chat',{exact:true}).click();await page.getByLabel('Nueva conversación',{exact:true}).waitFor();
 assert.equal(await page.getByText('Borrador de la cuenta anterior',{exact:true}).count(),0);assert.deepEqual(errors,[]);
 console.log('OK sesión del chat modular: un envío pendiente de A no muestra avisos ni borra datos de C tras cerrar sesión.');
}finally{release();await browser.close();}
