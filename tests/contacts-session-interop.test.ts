import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { authenticateContactOwner, issueAuthSession, revokeAuthSession } from '../src/services/authSessions.ts';
const backend = process.env.CONTACTS_TEST_BACKEND;
const enabled = !!process.env.CONTACTS_TEST_SOCKET && !!backend && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(backend);

test('sesiones interoperables PHP ↔ Node en una BD de pruebas', { skip: !enabled }, async t => {
  const pool = mysql.createPool({ socketPath: process.env.CONTACTS_TEST_SOCKET, user: 'root', database: 'contacts_test_php' });
  t.after(() => pool.end());
  const response = await fetch(backend + '/login.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: '7710000001', password: 'password-a' }) });
  const php = await response.json() as { token: string };
  assert.ok(php.token);
  assert.equal(await authenticateContactOwner(pool, `Bearer ${php.token}`), 'owner-a');
  const node = await issueAuthSession(pool, 'owner-a');
  assert.equal((await fetch(backend + '/contacts.php', { headers: { Authorization: `Bearer ${node.token}` } })).status, 200);
  await revokeAuthSession(pool, `Bearer ${node.token}`);
  assert.equal((await fetch(backend + '/contacts.php', { headers: { Authorization: `Bearer ${node.token}` } })).status, 401);
});
