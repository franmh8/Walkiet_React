import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'mysql2/promise';
import { contactsDirectory } from '../src/services/contactsDirectory.ts';

// Doble del driver para comprobar SQL, transacción e identidad sin credenciales de producción.
function database() {
  const rows = new Map<string, any>();
  let snapshot: Map<string, any>;
  const statements: string[] = [];
  const pool: any = {
    query: async (sql: string) => { statements.push(sql); return [[...rows.values()]]; },
    execute: async (sql: string, args: any[]) => {
      statements.push(sql);
      if (sql.startsWith('SELECT')) return [[rows.get(args[0])].filter(Boolean)];
      if (sql.startsWith('DELETE')) return [{ affectedRows: Number(rows.delete(args[0])) }];
      const duplicate = [...rows.values()].some(c => c.phone_number === args[sql.startsWith('INSERT') ? 2 : 1] &&
        c.id !== args[sql.startsWith('INSERT') ? 0 : 5]);
      if (duplicate) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      if (sql.startsWith('INSERT')) {
        const [id, name, phone_number, callsign, correo, unit] = args;
        rows.set(id, { id, name, phone_number, callsign, correo, unit, status: 'offline' });
      } else {
        const [name, phone_number, callsign, correo, unit, id] = args;
        if (rows.has(id)) rows.set(id, { ...rows.get(id), name, phone_number, callsign, correo, unit });
      }
      return [{ affectedRows: 1 }];
    },
    getConnection: async () => pool,
    beginTransaction: async () => { snapshot = new Map(rows); },
    commit: async () => {},
    rollback: async () => { rows.clear(); snapshot.forEach((v, k) => rows.set(k, v)); },
    release: () => {},
  };
  return { pool: pool as Pool, statements };
}

test('Node usa contactos para CRUD, conserva ID y devuelve conflicto sin sobrescribir', async () => {
  const { pool, statements } = database();
  const input = { name: 'Prueba', phone_number: '7715551234', email: 'prueba@example.com' };
  const created = await contactsDirectory(pool, 'POST', input);
  assert.equal(created.status, 201);
  const id = created.body.contact!.id;
  assert.equal((await contactsDirectory(pool, 'POST', input)).status, 409);
  const updated = await contactsDirectory(pool, 'POST', { ...input, action: 'update', id, phone_number: '7715559999', email: '' });
  assert.equal(updated.body.contact!.callsign, 'RADIO-9999');
  assert.equal(updated.body.contact!.email, '');
  assert.equal((await contactsDirectory(pool, 'GET', {})).body.contacts!.length, 1);
  assert.equal((await contactsDirectory(pool, 'DELETE', {}, id)).body.id, id);
  assert.deepEqual((await contactsDirectory(pool, 'GET', {})).body.contacts, []);
  assert.equal((await contactsDirectory(pool, 'PUT', input, id)).status, 404);
  assert.ok(statements.every(sql => !sql.includes('users')));
});

test('Node propaga pérdida de BD y rechaza IDs y campos inválidos', async () => {
  const { pool } = database();
  assert.equal((await contactsDirectory(pool, 'POST', { action: 'delete' })).status, 422);
  assert.equal((await contactsDirectory(pool, 'POST', { name: ['bad'] })).status, 422);
  pool.query = async () => { throw new Error('database unavailable'); };
  await assert.rejects(contactsDirectory(pool, 'GET', {}), /database unavailable/);
});
