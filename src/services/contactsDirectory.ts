import { randomUUID } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { validateContact } from './contactsApi';

// Compartir la tabla del backend PHP; nunca sustituir un fallo de MySQL por un archivo local.
export async function contactsDirectory(pool: Pool, method: string, data: Record<string, any>, id?: string) {
  const row = (c: any) => ({
    id: c.id, name: c.name, phone_number: c.phone_number,
    callsign: c.callsign || `RADIO-${c.phone_number.slice(-4)}`,
    email: c.correo || '', unit: c.unit || '', status: c.status || 'offline', role: 'Oficial Operativo',
  });
  if (method === 'GET') {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM contactos ORDER BY name, id');
    return { status: 200, body: { success: true, contacts: rows.map(row), total: rows.length } };
  }
  const action = method === 'DELETE' ? 'delete' : method === 'PUT' ? 'update' : data.action || 'create';
  if (!['create', 'update', 'delete'].includes(action)) {
    return { status: 405, body: { success: false, message: 'Operación de contactos no soportada.' } };
  }
  const contactId = id || data.id;
  let old: RowDataPacket | undefined;
  if (action !== 'create') {
    if (typeof contactId !== 'string' || !contactId || contactId.length > 64) {
      return { status: 422, body: { success: false, message: 'Se requiere el ID del contacto.' } };
    }
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM contactos WHERE id = ?', [contactId]);
    old = rows[0];
    if (!old) return { status: 404, body: { success: false, message: 'El contacto ya no existe. Actualiza la lista.' } };
  }
  if (action === 'delete') {
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM contactos WHERE id = ?', [contactId]);
    return result.affectedRows === 1
      ? { status: 200, body: { success: true, id: contactId } }
      : { status: 404, body: { success: false, message: 'El contacto ya no existe.' } };
  }
  let input;
  try {
    for (const field of ['name', 'phone_number', 'email', 'correo', 'callsign', 'unit']) {
      if (data[field] != null && typeof data[field] !== 'string') throw new Error('Los campos del contacto deben ser texto.');
    }
    input = validateContact({
      name: data.name || '', phone_number: data.phone_number || '',
      email: data.email ?? data.correo ?? '', unit: data.unit ?? old?.unit ?? 'Sector Operativo Hidalgo C5i',
      callsign: (data.callsign ?? old?.callsign ?? '').trim().toUpperCase(),
    });
    if (!input.callsign || (old && old.phone_number !== input.phone_number)) input.callsign = `RADIO-${input.phone_number.slice(-4)}`;
  } catch (error) {
    return { status: 422, body: { success: false, message: error instanceof Error ? error.message : 'Datos inválidos.' } };
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const targetId = action === 'create' ? `cnt-${randomUUID()}` : contactId;
    if (action === 'create') {
      await connection.execute(
        "INSERT INTO contactos (id, name, phone_number, callsign, correo, unit, status) VALUES (?, ?, ?, ?, ?, ?, 'offline')",
        [targetId, input.name, input.phone_number, input.callsign, input.email || null, input.unit]);
    } else {
      await connection.execute('UPDATE contactos SET name = ?, phone_number = ?, callsign = ?, correo = ?, unit = ? WHERE id = ?',
        [input.name, input.phone_number, input.callsign, input.email || null, input.unit, targetId]);
    }
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT * FROM contactos WHERE id = ?', [targetId]);
    if (!rows[0]) throw new Error('Contact missing after write');
    await connection.commit();
    return { status: action === 'create' ? 201 : 200, body: { success: true, contact: row(rows[0]) } };
  } catch (error: any) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return { status: 409, body: { success: false, message: 'Ya existe un contacto con ese teléfono.' } };
    }
    throw error;
  } finally { connection.release(); }
}
