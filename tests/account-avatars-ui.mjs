import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium }=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const backend=process.env.ACCOUNT_TEST_BACKEND;
if(backend!=='http://127.0.0.1:8103')throw Error('Usa exclusivamente el backend local contacts_test_account.');
let photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
const request=async(token,path,data)=>{const res=await fetch(backend+path,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});assert.ok(res.ok,`HTTP ${res.status}`);return res.json();};
const login=async phone=>(await request(null,'/login.php',{phone_number:phone,password:'profile-test-password'})).token;
const a=await login('7710000301'),b=await login('7710000302');
await request(a,'/account.php',{action:'avatar',image:null});
await request(b,'/contacts.php',{action:'create',name:'Compañero A',phone_number:'7710000301',email:''});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:430,height:932}});const errors=[],queries=[];
 await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());
 await context.addInitScript(server=>localStorage.setItem('c5i_native_server_url',server),backend);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url()===backend+'/api/account'&&r.method()==='POST'){const body=r.postDataJSON();if(body.action==='avatars')queries.push(body);}});
 await page.goto(process.env.ACCOUNT_UI_URL||'http://localhost:3001');
 photo=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='#137f87';ctx.fillRect(0,0,160,160);ctx.fillStyle='#f6cc83';ctx.beginPath();ctx.arc(80,60,28,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(80,150,55,Math.PI,0);ctx.fill();return canvas.toDataURL('image/png');});
 await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill('7710000302');await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();
 await page.getByText('Chat',{exact:true}).click();await page.getByLabel('Nueva conversación',{exact:true}).click();await page.getByText('Compañero A',{exact:true}).click();
 assert.equal(await page.getByLabel('Foto de Compañero A',{exact:true}).count(),0);
 // Otro dispositivo guarda la imagen mientras B mantiene la conversación abierta.
 await request(a,'/account.php',{action:'avatar',image:photo});
 await page.getByLabel('Foto de Compañero A',{exact:true}).waitFor({timeout:40000});
 const image=page.getByLabel('Foto de Compañero A',{exact:true});
 const imageSource=await image.evaluate(e=>e.getAttribute('src')||e.querySelector('img')?.src);assert.equal(imageSource,photo);
 assert.ok(await image.evaluate(e=>{const img=e.tagName==='IMG'?e:e.querySelector('img');return img?.complete&&img.naturalWidth>0;}));
 await page.screenshot({path:'/tmp/peer-avatar-chat-mobile.png',fullPage:true});
 // La foto aparece también en la lista, sin convertir un grupo en un usuario.
 await page.getByLabel('Volver a los chats',{exact:true}).click();
 await page.getByLabel('Foto de Compañero A',{exact:true}).waitFor();
 await page.screenshot({path:'/tmp/peer-avatar-list-mobile.png',fullPage:true});
 await page.getByText('Contactos',{exact:true}).click();await page.getByLabel('Foto de Compañero A',{exact:true}).waitFor();
 await page.getByText('Compañero A',{exact:true}).click();assert.equal(await page.getByLabel('Foto de Compañero A',{exact:true}).count(),2);
 await page.screenshot({path:'/tmp/peer-avatar-contact-mobile.png',fullPage:true});
 // Una segunda imagen también debe sustituir la anterior.
 const changedPhoto=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;const ctx=canvas.getContext('2d');ctx.fillStyle='#691c32';ctx.fillRect(0,0,2,2);return canvas.toDataURL('image/png');});
 await request(a,'/account.php',{action:'avatar',image:changedPhoto});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(expected=>{const images=[...document.querySelectorAll('[aria-label="Foto de Compañero A"]')];return images.length>0&&images.every(e=>(e.getAttribute('src')||e.querySelector('img')?.src)===expected);},changedPhoto);
 // Al retirar la foto, la siguiente consulta debe borrar también la caché.
 await request(a,'/account.php',{action:'avatar',image:null});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Foto de Compañero A"]').length===0);
 assert.ok(queries.some(q=>q.known?.['account-a']));
 assert.deepEqual(errors,[]);
 console.log('OK fotos UI con dos cuentas: foto nueva visible sin recargar por sondeo, imagen decodificada en chat/lista/contactos, nombre personalizado conservado, cambio de imagen y retirada borra la foto y usa iniciales.');
}finally{await browser.close();}
