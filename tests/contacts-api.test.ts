import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactsApi } from '../src/services/contactsApi.ts';

const input = { name: '  Contacto Prueba  ', phone_number: '(771) 555-1234', email: 'prueba@example.com' };
const contact = { ...input, id: 'cnt-test', name: 'Contacto Prueba', phone_number: '7715551234' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test('CRUD usa la respuesta persistida y una sola petición por escritura', async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const results = [
    reply({ success: true, contact }, 201), reply({ success: true, contacts: [contact] }),
    reply({ success: true, contact: { ...contact, name: 'Editado', email: '' } }),
    reply({ success: true, id: contact.id }), reply({ success: true, contacts: [] }),
  ];
  const api = createContactsApi('https://walkiet.alwaysdata.net/', async (url, options) => {
    calls.push({ url: String(url), options }); return results.shift()!;
  });
  const saved = await api.create(input);
  assert.equal(saved.id, contact.id);
  assert.equal(saved.name, 'Contacto Prueba');
  assert.equal((await api.list()).length, 1);
  assert.equal((await api.update(saved.id, { ...input, name: 'Editado', email: '' })).email, '');
  await api.remove(saved.id);
  assert.deepEqual(await api.list(), []);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(c => c.url === 'https://walkiet.alwaysdata.net/contacts.php'));
  const payload = JSON.parse(String(calls[0].options?.body));
  assert.equal(payload.phone_number, '7715551234');
  assert.equal(payload.action, 'create');
  assert.equal(calls[3].options?.method, 'POST');
});

test('HTTP 200 con error PHP, success:false o respuesta inválida nunca confirma guardado', async () => {
  for (const response of [
    new Response('<br /><b>Parse error</b>: unexpected end of file', { status: 200 }),
    reply({ success: false, message: 'Error SQL' }),
    reply({ success: true }), reply({ success: true, contact: { id: 'incompleto' } }),
    reply({ success: true, contact }, 500),
  ]) {
    await assert.rejects(createContactsApi('https://host/contacts.php', async () => response).create(input));
  }
});

test('errores de BD y de red se propagan y no se reintenta una escritura automáticamente', async () => {
  let requests = 0;
  const api = createContactsApi('http://localhost:3000', async () => {
    requests++; throw new TypeError('Failed to fetch');
  });
  await assert.rejects(api.create(input), /No se pudo contactar/);
  assert.equal(requests, 1);
  await assert.rejects(createContactsApi('http://localhost:3000', async url => {
    assert.equal(url, 'http://localhost:3000/api/contacts');
    return reply({ success: false, message: 'Ya existe un contacto con ese teléfono.' }, 409);
  }).create(input), /Ya existe/);
});

test('validación evita datos incompletos y una lista vacía es válida', async () => {
  let requests = 0;
  const api = createContactsApi('https://walkiet.alwaysdata.net', async () => {
    requests++; return reply({ success: true, contacts: [] });
  });
  for (const invalid of [{ ...input, name: '' }, { ...input, phone_number: '' }, { ...input, email: 'incorrecto' }]) {
    await assert.rejects(api.create(invalid));
  }
  assert.equal(requests, 0);
  assert.deepEqual(await api.list(), []);
  await assert.rejects(createContactsApi('').list(), /Configura/);
});

test('eliminar exige confirmar el mismo ID', async () => {
  await assert.rejects(createContactsApi('https://host/contacts.php', async () =>
    reply({ success: true, id: 'otro-contacto' })).remove('cnt-test'), /no confirmó/);
});
