import { randomUUID } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { validateContact } from './contactsApi';

async function contactRows(pool: Pick<Pool, 'execute'>, rows: RowDataPacket[]) {
  if (!rows.length) return [];
  const phones = [...new Set(rows.map(c => c.phone_number))];
  const [accounts] = await pool.execute<RowDataPacket[]>(
    `SELECT id, phone_number, status FROM users WHERE phone_number IN (${phones.map(() => '?').join(',')})`, phones);
  const byPhone = new Map(accounts.map(account => [account.phone_number, account]));
  return rows.map(c => {
    const account = byPhone.get(c.phone_number);
    return { id: c.id, name: c.name, phone_number: c.phone_number,
      callsign: c.callsign || `RADIO-${c.phone_number.slice(-4)}`, email: c.correo || '', unit: c.unit || '',
      status: account && ['online', 'transmitting'].includes(account.status) ? 'online' : 'offline',
      registered_user_id: account ? String(account.id) : null, role: 'Contacto personal' };
  });
}

// ownerId proviene de una sesión validada, nunca del body/query del cliente.
export async function contactsDirectory(pool: Pool, method: string, data: Record<string, any>, id?: string, ownerId?: string | null, query: Record<string, any> = {}) {
  if (!ownerId) return { status: 401, body: { success: false, code: 'AUTH_REQUIRED', message: 'Inicia sesión de nuevo para consultar tu agenda privada.' } };
  const columns = 'c.id, c.name, c.phone_number, c.callsign, c.correo, c.unit';
  if (method === 'GET') {
    const limit = String(query.limit ?? '50');
    if (!/^\d{1,3}$/.test(limit) || +limit < 1 || +limit > 100 || (query.q != null && typeof query.q !== 'string') ||
        (query.q?.length || 0) > 120 || (query.cursor != null && typeof query.cursor !== 'string') || (query.cursor?.length || 0) > 2048) {
      return { status: 422, body: { success: false, message: 'Consulta inválida. Usa páginas de 1 a 100 contactos.' } };
    }
    let sql = `SELECT ${columns} FROM contactos c WHERE c.owner_user_id = ?`;
    const params: string[] = [ownerId];
    if (query.cursor) {
      let after;
      try { after = JSON.parse(query.cursor); } catch {}
      if (!after || typeof after.name !== 'string' || after.name.length > 120 || typeof after.id !== 'string' || after.id.length > 64) {
        return { status: 422, body: { success: false, message: 'Cursor de contactos inválido. Actualiza la agenda.' } };
      }
      sql += ' AND (c.name > ? OR (c.name = ? AND c.id > ?))'; params.push(after.name, after.name, after.id);
    }
    if (query.q?.trim()) {
      const pattern = query.q.trim().replace(/[!%_]/g, (value: string) => '!' + value) + '%';
      const queries = ['name', 'phone_number', 'correo', 'callsign'].map(field => {
        params.push(ownerId, pattern);
        return `SELECT id FROM contactos WHERE owner_user_id = ? AND ${field} LIKE ? ESCAPE '!'`;
      });
      sql += ` AND c.id IN (${queries.join(' UNION ')})`;
    }
    sql += ` ORDER BY c.name, c.id LIMIT ${+limit + 1}`;
    const [result] = await pool.execute<RowDataPacket[]>(sql, params);
    const more = result.length > +limit; const rows = more ? result.slice(0, +limit) : result;
    const last = rows[rows.length - 1];
    return { status: 200, body: { success: true, contacts: await contactRows(pool, rows), has_more: more,
      next_cursor: more && last ? JSON.stringify({ name: last.name, id: last.id }) : null } };
  }
  const action = method === 'DELETE' ? 'delete' : method === 'PUT' ? 'update' : data.action || 'create';
  if (!['create', 'update', 'delete'].includes(action)) return { status: 405, body: { success: false, message: 'Operación no soportada.' } };
  const contactId = id || data.id;
  let old: RowDataPacket | undefined;
  if (action !== 'create') {
    if (typeof contactId !== 'string' || !contactId || contactId.length > 64) return { status: 422, body: { success: false, message: 'Se requiere el ID del contacto.' } };
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${columns} FROM contactos c WHERE c.id = ? AND c.owner_user_id = ?`, [contactId, ownerId]);
    old = rows[0];
    if (!old) return { status: 404, body: { success: false, message: 'El contacto no existe en tu agenda. Actualiza la lista.' } };
  }
  if (action === 'delete') {
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM contactos WHERE id = ? AND owner_user_id = ?', [contactId, ownerId]);
    return result.affectedRows === 1 ? { status: 200, body: { success: true, id: contactId } }
      : { status: 404, body: { success: false, message: 'El contacto no existe en tu agenda.' } };
  }
  let input;
  try {
    for (const field of ['name', 'phone_number', 'email', 'correo', 'callsign', 'unit']) {
      if (data[field] != null && typeof data[field] !== 'string') throw new Error('Los campos del contacto deben ser texto.');
    }
    input = validateContact({ name: data.name || '', phone_number: data.phone_number || '', email: data.email ?? data.correo ?? '',
      unit: data.unit ?? old?.unit ?? 'Sector Operativo Hidalgo C5i', callsign: (data.callsign ?? old?.callsign ?? '').trim().toUpperCase() });
    if (!input.callsign || (old && old.phone_number !== input.phone_number)) input.callsign = `RADIO-${input.phone_number.slice(-4)}`;
  } catch (error) { return { status: 422, body: { success: false, message: error instanceof Error ? error.message : 'Datos inválidos.' } }; }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const targetId = action === 'create' ? `cnt-${randomUUID()}` : contactId;
    if (action === 'create') {
      await connection.execute('INSERT INTO contactos (id, owner_user_id, name, phone_number, callsign, correo, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [targetId, ownerId, input.name, input.phone_number, input.callsign, input.email || null, input.unit]);
    } else {
      await connection.execute('UPDATE contactos SET name = ?, phone_number = ?, callsign = ?, correo = ?, unit = ? WHERE id = ? AND owner_user_id = ?',
        [input.name, input.phone_number, input.callsign, input.email || null, input.unit, targetId, ownerId]);
    }
    const [rows] = await connection.execute<RowDataPacket[]>(`SELECT ${columns} FROM contactos c WHERE c.id = ? AND c.owner_user_id = ?`, [targetId, ownerId]);
    if (!rows[0]) throw new Error('Contact missing after write');
    const contact = (await contactRows(connection, rows))[0];
    await connection.commit();
    return { status: action === 'create' ? 201 : 200, body: { success: true, contact } };
  } catch (error: any) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') return { status: 409, body: { success: false, message: 'Ya guardaste un contacto con ese teléfono en tu agenda.' } };
    throw error;
  } finally { connection.release(); }
}
