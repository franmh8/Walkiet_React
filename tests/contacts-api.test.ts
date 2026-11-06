import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactsApi } from '../src/services/contactsApi.ts';

const input = { name: '  Contacto Prueba  ', phone_number: '(771) 555-1234', email: 'prueba@example.com' };
const contact = { ...input, id: 'cnt-test', name: 'Contacto Prueba', phone_number: '7715551234', registered_user_id: null };
const token = 'a'.repeat(64);
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const page = (contacts: unknown[]) => ({ success: true, contacts, has_more: false, next_cursor: null });

test('CRUD envía sesión, no dueño arbitrario, y pagina la agenda', async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const results = [reply({ success: true, contact }, 201), reply(page([contact])),
    reply({ success: true, contact: { ...contact, name: 'Editado', email: '' } }),
    reply({ success: true, id: contact.id }), reply(page([]))];
  const api = createContactsApi('https://walkiet.alwaysdata.net/', token, async (url, options) => {
    calls.push({ url: String(url), options }); return results.shift()!;
  });
  const saved = await api.create(input);
  assert.equal(saved.id, contact.id);
  assert.equal((await api.list()).contacts.length, 1);
  assert.equal((await api.update(saved.id, { ...input, name: 'Editado', email: '' })).email, '');
  await api.remove(saved.id);
  assert.deepEqual((await api.list()).contacts, []);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(c => new Headers(c.options?.headers).get('Authorization') === `Bearer ${token}`));
  assert.equal(JSON.parse(String(calls[0].options?.body)).phone_number, '7715551234');
  assert.ok(calls[1].url.includes('limit=50'));
  assert.equal(calls[3].options?.method, 'POST');
});

test('sin sesión no hace peticiones, y error PHP HTTP 200 no confirma escritura', async () => {
  await assert.rejects(createContactsApi('https://host', '', async () => { throw new Error('No debe llamar'); }).list(), /Inicia sesión/);
  for (const response of [new Response('<b>Parse error</b>', { status: 200 }), reply({ success: false, message: 'Error SQL' }),
    reply({ success: true }), reply({ success: true, contact: { id: 'incompleto' } }), reply({ success: true, contact }, 500)]) {
    await assert.rejects(createContactsApi('https://host/contacts.php', token, async () => response).create(input));
  }
});

test('página vacía válida, búsqueda y cursor viajan codificados, límite acotado', async () => {
  const api = createContactsApi('http://localhost:3000', token, async url => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, '/api/contacts');
    assert.equal(parsed.searchParams.get('q'), 'Nombre %');
    assert.equal(parsed.searchParams.get('limit'), '50');
    assert.equal(parsed.searchParams.get('cursor'), '{"name":"Álex","id":"1"}');
    return reply(page([]));
  });
  assert.deepEqual(await api.list('Nombre %', '{"name":"Álex","id":"1"}'), { contacts: [], hasMore: false, nextCursor: null });
});

test('falla de red no reintenta escrituras y respuesta 401 se muestra', async () => {
  let requests = 0;
  await assert.rejects(createContactsApi('https://host', token, async () => { requests++; throw new TypeError('Failed to fetch'); }).create(input), /No se pudo contactar/);
  assert.equal(requests, 1);
  await assert.rejects(createContactsApi('https://host', token, async () => reply({ success: false, message: 'Sesión vencida' }, 401)).list(), /Sesión vencida/);
});

test('campos inválidos no llegan al backend y baja confirma ID exacto', async () => {
  const api = createContactsApi('https://host', token, async () => reply({ success: true, id: 'otro' }));
  for (const invalid of [{ ...input, name: '' }, { ...input, phone_number: '' }, { ...input, email: 'incorrecto' }]) await assert.rejects(api.create(invalid));
  await assert.rejects(api.remove('cnt-test'), /no confirmó/);
});
