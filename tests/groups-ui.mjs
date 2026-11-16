import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const backend = process.env.GROUPS_TEST_BACKEND;
if (!backend || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(backend)) throw new Error('Usa backend local con fixture contacts_test_groups_.');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const setup = async phone => {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    // Todas las solicitudes de negocio de la prueba deben permanecer en la instancia local.
    await context.route('**/walkiet.alwaysdata.net/**', route => route.abort());
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(url => localStorage.setItem('c5i_native_server_url', url), backend);
    await page.goto(process.env.GROUPS_UI_URL || 'http://localhost:3000');
    await page.getByPlaceholder('Ingresa tu teléfono o correo', { exact: true }).fill(phone);
    await page.getByPlaceholder('Ingresa tu contraseña', { exact: true }).fill('group-password');
    await page.getByText('Iniciar Sesión', { exact: true }).click();
    await page.getByText('Grupos', { exact: true }).click();
    await page.getByText('Sin ningún grupo registrado', { exact: true }).waitFor();
    assert.equal(await page.getByText('General', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Todos', { exact: true }).count(), 0);
    assert.equal(await page.getByText(/Simular/).count(), 0);
    return page;
  };
  const a = await setup('7710000101');
  await a.getByLabel('Crear un nuevo canal táctico', { exact: true }).click();
  await a.getByLabel('Nombre del grupo', { exact: true }).fill('FF');
  await a.getByLabel('PIN del nuevo grupo', { exact: true }).fill('8183');
  // Un error de servidor conserva el formulario y no crea una ficha ficticia.
  const endpoint = '**/api/channels';
  await a.route(endpoint, async route => {
    if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'create') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Fallo de prueba al guardar grupo' }) });
    } else await route.continue();
  });
  await a.getByText('CREAR Y SINTONIZAR CANAL', { exact: true }).click();
  await a.getByText('Fallo de prueba al guardar grupo', { exact: true }).waitFor();
  assert.equal(await a.getByLabel('Nombre del grupo', { exact: true }).inputValue(), 'FF');
  assert.equal(await a.getByLabel('PIN del nuevo grupo', { exact: true }).inputValue(), '8183');
  await a.unroute(endpoint);
  await a.getByText('CREAR Y SINTONIZAR CANAL', { exact: true }).click();
  await a.getByText('COMENZAR A TRANSMITIR', { exact: true }).click();
  await a.getByText('Grupos', { exact: true }).click();
  await a.getByText('1 miembro', { exact: true }).waitFor();
  await a.getByLabel('Ver código QR y configuración del canal', { exact: true }).click();
  await a.getByText('Configuración del Canal', { exact: true }).waitFor();
  assert.equal(await a.getByText('Cerrar', { exact: true }).count(), 0);
  await a.waitForTimeout(350); // Esperar el fade del modal antes de inspección visual.
  await a.screenshot({ path: '/tmp/groups-config.png', fullPage: true });
  await a.getByLabel('Cerrar configuración del grupo', { exact: true }).click();
  const b = await setup('7710000102');
  await b.getByLabel('Unirse a un canal con PIN o QR', { exact: true }).click();
  await b.getByLabel('PIN para unirse al grupo', { exact: true }).fill('9999');
  await b.getByText('UNIRME AL CANAL', { exact: true }).click();
  await b.getByText('No existe un grupo con ese PIN.', { exact: true }).waitFor();
  await b.getByLabel('PIN para unirse al grupo', { exact: true }).fill('8183');
  await b.getByText('UNIRME AL CANAL', { exact: true }).click();
  await b.getByText('COMENZAR A TRANSMITIR', { exact: true }).click();
  await b.getByLabel('Ver usuarios dentro del canal', { exact: true }).click();
  await b.getByText('Prueba Grupo A', { exact: true }).waitFor();
  await b.getByText('Prueba Grupo B (Tú)', { exact: true }).waitFor();
  await b.getByLabel('Cerrar miembros del grupo', { exact: true }).click();
  await a.getByText('2 miembros', { exact: true }).waitFor();
  await b.getByText('Grupos', { exact: true }).click();
  await b.getByLabel('Ver código QR y configuración del canal', { exact: true }).click();
  assert.equal(await b.getByText('Eliminar Grupo', { exact: true }).count(), 0);
  await b.getByText('Salir del Grupo', { exact: true }).click();
  await b.getByText('ENTENDIDO', { exact: true }).click();
  await b.getByText('Sin ningún grupo registrado', { exact: true }).waitFor();
  await a.getByText('1 miembro', { exact: true }).waitFor();
  await b.reload(); await b.getByText('Grupos', { exact: true }).click();
  await b.getByText('Sin ningún grupo registrado', { exact: true }).waitFor();
  await b.screenshot({ path: '/tmp/groups-empty.png', fullPage: true });
  await b.getByLabel('Unirse a un canal con PIN o QR', { exact: true }).click();
  await b.getByText('Escanear Código QR del Canal', { exact: true }).click();
  await b.getByText('Escanear QR de Canal', { exact: true }).waitFor();
  assert.equal(await b.getByText(/Simular|CANALES DISPONIBLES EN EL ÁREA/).count(), 0);
  await b.getByText('Acceso a cámara requerido', { exact: true }).waitFor();
  await b.waitForTimeout(350);
  await b.screenshot({ path: '/tmp/groups-scanner.png', fullPage: true });
  await b.getByText('Volver a ingresar PIN', { exact: true }).click();
  await b.getByLabel('Cerrar ventana del grupo', { exact: true }).click();
  await a.reload();
  await a.getByLabel('Ver usuarios dentro del canal', { exact: true }).waitFor();
  await a.getByText('Grupos', { exact: true }).click();
  await a.getByText('1 miembro', { exact: true }).waitFor();
  // Adaptador de cámara/decodificador controlado; la unión y la BD siguen siendo reales.
  await b.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200;
    canvas.getContext('2d').fillRect(0, 0, 200, 200);
    const stream = canvas.captureStream(10); window.__groupTestStream = stream;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => stream });
    window.BarcodeDetector = class { async detect() { return [{ rawValue: '8183' }]; } };
  });
  await b.getByLabel('Unirse a un canal con PIN o QR', { exact: true }).click();
  await b.getByText('Escanear Código QR del Canal', { exact: true }).click();
  await b.getByText('COMENZAR A TRANSMITIR', { exact: true }).waitFor();
  assert.equal(await b.evaluate(() => window.__groupTestStream.getTracks().every(track => track.readyState === 'ended')), true);
  await b.getByText('COMENZAR A TRANSMITIR', { exact: true }).click();
  await a.getByText('2 miembros', { exact: true }).waitFor();
  await a.getByLabel('Ver código QR y configuración del canal', { exact: true }).click();
  await a.getByText('Eliminar Grupo', { exact: true }).click();
  await a.getByText('ENTENDIDO', { exact: true }).click();
  await a.getByText('Sin ningún grupo registrado', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('OK UI: cuenta vacía, creación persistida, errores sin éxito ficticio, sin categorías/simulación/Cerrar duplicado, miembros reales, salida, recarga y eliminación.');
} finally { await browser.close(); }
