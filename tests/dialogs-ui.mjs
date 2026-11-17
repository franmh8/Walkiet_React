import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const backend=process.env.ACCOUNT_TEST_BACKEND,url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';
if(backend!=='http://127.0.0.1:8103')throw Error('Usa exclusivamente contacts_test_account local.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:430,height:932},colorScheme:'light'});
 await context.route('**/walkiet.alwaysdata.net/**',r=>r.abort());
 await context.route('**/api/ptt',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Radio detenida en prueba visual'})}));
 await context.addInitScript(server=>localStorage.setItem('c5i_native_server_url',server),backend);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));let emergency=0;
 await page.route('**/api/emergency/alert',async r=>{emergency++;await r.fulfill({status:200,body:'{"success":true}'});});
 await page.goto(url);await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill('7710000301');await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');await page.getByText('Iniciar Sesión',{exact:true}).click();
 await page.waitForFunction(()=>!!JSON.parse(localStorage.getItem('c5i_native_user')||'null')?.authToken);
 const token=await page.evaluate(()=>JSON.parse(localStorage.getItem('c5i_native_user')).authToken);
 for(const [name,phone] of [['Sin registro','7710000998'],['Compañero B','7710000302']]){
  const r=await fetch(backend+'/contacts.php',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({action:'create',name,phone_number:phone,email:''})});assert.equal(r.status,201);
 }
 await page.reload();
 const dialog=title=>page.getByRole('dialog',{name:title,exact:true});
 const check=async title=>{const card=dialog(title);await card.waitFor();await page.waitForTimeout(350);await card.getByTestId('dialog-top-drop').waitFor();const b=await card.boundingBox();const viewport=page.viewportSize();assert.ok(b.x>=0&&b.x+b.width<=viewport.width+1);assert.ok(b.y>=0&&b.y+b.height<=viewport.height+1);return card;};
 await page.getByText('Chat',{exact:true}).click();await page.getByLabel('Nueva conversación',{exact:true}).click();await page.getByText('Sin registro',{exact:true}).click();
 await check('Contacto sin cuenta');assert.equal(await dialog('Contacto sin cuenta').getByText('Este contacto aún no tiene cuenta en la app. Puedes llamarle por teléfono.',{exact:true}).count(),1);
 await page.screenshot({path:'/tmp/dialog-info-mobile.png',fullPage:true});
 await dialog('Contacto sin cuenta').getByRole('button',{name:'Entendido',exact:true}).click();
 // El aviso cierra y permite continuar en el selector que ya estaba abierto.
 await page.getByText('Compañero B',{exact:true}).click();await page.getByLabel('Adjuntar archivo o evidencia',{exact:true}).click();
 const chooser=page.waitForEvent('filechooser');await page.getByLabel('Seleccionar documento',{exact:true}).click();await(await chooser).setFiles({name:'grande.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(3*1024*1024+1)});
 await check('Aviso');await dialog('Aviso').getByText('Elige un documento de hasta 3 MB.',{exact:true}).waitFor();await dialog('Aviso').getByRole('button',{name:'Entendido',exact:true}).click();
 await page.getByLabel('Volver a los chats',{exact:true}).click();await page.getByText('PTT',{exact:true}).click();await page.getByLabel('Llamada de Emergencia SOS',{exact:true}).click();
 await check('🚨 ALERTA DE EMERGENCIA C5i (10-33)');await dialog('🚨 ALERTA DE EMERGENCIA C5i (10-33)').getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(emergency,0,'Cancelar no debe activar SOS.');
 await page.getByText('Grupos',{exact:true}).click();await page.getByLabel('Sintonizar GRUPO DE PRUEBA DE PERFIL',{exact:true}).click();await check('Canal Sintonizado');await page.screenshot({path:'/tmp/dialog-channel-mobile.png',fullPage:true});await dialog('Canal Sintonizado').getByRole('button',{name:'COMENZAR A TRANSMITIR',exact:true}).click();
 await page.getByText('Perfil',{exact:true}).click();await page.getByLabel('Editar Nombre',{exact:true}).click();await check('Editar nombre');await page.getByLabel('Nombre',{exact:true}).fill('Nombre conservado');
 await page.route('**/api/account',async r=>{if(r.request().postDataJSON()?.action==='update'){await new Promise(resolve=>setTimeout(resolve,700));await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Fallo de guardado de prueba'})});}else await r.continue();});
 await page.getByLabel('Guardar cambios del perfil',{exact:true}).click();assert.equal(await page.getByLabel('Cerrar edición del perfil',{exact:true}).isDisabled(),true);await page.keyboard.press('Escape');await dialog('Editar nombre').waitFor();await page.getByText('Fallo de guardado de prueba',{exact:true}).waitFor();assert.equal(await page.getByLabel('Nombre',{exact:true}).inputValue(),'Nombre conservado');
 await page.unroute('**/api/account');await page.getByLabel('Nombre',{exact:true}).fill('Perfil de prueba visual');await page.getByLabel('Guardar cambios del perfil',{exact:true}).click();await check('Cambios guardados');await dialog('Cambios guardados').getByRole('button',{name:'Entendido',exact:true}).click();
 await page.getByLabel('Cambiar foto de perfil',{exact:true}).click();await check('Foto de perfil');await dialog('Foto de perfil').getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByLabel('Editar Correo institucional',{exact:true}).click();await check('Verificar nuevo correo');
 for(const width of [320,430,1440]){await page.setViewportSize({width,height:width===320?640:932});await check('Verificar nuevo correo');await page.screenshot({path:`/tmp/dialog-email-${width}.png`,fullPage:true});}
 await page.getByLabel('Nuevo correo',{exact:true}).fill('visual@example.test');await dialog('Verificar nuevo correo').getByRole('button',{name:'Cancelar verificación',exact:true}).click();
 await page.setViewportSize({width:320,height:640});await page.getByLabel('Eliminar cuenta',{exact:true}).click();await check('Eliminar tu cuenta');await page.getByLabel('Contraseña para eliminar cuenta',{exact:true}).fill('profile-test-password');await page.getByLabel('Confirmación ELIMINAR',{exact:true}).fill('NO');assert.equal(await page.getByLabel('Confirmar eliminación de mi cuenta',{exact:true}).isDisabled(),true);await dialog('Eliminar tu cuenta').getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.setViewportSize({width:430,height:932});await page.getByLabel('Configuración y ajustes',{exact:true}).click();await page.getByLabel('Tema Oscuro',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Tema Oscuro"]').getAttribute('aria-checked')==='true');await page.getByLabel('Volver al perfil',{exact:true}).click();await page.getByLabel('Editar Nombre',{exact:true}).click();await check('Editar nombre');const color=await dialog('Editar nombre').evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(color,'rgb(23, 34, 53)');await page.screenshot({path:'/tmp/dialog-profile-dark.png',fullPage:true});await dialog('Editar nombre').getByRole('button',{name:'Cancelar',exact:true}).click();
 // Confirmaciones de contactos: cancelar conserva el registro y confirmar lo elimina una sola vez.
 await page.getByText('Contactos',{exact:true}).click();await page.getByText('Sin registro',{exact:true}).click();
 await page.getByText('Eliminar Contacto',{exact:true}).click();await check('¿Eliminar Contacto C5i?');await dialog('¿Eliminar Contacto C5i?').getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByText('Eliminar Contacto',{exact:true}).click();await check('¿Eliminar Contacto C5i?');await page.screenshot({path:'/tmp/dialog-delete-dark.png',fullPage:true});await dialog('¿Eliminar Contacto C5i?').getByRole('button',{name:'Confirmar acción',exact:true}).click();
 await check('Listo');await dialog('Listo').getByText('Contacto "Sin registro" eliminado de la BD',{exact:true}).waitFor();await dialog('Listo').getByRole('button',{name:'Entendido',exact:true}).click();
 assert.equal(await page.getByText('Sin registro',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('OK diálogos: aviso sobre selector abierto, misma gota en canal/perfil/correo/foto/baja, error conserva datos, cierre bloqueado mientras guarda, confirmación/baja de contacto y SOS cancelado sin activar, tamaños 320/430/1440 y tema oscuro.');
}finally{await browser.close();}
