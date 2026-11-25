import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const backend=process.env.ACCOUNT_TEST_BACKEND, url=process.env.ACCOUNT_UI_URL||'http://localhost:3002';
if(backend!=='http://127.0.0.1:8103')throw Error('Usa la fixture contacts_test_account local.');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:430,height:932},colorScheme:'dark',permissions:['notifications']});
const errors=[];
try{
  await context.route('**/walkiet.alwaysdata.net/**',route=>route.abort());
  await context.addInitScript(server=>localStorage.setItem('c5i_native_server_url',server),backend);
  await context.addInitScript(()=>{
    window.receivedTones=0;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(Audio){const create=Audio.prototype.createOscillator;Audio.prototype.createOscillator=function(...args){window.receivedTones++;return create.apply(this,args);};}
  });
  let inbox=[],inboxRequests=0;const chatRequests=[];
  await context.route('**/chat-sync.php*',async route=>{
    const request=route.request();if(request.method()==='OPTIONS'){await route.continue();return;}const action=request.method()==='GET'?new URL(request.url()).searchParams.get('action'):request.postDataJSON()?.action;
    chatRequests.push(action);
    if(action==='threads')await route.fulfill({headers:{'Access-Control-Allow-Origin':new URL(url).origin},json:{success:true,threads:[],features:['receipts']}});
    else if(action==='inbox'){inboxRequests++;await route.fulfill({headers:{'Access-Control-Allow-Origin':new URL(url).origin},json:{success:true,messages:inbox}});}
    else if(action==='receipts')await route.fulfill({headers:{'Access-Control-Allow-Origin':new URL(url).origin},json:{success:true,seen_recorded:true,read_recorded:false}});
    else await route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const login=async phone=>{
    await page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true}).fill(phone);
    await page.getByPlaceholder('Ingresa tu contraseña',{exact:true}).fill('profile-test-password');
    await page.getByText('Iniciar Sesión',{exact:true}).click();
    await page.getByText('Perfil',{exact:true}).click();
    await page.getByLabel('Configuración y ajustes',{exact:true}).click();
    await page.getByLabel('Tema Claro',{exact:true}).waitFor({state:'visible'});
    await page.getByLabel('Tema Claro',{exact:true}).isEnabled();
  };
  const saved=async()=>page.evaluate(async server=>{
    const token=JSON.parse(localStorage.getItem('c5i_native_user')).authToken;
    return (await (await fetch(server+'/account.php',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'text/plain'},body:JSON.stringify({action:'get'})})).json()).settings;
  },backend);
  const waitSaved=async patch=>{
    for(let i=0;i<50;i++){const value=await saved();if(Object.entries(patch).every(([key,v])=>value[key]===v)){await page.getByText('Guardado',{exact:true}).waitFor();return;}await page.waitForTimeout(100);}
    assert.fail('El ajuste no persistio: '+JSON.stringify(patch));
  };
  const theme=async color=>{
    await page.waitForFunction(expected=>{
      const title=[...document.querySelectorAll('*')].find(e=>e.textContent==='Tema'&&e.childElementCount===0);
      return title&&getComputedStyle(title).color===expected;
    },color);
  };
  await page.goto(url);await login('7710000301');
  await theme('rgb(15, 23, 42)');
  for(const [label,key] of [['Mostrar última conexión','showLastSeen'],['Confirmaciones de lectura','readReceipts'],['Guardar fotos automáticamente','autoSavePhotos'],['Sonidos de mensajes','messageSounds'],['Tono Roger Beep','rogerBeep']]){
    await page.getByLabel(label,{exact:true}).click();await waitSaved({[key]:false});
  }
  assert.equal(await page.getByLabel('Probar sonido de mensaje',{exact:true}).isDisabled(),true);
  assert.equal(await page.getByLabel('Probar Roger Beep',{exact:true}).isDisabled(),true);
  await page.getByLabel('PTT Alternar',{exact:true}).click();await waitSaved({pttMode:'toggle'});
  await page.getByLabel('Activar notificaciones',{exact:true}).click();await waitSaved({backgroundNotifications:true});
  await page.getByLabel('Activar notificaciones',{exact:true}).click();await waitSaved({backgroundNotifications:false});
  await page.reload();await page.getByText('Perfil',{exact:true}).click();await page.getByLabel('Configuración y ajustes',{exact:true}).click();
  await theme('rgb(15, 23, 42)');
  const prefs=await saved();assert.equal(prefs.pttMode,'toggle');assert.equal(prefs.readReceipts,false);assert.equal(prefs.autoSavePhotos,false);
  assert.equal(await page.getByLabel('Tema Claro',{exact:true}).getAttribute('aria-checked'),'true');
  // Un servidor antiguo que devuelve success sin aplicar el cambio no debe aparentar exito.
  await page.route('**/api/account',async route=>{
    const request=route.request().postDataJSON();
    if(request?.action!=='settings'){await route.continue();return;}
    const response=await route.fetch({postData:JSON.stringify({action:'get'})});
    await route.fulfill({response});
  });
  await page.getByLabel('Tema Oscuro',{exact:true}).click();
  await page.getByText(/El servidor no aplicó el ajuste/).first().waitFor();
  assert.equal(await page.getByLabel('Tema Claro',{exact:true}).getAttribute('aria-checked'),'true');
  assert.equal((await saved()).theme,'light');
  await page.unroute('**/api/account');
  const message=id=>({id,thread_id:'synthetic-inbox-thread',sender_id:'account-b',sender_name:'Prueba B',text:'Mensaje sintético',mediaType:'text',timestamp:'12:00',sentAt:new Date().toISOString()});
  for(let i=0;i<60&&inboxRequests===0;i++)await page.waitForTimeout(100);
  assert.ok(inboxRequests>0,JSON.stringify(chatRequests));
  let polls=inboxRequests;inbox=[message('muted-message')];
  for(let i=0;i<60&&inboxRequests<=polls;i++)await page.waitForTimeout(100);
  assert.ok(inboxRequests>polls);assert.equal(await page.evaluate(()=>window.receivedTones),0,'Mensajes nuevos no suenan cuando el ajuste está apagado.');
  await page.getByLabel('Sonidos de mensajes',{exact:true}).click();await waitSaved({messageSounds:true});
  inbox=[message('audible-message')];
  await page.waitForFunction(()=>window.receivedTones===1);
  polls=inboxRequests;for(let i=0;i<80&&inboxRequests<=polls;i++)await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.receivedTones),1,'Redeliveries del mismo mensaje no duplican el aviso.');
  inbox=[];
  await page.screenshot({path:'/tmp/walkiet-settings-functional.png',fullPage:true});
  await page.getByLabel('Volver al perfil',{exact:true}).click();await page.getByLabel('Cerrar sesión',{exact:true}).click();
  const identifier=page.getByPlaceholder('Ingresa tu teléfono o correo',{exact:true});await identifier.waitFor();
  assert.equal(await identifier.evaluate(e=>getComputedStyle(e).color),'rgb(15, 23, 42)','Cerrar sesion conserva Claro con el dispositivo oscuro.');
  await page.reload();await identifier.waitFor();
  assert.equal(await identifier.evaluate(e=>getComputedStyle(e).color),'rgb(15, 23, 42)','Reabrir sin sesion conserva Claro.');
  await login('7710000302');
  await theme('rgb(241, 245, 249)');
  assert.equal(await page.getByLabel('Tema Sistema',{exact:true}).getAttribute('aria-checked'),'true');
  assert.equal((await saved()).messageSounds,true,'Los ajustes de A no modifican B.');
  await page.emulateMedia({colorScheme:'light'});await theme('rgb(15, 23, 42)');
  await page.emulateMedia({colorScheme:'dark'});await theme('rgb(241, 245, 249)');
  assert.deepEqual(errors,[]);
  console.log('OK ajustes: persistencia real de todos los controles, rechazo de cambios ignorados, Claro tras logout/reinicio en dispositivo oscuro, Sistema sigue al dispositivo y cuentas aisladas.');
}finally{await browser.close();}
