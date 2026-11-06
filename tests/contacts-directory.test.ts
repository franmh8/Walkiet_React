import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { contactsDirectory } from '../src/services/contactsDirectory.ts';
import { authenticateContactOwner, issueAuthSession, revokeAuthSession, verifyAccountPassword } from '../src/services/authSessions.ts';
import bcrypt from 'bcryptjs';

test('sin sesión el DAO no consulta la base', async () => {
  const pool = { execute: () => { throw new Error('Consulta anónima'); } } as unknown as mysql.Pool;
  assert.equal((await contactsDirectory(pool, 'GET', {})).status, 401);
});

test('verificación de contraseñas registradas y rechazo de bypass demo', async () => {
  for (const user of [{ password_hash: await bcrypt.hash('secret123', 4) },
    { password_hash: createHash('sha512').update('secret123salt').digest('hex'), salt: 'salt' }, { password_hash: 'secret123' }]) {
    assert.ok(await verifyAccountPassword('secret123', user));
    assert.equal(await verifyAccountPassword('incorrecta', user), false);
  }
  assert.equal(await verifyAccountPassword('', { password_hash: '' }), false);
  assert.equal(await verifyAccountPassword('hash_demo', { password_hash: 'hash_demo' }), false);
  assert.equal(await verifyAccountPassword('$unsupported$hash', { password_hash: '$unsupported$hash' }), false);
});

test('MariaDB real: aislamiento, sesiones, paginación e índices', { skip: !process.env.CONTACTS_TEST_SOCKET }, async t => {
  const pool = mysql.createPool({ socketPath: process.env.CONTACTS_TEST_SOCKET, user: 'root', database: 'contacts_test_node', connectionLimit: 3 });
  t.after(() => pool.end());
  await pool.execute('DELETE FROM auth_sessions'); await pool.execute('DELETE FROM contactos'); await pool.execute('DELETE FROM users');
  for (const [id, phone] of [['a', '7710000001'], ['b', '7710000002']]) {
    await pool.execute('INSERT INTO users (id, name, phone_number, password_hash, status) VALUES (?, ?, ?, ?, ?)', [id, id, phone, 'fixture', 'online']);
  }
  const a = await issueAuthSession(pool, 'a'); const b = await issueAuthSession(pool, 'b');
  assert.equal(await authenticateContactOwner(pool, `Bearer ${a.token}`), 'a');
  assert.equal(await authenticateContactOwner(pool, `Bearer ${'0'.repeat(64)}`), null);
  await pool.execute('UPDATE auth_sessions SET expires_at = ? WHERE user_id = ?', ['2000-01-01 00:00:00', 'b']);
  assert.equal(await authenticateContactOwner(pool, `Bearer ${b.token}`), null);
  await revokeAuthSession(pool, `Bearer ${a.token}`);
  assert.equal(await authenticateContactOwner(pool, `Bearer ${a.token}`), null);
  const before = (await pool.query('SELECT * FROM users ORDER BY id'))[0];
  const input = { name: 'Mi contacto', phone_number: '7710000002', email: '', owner_user_id: 'b' };
  const created = await contactsDirectory(pool, 'POST', input, undefined, 'a');
  assert.equal(created.status, 201); const id = created.body.contact!.id;
  assert.equal(created.body.contact!.registered_user_id, 'b');
  assert.equal((await contactsDirectory(pool, 'GET', {}, undefined, 'b', { owner_user_id: 'a' })).body.contacts!.length, 0);
  assert.equal((await contactsDirectory(pool, 'PUT', input, id, 'b')).status, 404);
  assert.equal((await contactsDirectory(pool, 'DELETE', {}, id, 'b')).status, 404);
  assert.equal((await contactsDirectory(pool, 'POST', input, undefined, 'a')).status, 409);
  assert.equal((await contactsDirectory(pool, 'POST', input, undefined, 'b')).status, 201);
  const edited = await contactsDirectory(pool, 'PUT', { ...input, name: 'Editado', phone_number: '7715559999', email: '' }, id, 'a');
  assert.equal(edited.body.contact!.callsign, 'RADIO-9999');
  assert.equal(edited.body.contact!.registered_user_id, null);
  const [ownerColumn] = await pool.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM contactos LIKE 'owner_user_id'");
  if (ownerColumn[0].Null === 'YES') await pool.execute('INSERT INTO contactos (id, name, phone_number) VALUES (?, ?, ?)', ['legacy', 'Sin dueño', '7715550000']);
  else await assert.rejects(pool.execute('INSERT INTO contactos (id, name, phone_number) VALUES (?, ?, ?)', ['legacy', 'Sin dueño', '7715550000']));
  assert.equal((await contactsDirectory(pool, 'GET', {}, undefined, 'a')).body.contacts!.length, 1);
  for (let i = 0; i < 105; i++) {
    const result = await contactsDirectory(pool, 'POST', { name: 'Mismo nombre', phone_number: '7718' + String(i).padStart(6, '0'), email: '' }, undefined, 'a');
    assert.equal(result.status, 201);
  }
  let cursor: string | null = null; const ids = new Set<string>(); let pages = 0;
  do {
    const response = await contactsDirectory(pool, 'GET', {}, undefined, 'a', { limit: '50', cursor });
    assert.equal(response.status, 200); assert.ok(response.body.contacts!.length <= 50);
    for (const contact of response.body.contacts!) { assert.ok(!ids.has(contact.id)); ids.add(contact.id); }
    cursor = response.body.next_cursor!; pages++;
  } while (cursor);
  assert.equal(ids.size, 106); assert.equal(pages, 3);
  const searched = await contactsDirectory(pool, 'GET', {}, undefined, 'a', { q: 'Edit' });
  assert.equal(searched.body.contacts!.length, 1);
  assert.equal((await contactsDirectory(pool, 'GET', {}, undefined, 'a', { q: '%' })).body.contacts!.length, 0);
  assert.equal((await contactsDirectory(pool, 'GET', {}, undefined, 'a', { limit: '10000' })).status, 422);
  assert.equal((await contactsDirectory(pool, 'GET', {}, undefined, 'a', { cursor: 'invalid' })).status, 422);
  const [plan] = await pool.query<mysql.RowDataPacket[]>('EXPLAIN SELECT id, name FROM contactos WHERE owner_user_id = ? ORDER BY name, id LIMIT 51', ['a']);
  assert.equal(plan[0].key, 'idx_contactos_owner_name');
  assert.equal((await contactsDirectory(pool, 'DELETE', {}, id, 'a')).status, 200);
  assert.deepEqual((await pool.query('SELECT * FROM users ORDER BY id'))[0], before);
});
