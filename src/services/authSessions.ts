import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Pool, RowDataPacket } from 'mysql2/promise';

export function verifyAccountPassword(password: string, user: { password_hash?: string; salt?: string }) {
  const stored = user.password_hash || '';
  if (!password || !stored || stored === 'hash_demo') return false;
  if (/^\$2[aby]\$/.test(stored)) return bcrypt.compare(password, stored);
  if (stored.startsWith('$')) return false;
  const candidate = /^[a-f0-9]{128}$/i.test(stored)
    ? (user.salt ? createHash('sha512').update(password + user.salt).digest('hex') : '') : password;
  const left = Buffer.from(candidate); const right = Buffer.from(stored);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function issueAuthSession(pool: Pool, userId: string) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 19).replace('T', ' ');
  await pool.execute('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [createHash('sha256').update(token).digest('hex'), userId, expires]);
  return { token, expires_at: expires + ' UTC' };
}

export async function authenticateContactOwner(pool: Pool, authorization?: string) {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization || '');
  if (!match) return null;
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT s.user_id FROM auth_sessions s INNER JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1',
    [createHash('sha256').update(match[1]).digest('hex'), new Date().toISOString().slice(0, 19).replace('T', ' ')]);
  return rows[0] ? String(rows[0].user_id) : null;
}

export async function revokeAuthSession(pool: Pool, authorization?: string) {
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization || '');
  if (match) await pool.execute('DELETE FROM auth_sessions WHERE token_hash = ?', [createHash('sha256').update(match[1]).digest('hex')]);
}
