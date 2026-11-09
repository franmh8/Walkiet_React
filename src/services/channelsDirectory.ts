import { randomBytes, randomInt } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export class ChannelsRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new ChannelsRequestError(status, message); };
async function channelRows(db: Pool | PoolConnection, owner: string, id?: string) {
  const [rows] = await db.execute<RowDataPacket[]>(`SELECT c.id, c.name, c.access_code, c.is_private, c.created_by,
    (SELECT COUNT(DISTINCT m.user_id) FROM channel_members m WHERE m.channel_id = c.id) AS member_count
    FROM channels c WHERE EXISTS (SELECT 1 FROM channel_members mine WHERE mine.channel_id = c.id AND mine.user_id = ?)
    ${id !== undefined ? 'AND c.id = ?' : ''} ORDER BY c.created_at DESC, c.id`, id !== undefined ? [owner, id] : [owner]);
  return rows.map(row => ({ id: String(row.id), name: row.name, pin: row.access_code, category: 'Táctico',
    is_private: Number(row.is_private), created_by: String(row.created_by), is_owner: String(row.created_by) === owner,
    member_count: Number(row.member_count) }));
}
export async function channelsDirectory(pool: Pool, method: string, data: Record<string, any>, query: Record<string, any>, owner: string | null) {
  if (!owner) return fail(401, 'Tu sesión venció. Inicia sesión de nuevo para consultar tus grupos.');
  const action = method === 'GET' ? (query.action || 'list') : (data.action || (method === 'DELETE' ? 'delete' : 'create'));
  let id = String(data.id || query.id || '');
  if (action === 'list' && method === 'GET') return { success: true, channels: await channelRows(pool, owner) };
  if (action === 'members' && method === 'GET') {
    const channels = await channelRows(pool, owner, id);
    if (!channels.length) return fail(404, 'No perteneces a este grupo.');
    const [members] = await pool.execute<RowDataPacket[]>('SELECT DISTINCT u.id, u.name, u.callsign, u.unit FROM channel_members m INNER JOIN users u ON u.id = m.user_id WHERE m.channel_id = ? ORDER BY u.name, u.id LIMIT 100', [id]);
    return { success: true, members, member_count: channels[0].member_count };
  }
  if (!['POST', 'DELETE'].includes(method) || !['create', 'join', 'leave', 'delete'].includes(action)) return fail(405, 'Operación de grupo no disponible.');
  const db = await pool.getConnection();
  let pinLock: string | null = null;
  try {
    await db.beginTransaction();
    const [account] = await db.execute<RowDataPacket[]>('SELECT id FROM users WHERE id=? FOR UPDATE', [owner]);
    if (!account.length) return fail(401, 'La cuenta ya no está disponible.');
    if (action === 'create') {
      const name = String(data.name || '').trim(); const requested = String(data.pin || '').trim();
      if (!name || [...name].length > 100) return fail(400, 'Ingresa un nombre de hasta 100 caracteres.');
      if (requested && !/^\d{4}$/.test(requested)) return fail(400, 'El PIN debe contener 4 dígitos.');
      let pin = '';
      for (let attempt = 0; attempt < 20; attempt++) {
        pin = requested || String(randomInt(1000, 10000));
        const lock = 'walkiet-channel-pin:' + pin;
        const [locks] = await db.execute<RowDataPacket[]>('SELECT GET_LOCK(?, 5) AS acquired', [lock]);
        if (Number(locks[0].acquired) !== 1) return fail(409, 'El PIN se está usando. Intenta de nuevo.');
        pinLock = lock;
        const [existing] = await db.execute<RowDataPacket[]>('SELECT id FROM channels WHERE access_code = ? LIMIT 1 FOR UPDATE', [pin]);
        if (!existing.length) break;
        await db.execute('SELECT RELEASE_LOCK(?)', [pinLock]); pinLock = null;
        if (requested) return fail(409, 'Ese PIN ya pertenece a otro grupo. Elige uno diferente.');
      }
      if (!pinLock) return fail(409, 'No se pudo generar un PIN disponible.');
      id = 'chan-' + randomBytes(16).toString('hex');
      await db.execute("INSERT INTO channels (id, name, is_private, access_code, category, created_by) VALUES (?, ?, 0, ?, 'tactico', ?)", [id, name, pin, owner]);
      await db.execute('INSERT INTO channel_members (id, channel_id, user_id) VALUES (?, ?, ?)', ['cm-' + randomBytes(16).toString('hex'), id, owner]);
    } else if (action === 'join') {
      const pin = String(data.pin || '').trim();
      if (!/^\d{4}$/.test(pin)) return fail(400, 'Ingresa un PIN válido de 4 dígitos.');
      const [matches] = await db.execute<RowDataPacket[]>('SELECT id FROM channels WHERE access_code = ?' + (id ? ' AND id = ?' : '') + ' ORDER BY id LIMIT 2 FOR UPDATE', id ? [pin, id] : [pin]);
      if (!matches.length) return fail(404, 'No existe un grupo con ese PIN.');
      if (matches.length !== 1) return fail(409, 'Hay varios grupos con ese PIN. Utiliza el QR del grupo.');
      id = String(matches[0].id);
      const [existing] = await db.execute<RowDataPacket[]>('SELECT id FROM channel_members WHERE channel_id = ? AND user_id = ? LIMIT 1', [id, owner]);
      if (!existing.length) await db.execute('INSERT INTO channel_members (id, channel_id, user_id) VALUES (?, ?, ?)', ['cm-' + randomBytes(16).toString('hex'), id, owner]);
    } else {
      const [rows] = await db.execute<RowDataPacket[]>('SELECT created_by FROM channels WHERE id = ? FOR UPDATE', [id]);
      if (!rows.length) return fail(404, 'El grupo ya no existe.');
      if (action === 'delete' && String(rows[0].created_by) !== owner) return fail(403, 'Solo el creador puede eliminar el grupo.');
      if (action === 'leave') await db.execute('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?', [id, owner]);
      else {
        await db.execute('DELETE FROM channel_members WHERE channel_id = ?', [id]);
        await db.execute('DELETE FROM channels WHERE id = ?', [id]);
      }
    }
    await db.commit();
    return ['create', 'join'].includes(action) ? { success: true, channel: (await channelRows(db, owner, id))[0] } : { success: true, id };
  } catch (error) { await db.rollback(); throw error; }
  finally {
    try { if (pinLock) await db.execute('SELECT RELEASE_LOCK(?)', [pinLock]); }
    finally { db.release(); }
  }
}
