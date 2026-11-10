// Fallos controlados del control HTTP; no se envía audio ni push a producción.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const backend = process.env.PTT_TEST_BACKEND;
if (backend !== 'http://127.0.0.1:8101') throw new Error('Se requiere el backend sintético contacts_test_ptt.');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const response = await fetch(backend + '/login.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identificador: '7710000201', password: 'ptt-test-password' }) });
  const session = await response.json(); assert.ok(session.token);
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await context.route('**/walkiet.alwaysdata.net/**', route => route.abort());
  await context.addInitScript(({ backend, session }) => {
    localStorage.setItem('c5i_native_server_url', backend);
    localStorage.setItem('c5i_native_user', JSON.stringify({ ...session.user, authToken: session.token }));
    if (!location.search.includes('no_channel=1')) localStorage.setItem('c5i_last_selected_channel_' + encodeURIComponent(session.user.id), JSON.stringify({ id: 'ptt-test-channel', name: 'GRUPO RADIO DE PRUEBAS' }));
    window.__microphoneCalls = 0;
    navigator.mediaDevices.getUserMedia = async () => { window.__microphoneCalls++; throw new Error('No debe capturarse antes de conectar'); };
  }, { backend, session });
  let connections = 0; let starts = 0;
  await context.route('**/api/ptt', async route => {
    const action = route.request().postDataJSON()?.action;
    if (action === 'start') starts++;
    if (action !== 'connect') { await route.continue(); return; }
    if (++connections === 1) await route.abort('failed');
    else await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Servicio de radio detenido en la prueba' }) });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.PTT_UI_URL || 'http://localhost:3000');
  await page.getByText(/Comprueba que ptt.php esté publicado/).waitFor();
  await page.waitForTimeout(1000);
  assert.equal(connections, 1, 'Un fallo de red no debe provocar reintentos en bucle ni otra petición de limpieza.');
  assert.equal(await page.getByText('Conectar radio', { exact: true }).count(), 0);
  const button = page.getByLabel('Mantén presionado para transmitir al grupo', { exact: true });
  assert.equal(await button.isEnabled(), true);
  const rect = await button.boundingBox(); assert.ok(rect);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.getByText('Servicio de radio detenido en la prueba', { exact: true }).waitFor();
  await page.mouse.up();
  await page.getByText('Mantén presionado para hablar', { exact: true }).waitFor();
  assert.equal(connections, 2, 'Mantener PTT debe reintentar una sola conexión.');
  assert.equal(starts, 0); assert.equal(await page.evaluate(() => window.__microphoneCalls), 0);
  assert.equal(await page.getByText(/Transmitiendo ·/).count(), 0);
  await page.evaluate(() => localStorage.removeItem('c5i_last_selected_channel_' + encodeURIComponent(JSON.parse(localStorage.getItem('c5i_native_user')).id)));
  await page.goto((process.env.PTT_UI_URL || 'http://localhost:3000') + '?no_channel=1');
  await page.getByText('Ningún grupo seleccionado', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Mantén presionado para transmitir al grupo', { exact: true }).isDisabled(), true);
  assert.equal(connections, 2, 'Sin grupo seleccionado no debe solicitarse conexión de radio.');
  assert.deepEqual(errors, []);
  console.log('OK PTT: error de red explica URL/OPTIONS, un solo intento automático, reintento desde PTT, 503 conserva su diagnóstico y ningún fallo captura micrófono ni anuncia transmisión.');
} finally { await browser.close(); }
