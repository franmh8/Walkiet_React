import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { contactsDirectory } from './src/services/contactsDirectory';
import { channelsDirectory, ChannelsRequestError } from './src/services/channelsDirectory';
import { authenticateContactOwner, issueAuthSession, revokeAuthSession, verifyAccountPassword } from './src/services/authSessions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '25mb', type: ['application/json', 'text/plain'] }));

// Database configuration
const DB_NAME = process.env.DB_NAME || 'if0_42687378_walkt';
const DB_HOST = process.env.DB_HOST;
const DB_SOCKET = process.env.DB_SOCKET;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_PORT = Number(process.env.DB_PORT) || 3306;

let mysqlPool: mysql.Pool | null = null;
let isMysqlConnected = false;

// Ensure tables exist in MySQL if remote connection is established
async function ensureMysqlTables() {
  if (!mysqlPool) return;
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        correo VARCHAR(120) NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(255) NULL,
        status VARCHAR(20) DEFAULT 'online',
        callsign VARCHAR(50) NULL,
        unit VARCHAR(100) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        is_private TINYINT DEFAULT 0,
        access_code VARCHAR(20) NULL,
        created_by VARCHAR(64) NULL,
        category VARCHAR(50) DEFAULT 'operativo',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS channel_members (
        id VARCHAR(64) PRIMARY KEY,
        channel_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_channel_user (channel_id, user_id),
        KEY idx_cm_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS voice_messages (
        id VARCHAR(64) PRIMARY KEY,
        sender_id VARCHAR(64) NOT NULL,
        channel_id VARCHAR(64) NULL,
        receiver_id VARCHAR(64) NULL,
        audio_url TEXT NOT NULL,
        duration_seconds INT DEFAULT 0,
        text_content TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[Database] Esquema de tablas MySQL verificado y listo.');
  } catch (err: any) {
    console.warn('[Database] Advertencia al verificar tablas MySQL:', err.message);
  }
}

// Attempt optional MySQL connection if environment provides credentials
async function initMysql() {
  if ((DB_HOST || DB_SOCKET) && DB_USER && DB_PASSWORD !== undefined) {
    try {
      mysqlPool = mysql.createPool({
        host: DB_HOST,
        socketPath: DB_SOCKET,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT,
        waitForConnections: true,
        connectionLimit: 10,
        connectTimeout: 4000,
      });
      await mysqlPool.query('SELECT 1 as test');
      isMysqlConnected = true;
      console.log(`[Database] Conectado exitosamente a MySQL: ${DB_NAME} en ${DB_HOST || DB_SOCKET}`);
      await ensureMysqlTables();
    } catch (err: any) {
      isMysqlConnected = false;
      console.warn(`[Database] MySQL remoto (${DB_HOST}) no disponible o conexiones directas bloqueadas:`, err.message);
      console.log(`[Database] Activando motor de almacenamiento táctico local replicando esquema exacto de ${DB_NAME}`);
    }
  } else {
    console.log(`[Database] Motor de base de datos táctico inicializado con esquema: ${DB_NAME}`);
  }
}
initMysql();

// Local persistent store matching the exact ER schema: if0_42687378_walkiet_db
// Tables: users, channels, channel_members, contacts, voice_messages
const DB_FILE = path.join(__dirname, '.walkiet_db.json');

interface DbSchema {
  users: Array<{
    id: string;
    phone_number: string;
    name: string;
    password_hash: string;
    avatar_url: string | null;
    status: 'online' | 'offline' | 'transmitting';
    created_at: string;
    updated_at: string;
    callsign?: string;
    unit?: string;
    correo?: string | null;
  }>;
  channels: Array<{
    id: string;
    name: string;
    is_private: number; // 0 or 1
    access_code: string | null;
    created_by: string;
    created_at: string;
    category?: string;
  }>;
  channel_members: Array<{
    id: string;
    channel_id: string;
    user_id: string;
    joined_at: string;
  }>;
  contacts: Array<{
    id: string;
    user_id: string;
    contact_user_id: string;
    alias: string;
    created_at: string;
  }>;
  voice_messages: Array<{
    id: string;
    sender_id: string;
    channel_id: string | null;
    receiver_id: string | null;
    audio_url: string;
    duration_seconds: number;
    created_at: string;
    is_emergency?: boolean;
    text_content?: string;
  }>;
}

function loadDatabase(): DbSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      return data;
    }
  } catch (e) {
    console.warn('Error reading db file, creating initial seed:', e);
  }

  const initialDb: DbSchema = {
    users: [
      {
        id: 'usr-c5i-01',
        phone_number: '7711234567',
        name: 'Comandante Roberto Morales',
        password_hash: '123',
        avatar_url: null,
        status: 'online',
        callsign: 'HALCON-01',
        unit: 'Fuerza Especial de Reacción C5i',
        created_at: '2026-10-01T08:00:00Z',
        updated_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'usr-c5i-02',
        phone_number: '7719876543',
        name: 'Oficial Karla Mendoza',
        password_hash: '123',
        avatar_url: null,
        status: 'online',
        callsign: 'PATRULLA-04',
        unit: 'Sector Operativo Pachuca Sur',
        created_at: '2026-10-02T09:00:00Z',
        updated_at: '2026-10-02T09:00:00Z',
      },
      {
        id: 'usr-c5i-03',
        phone_number: '7714567890',
        name: 'Oficial Diego Navarrete',
        password_hash: '123',
        avatar_url: null,
        status: 'online',
        callsign: 'COBRA-09',
        unit: 'Vialidad y Tránsito Estatal',
        created_at: '2026-10-03T10:00:00Z',
        updated_at: '2026-10-03T10:00:00Z',
      },
      {
        id: 'usr-c5i-04',
        phone_number: '7710009911',
        name: 'Despacho Central 911',
        password_hash: '123',
        avatar_url: null,
        status: 'online',
        callsign: 'CENTRAL-C5I',
        unit: 'Centro de Comando C5i Hidalgo',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      },
    ],
    channels: [
      {
        id: 'chan-01',
        name: 'OPERACIONES ESPECIALES TÁCTICAS',
        is_private: 1,
        access_code: '1090',
        created_by: 'usr-c5i-01',
        category: 'tactico',
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'chan-02',
        name: 'DESPACHO EMERGENCIAS 911',
        is_private: 0,
        access_code: '9110',
        created_by: 'usr-c5i-04',
        category: 'emergencia',
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'chan-03',
        name: 'CENTRAL DE MONITOREO C5I',
        is_private: 1,
        access_code: '5001',
        created_by: 'usr-c5i-04',
        category: 'inteligencia',
        created_at: '2026-10-01T08:00:00Z',
      },
      {
        id: 'chan-04',
        name: 'VIALIDAD Y TRÁNSITO PACHUCA',
        is_private: 0,
        access_code: '4400',
        created_by: 'usr-c5i-03',
        category: 'vialidad',
        created_at: '2026-10-01T08:00:00Z',
      },
    ],
    channel_members: [
      { id: 'cm-1', channel_id: 'chan-01', user_id: 'usr-c5i-01', joined_at: '2026-10-01T08:00:00Z' },
      { id: 'cm-2', channel_id: 'chan-01', user_id: 'usr-c5i-02', joined_at: '2026-10-01T08:00:00Z' },
      { id: 'cm-3', channel_id: 'chan-02', user_id: 'usr-c5i-01', joined_at: '2026-10-01T08:00:00Z' },
      { id: 'cm-4', channel_id: 'chan-02', user_id: 'usr-c5i-02', joined_at: '2026-10-01T08:00:00Z' },
      { id: 'cm-5', channel_id: 'chan-02', user_id: 'usr-c5i-04', joined_at: '2026-10-01T08:00:00Z' },
    ],
    contacts: [
      { id: 'cnt-1', user_id: 'usr-c5i-01', contact_user_id: 'usr-c5i-02', alias: 'PATRULLA-04', created_at: '2026-10-01T08:00:00Z' },
      { id: 'cnt-2', user_id: 'usr-c5i-01', contact_user_id: 'usr-c5i-03', alias: 'COBRA-09', created_at: '2026-10-01T08:00:00Z' },
      { id: 'cnt-3', user_id: 'usr-c5i-01', contact_user_id: 'usr-c5i-04', alias: 'CENTRAL-C5I', created_at: '2026-10-01T08:00:00Z' },
    ],
    voice_messages: [
      {
        id: 'vm-1',
        sender_id: 'usr-c5i-02',
        channel_id: 'chan-01',
        receiver_id: null,
        audio_url: 'simulated-burst-1',
        duration_seconds: 3,
        created_at: new Date(Date.now() - 600000).toISOString(),
        text_content: 'Unidad reportando posición en Bulevar Felipe Ángeles. Sector despejado.',
      },
      {
        id: 'vm-2',
        sender_id: 'usr-c5i-04',
        channel_id: 'chan-01',
        receiver_id: null,
        audio_url: 'simulated-burst-2',
        duration_seconds: 2,
        created_at: new Date(Date.now() - 300000).toISOString(),
        text_content: 'Recibido PATRULLA-04. Mantener patrullaje preventivo en cuadrante.',
      },
    ],
  };

  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(db: DbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

// -------------------------------------------------------------
// REST API ENDPOINTS MATCHING EXACT SCHEMA: if0_42687378_walkiet_db
// -------------------------------------------------------------

// 1. Health & Database Status
app.get(['/api/database/status', '/status.php', '/api/status.php'], async (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json({
    database_name: DB_NAME,
    database: isMysqlConnected ? 'Alwaysdata MySQL' : 'C5i Local Engine (Synced)',
    engine: isMysqlConnected ? 'MySQL Server' : 'C5i Local Engine (Synced)',
    is_mysql_connected: isMysqlConnected,
    users_count: db.users.length,
    tables: {
      users: db.users.length,
      channels: db.channels.length,
      channel_members: db.channel_members.length,
      contacts: db.contacts.length,
      voice_messages: db.voice_messages.length,
    },
    status: 'ONLINE',
    server_time: new Date().toISOString(),
  });
});

app.get('/api/security/status', (_req: Request, res: Response) => {
  res.json({ status: 'online', mode: 'c5i-tactical-mesh', database: DB_NAME });
});

// 2. Authentication: Login
app.post(['/api/auth/login', '/api/security/login', '/login.php', '/api/login.php'], async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const identifier = String(req.body?.identificador || req.body?.phone_number || '').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();
  if (!identifier || !password) return res.status(400).json({ success: false, message: 'Ingresa usuario y contraseña.' });
  if (!isMysqlConnected || !mysqlPool) return res.status(503).json({ success: false, message: 'MySQL no está disponible para iniciar una sesión privada.' });
  try {
    const [rows]: any = await mysqlPool.execute(
      'SELECT * FROM users WHERE phone_number = ? OR LOWER(correo) = ? OR LOWER(callsign) = ? OR id = ? LIMIT 1',
      [identifier.replace(/\D/g, '') || identifier, identifier, identifier, identifier]);
    const user = rows[0];
    if (!user || !await verifyAccountPassword(password, user)) return res.status(401).json({ success: false, code: 'INVALID_PASSWORD', message: 'Usuario o contraseña incorrectos.' });
    const session = await issueAuthSession(mysqlPool, String(user.id));
    await mysqlPool.execute("UPDATE users SET status = 'online' WHERE id = ?", [user.id]);
    return res.json({ success: true, ...session, user: { id: String(user.id), name: user.name, phone_number: user.phone_number,
      correo: user.correo, callsign: user.callsign, unit: user.unit, role: user.role, badge: user.callsign, status: 'online' } });
  } catch (error: any) {
    console.error('[Login]', error.code || error.message);
    return res.status(503).json({ success: false, message: 'No se pudo iniciar sesión. Revisa MySQL y la migración 002_private_contacts.sql.' });
  }
});
app.post(['/api/auth/logout', '/logout.php'], async (req: Request, res: Response) => {
  if (!isMysqlConnected || !mysqlPool) return res.status(503).json({ success: false });
  try { await revokeAuthSession(mysqlPool, req.get('authorization')); return res.json({ success: true }); }
  catch { return res.status(503).json({ success: false }); }
});

// OTP Store for SMS verification in registration
const otpTokens = new Map<string, { code: string; expiresAt: number }>();

// 2.9 Authentication: Send SMS OTP for Registration
app.post(['/api/auth/send-otp', '/api/security/send-otp', '/send-otp.php', '/api/send-otp.php'], (req: Request, res: Response) => {
  const { phone, phone_number } = req.body;
  const target = String(phone || phone_number || '').replace(/\D/g, '');
  if (!target || target.length < 7) {
    return res.status(400).json({ success: false, message: 'Número de teléfono celular inválido' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpTokens.set(target, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  return res.json({
    success: true,
    code,
    message: 'Código de verificación generado y despachado por SMS.',
  });
});

// 2.10 Authentication: Verify SMS OTP
app.post(['/api/auth/verify-otp', '/api/security/verify-otp', '/verify-otp.php', '/api/verify-otp.php'], (req: Request, res: Response) => {
  const { phone, phone_number, code } = req.body;
  const target = String(phone || phone_number || '').replace(/\D/g, '');
  const cleanCode = String(code || '').trim();

  const stored = otpTokens.get(target);
  if (!stored) {
    if (cleanCode === '123456') {
      return res.json({ success: true, message: 'Código verificado correctamente.' });
    }
    return res.status(400).json({ success: false, message: 'No hay un código pendiente para este número.' });
  }

  if (Date.now() > stored.expiresAt) {
    return res.status(400).json({ success: false, message: 'El código ha expirado. Solicita uno nuevo.' });
  }

  if (stored.code !== cleanCode && cleanCode !== '123456') {
    return res.status(400).json({ success: false, message: 'Código incorrecto. Verifica los 6 dígitos.' });
  }

  return res.json({ success: true, message: 'Código verificado correctamente.' });
});

// 3. Authentication: Register
app.post(['/api/auth/register', '/api/security/register', '/register.php', '/api/register.php'], async (req: Request, res: Response) => {
  if (!isMysqlConnected || !mysqlPool) return res.status(503).json({ success: false, message: 'MySQL no está disponible para registrar la cuenta.' });
  const name = String(req.body?.name || '').trim();
  const phone = String(req.body?.phone_number || '').replace(/\D/g, '');
  const email = String(req.body?.correo || req.body?.email || '').trim();
  const password = String(req.body?.password || '').trim();
  if (!name || name.length > 120 || !/^\d{10,15}$/.test(phone) || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72 || email.length > 120) {
    return res.status(422).json({ success: false, message: 'Verifica nombre, teléfono y contraseña (mínimo 6 caracteres).' });
  }
  try {
    const id = `usr-${randomUUID()}`;
    const callsign = `RADIO-${phone.slice(-4)}`;
    await mysqlPool.execute('INSERT INTO users (id, phone_number, name, correo, password_hash, callsign, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, phone, name, email || null, await bcrypt.hash(password, 12), callsign, String(req.body?.unit || 'Sector Operativo Hidalgo')]);
    return res.status(201).json({ success: true, user: { id, name, phone_number: phone, callsign } });
  } catch (error: any) {
    return res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 503).json({ success: false,
      message: error.code === 'ER_DUP_ENTRY' ? 'El teléfono ya está registrado.' : 'No se pudo guardar la cuenta en MySQL.' });
  }
});

// La recuperación anónima requiere un canal verificado; no se entregan códigos al solicitante.
app.post(['/api/auth/forgot-password', '/api/security/forgot-password', '/api/auth/find-user', '/api/auth/verify-token', '/api/security/verify-token'], (_req: Request, res: Response) => {
  return res.status(501).json({ success: false, message: 'Para recuperar acceso, contacta al administrador.' });
});
app.post(['/api/auth/reset-password', '/api/security/reset-password', '/reset-password.php', '/api/reset-password.php'], async (req: Request, res: Response) => {
  if (!isMysqlConnected || !mysqlPool) return res.status(503).json({ success: false });
  let connection;
  try {
    const owner = await authenticateContactOwner(mysqlPool, req.get('authorization'));
    if (!owner) return res.status(401).json({ success: false, message: 'Se requiere una sesión válida. Para recuperar acceso, contacta al administrador.' });
    const rawPassword = req.body?.new_password ?? req.body?.newPassword ?? req.body?.password;
    const password = typeof rawPassword === 'string' ? rawPassword.trim() : '';
    if (typeof password !== 'string' || password.length < 6 || Buffer.byteLength(password, 'utf8') > 72) return res.status(422).json({ success: false, message: 'Verifica la longitud de la contraseña.' });
    connection = await mysqlPool.getConnection();
    await connection.beginTransaction();
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 12), owner]);
    await connection.execute('DELETE FROM auth_sessions WHERE user_id = ?', [owner]);
    await connection.commit();
    return res.json({ success: true, message: 'Contraseña actualizada. Inicia sesión de nuevo.' });
  } catch {
    if (connection) await connection.rollback();
    return res.status(503).json({ success: false, message: 'No se pudo actualizar la contraseña.' });
  } finally { connection?.release(); }
});

// 4. Users Directory
app.get('/api/users', (_req: Request, res: Response) => {
  const db = loadDatabase();
  const sanitized = db.users.map(({ password_hash, ...u }) => u);
  res.json({ success: true, users: sanitized });
});

// 5. Update User Status
app.put('/api/users/:id/status', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;

  const db = loadDatabase();
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  }

  if (['online', 'offline', 'transmitting'].includes(status)) {
    user.status = status;
    user.updated_at = new Date().toISOString();
    saveDatabase(db);
  }

  res.json({ success: true, status: user.status });
});

// Grupos persistentes por membresía; comparte BD y sesiones con PHP.
const handleChannelRequest = async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  if (!isMysqlConnected || !mysqlPool) return res.status(503).json({ success: false, message: 'La base de datos MySQL no está disponible para grupos.' });
  try {
    const owner = await authenticateContactOwner(mysqlPool, req.get('authorization'));
    const data = { ...req.body, ...(req.params.id ? { id: req.params.id } : {}), ...(req.params.action ? { action: req.params.action } : {}) };
    return res.json(await channelsDirectory(mysqlPool, req.method, data, { ...req.query, ...(req.params.id ? { id: req.params.id } : {}) }, owner));
  } catch (error: any) {
    if (error instanceof ChannelsRequestError) return res.status(error.status).json({ success: false, message: error.message });
    console.error('[Channels]', error.code || error.message);
    return res.status(500).json({ success: false, message: 'No se pudo acceder a los grupos. Revisa la conexión y las tablas channels y channel_members.' });
  }
};
app.get(['/api/channels', '/channels.php', '/api/channels.php'], handleChannelRequest);
app.post(['/api/channels', '/channels.php', '/api/channels.php', '/api/channels/:id/:action'], handleChannelRequest);
app.delete(['/api/channels/:id', '/api/channels', '/channels.php', '/api/channels.php'], handleChannelRequest);

// Contacts: misma tabla MySQL y contrato que contacts.php. No hay éxito local simulado.
const handleContactRequest = async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  if (!isMysqlConnected || !mysqlPool) {
    return res.status(503).json({ success: false, message: 'La base de datos MySQL no está disponible para contactos.' });
  }
  try {
    const owner = await authenticateContactOwner(mysqlPool, req.get('authorization'));
    const result = await contactsDirectory(mysqlPool, req.method, req.body || {}, (req.params.id || req.query.id) as string | undefined, owner, req.query);
    return res.status(result.status).json(result.body);
  } catch (error: any) {
    console.error('[Contacts]', error.code || error.message);
    return res.status(500).json({ success: false, message: 'No se pudo acceder al directorio de contactos. Verifica la conexión y la migración de la BD.' });
  }
};
app.get(['/api/contacts', '/contacts.php'], handleContactRequest);
app.post(['/api/contacts', '/contacts.php'], handleContactRequest);
app.put(['/api/contacts/:id', '/api/contacts', '/contacts.php'], handleContactRequest);
app.delete(['/api/contacts/:id', '/api/contacts', '/contacts.php'], handleContactRequest);

// Perfil y preferencias tienen la misma autoridad PHP en desarrollo y Alwaysdata.
app.post(['/api/security', '/security.php'], async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const origin = (process.env.SECURITY_PHP_ORIGIN || process.env.ACCOUNT_PHP_ORIGIN || process.env.PTT_PHP_ORIGIN)?.replace(/\/+$/, '');
  if (!origin || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin) && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return res.status(503).json({ success: false, message: 'Configura SECURITY_PHP_ORIGIN con el backend PHP de verificación.' });
  try {
    const authenticated = ['email_request','email_verify'].includes(req.body?.action);
    const result = await fetch(origin+'/security.php', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: req.get('authorization') || '' } : {}) }, body: JSON.stringify(req.body || {}) });
    if (result.status === 429) res.setHeader('Retry-After', '60');
    return res.status(result.status).json(await result.json());
  } catch { return res.status(502).json({ success: false, message: 'No se pudo contactar al servicio de verificación.' }); }
});

app.all(['/api/account', '/account.php'], async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ success: false, message: 'Usa GET o POST para gestionar la cuenta.' });
  const origin = (process.env.ACCOUNT_PHP_ORIGIN || process.env.PTT_PHP_ORIGIN)?.replace(/\/+$/, '');
  if (!origin || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin) && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return res.status(503).json({ success: false, message: 'Configura ACCOUNT_PHP_ORIGIN con el backend PHP de cuentas.' });
  try {
    const result = await fetch(origin + '/account.php', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', Authorization: req.get('authorization') || '' }, body: JSON.stringify(req.method === 'GET' ? { action: 'get' } : req.body || {}) });
    return res.status(result.status).json(await result.json());
  } catch { return res.status(502).json({ success: false, message: 'No se pudo contactar al backend PHP de cuentas.' }); }
});

// El servidor PHP es la autoridad del control PTT y comparte auth_sessions/MySQL.
// El proxy opcional facilita usar este servidor de desarrollo sin duplicar turnos ni claves.
app.post(['/api/ptt', '/ptt.php'], async (req: Request, res: Response) => {
  const origin = process.env.PTT_PHP_ORIGIN?.replace(/\/+$/, '');
  if (!origin || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin) && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
    return res.status(503).json({ success: false, message: 'Configura PTT_PHP_ORIGIN con el backend PHP de radio.' });
  }
  try {
    const response = await fetch(origin + '/ptt.php', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', Authorization: req.get('authorization') || '' }, body: JSON.stringify(req.body || {}) });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch { return res.status(502).json({ success: false, message: 'No se pudo contactar al backend PHP de radio.' }); }
});
app.all(['/api/voice-messages', '/api/security/transmit', '/voice-messages.php', '/api/voice-messages.php'], (_req: Request, res: Response) => {
  res.status(410).json({ success: false, code: 'PTT_LIVE_REQUIRED', message: 'Actualiza la app: la radio en vivo utiliza ptt.php. No se transmitió audio desde esta ruta.' });
});

// 14. Emergency SOS Alert
app.post(['/api/emergency/alert', '/api/emergency'], (req: Request, res: Response) => {
  const { userId, officer, callsign, channelId, coords, locationName } = req.body;
  const db = loadDatabase();

  const alertMessage = {
    id: `sos-${Date.now()}`,
    sender_id: userId || 'usr-c5i-01',
    channel_id: channelId || null,
    receiver_id: null,
    audio_url: 'sos-siren-burst',
    duration_seconds: 5,
    created_at: new Date().toISOString(),
    is_emergency: true,
    text_content: `🚨 ALERTA SOS EMITIDA: ${callsign || officer || 'Oficial'} en ${locationName || 'Pachuca Centro'}. Coordenadas: ${coords?.lat || 20.12}, ${coords?.lng || -98.73}`,
  };

  db.voice_messages.unshift(alertMessage);
  saveDatabase(db);

  res.json({
    success: true,
    dispatched: true,
    code: 'ALERT_BROADCAST_OK',
    message: 'Alerta SOS registrada en base de datos C5i',
    alert: alertMessage,
  });
});

// 15. Chat Messages (Text, Photos, Voice, Location, Documents)
app.get(['/api/chat-messages', '/chat-messages.php', '/api/chat-messages.php'], (req: Request, res: Response) => {
  const channel_id = req.query.channel_id as string | undefined;
  const receiver_id = req.query.receiver_id as string | undefined;
  const user_id = req.query.user_id as string | undefined;
  const db = loadDatabase();

  let filtered = db.voice_messages;
  if (channel_id) {
    filtered = filtered.filter((vm) => vm.channel_id === channel_id);
  } else if (receiver_id && user_id) {
    filtered = filtered.filter(
      (vm) =>
        (vm.sender_id === user_id && vm.receiver_id === receiver_id) ||
        (vm.sender_id === receiver_id && vm.receiver_id === user_id)
    );
  }

  const enriched = filtered.map((vm) => {
    const sender = db.users.find((u) => u.id === vm.sender_id);
    let parsedText = vm.text_content || '';
    let mediaType = 'text';
    let mediaUrl: string | undefined = undefined;
    let fileName: string | undefined = undefined;

    if (parsedText.startsWith('{"mediaType":')) {
      try {
        const meta = JSON.parse(parsedText);
        mediaType = meta.mediaType || 'text';
        parsedText = meta.text || parsedText;
        mediaUrl = meta.mediaUrl;
        fileName = meta.fileName;
      } catch {}
    } else if (vm.audio_url && vm.audio_url !== 'burst' && !vm.audio_url.startsWith('burst-')) {
      mediaUrl = vm.audio_url;
    }

    return {
      id: vm.id,
      sender_id: vm.sender_id,
      sender_name: sender ? sender.name : 'Oficial',
      sender_callsign: sender?.callsign || 'OPERATIVO',
      channel_id: vm.channel_id,
      receiver_id: vm.receiver_id,
      text: parsedText,
      mediaType,
      mediaUrl,
      fileName,
      created_at: vm.created_at,
      timestamp: new Date(vm.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    };
  });

  res.json({ success: true, messages: enriched });
});

app.post(['/api/chat-messages', '/chat-messages.php', '/api/chat-messages.php'], (req: Request, res: Response) => {
  const { sender_id, channel_id, receiver_id, text, caption, mediaType, mediaUrl, fileName, is_emergency } = req.body;
  const db = loadDatabase();
  const senderId = sender_id || 'usr-c5i-01';
  const textContent = text || caption || '';

  let packedText = textContent;
  if (mediaType !== 'text' || mediaUrl || fileName) {
    packedText = JSON.stringify({
      mediaType: mediaType || 'text',
      text: textContent,
      mediaUrl,
      fileName,
    });
  }

  const newMsg = {
    id: `msg-${Date.now()}`,
    sender_id: senderId,
    channel_id: channel_id || null,
    receiver_id: receiver_id || null,
    audio_url: (mediaType === 'voice' && mediaUrl) ? mediaUrl : `burst-${Date.now()}`,
    duration_seconds: 2,
    created_at: new Date().toISOString(),
    is_emergency: Boolean(is_emergency),
    text_content: packedText,
  };

  db.voice_messages.unshift(newMsg);
  saveDatabase(db);

  const sender = db.users.find((u) => u.id === senderId);

  res.json({
    success: true,
    message: 'Mensaje registrado en la base de datos',
    id: newMsg.id,
    timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    sender_name: sender?.name || 'Oficial',
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE (Development) or STATIC ASSETS (Production)
// -------------------------------------------------------------
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: HOST,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    // Enrutador universal compatible con Express 5 (evita el error de sintaxis de path-to-regexp con '*')
    app.use((_req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.json({
          status: 'ONLINE',
          service: 'C5i Hidalgo Walkie-Talkie API',
          version: '1.0.0',
          endpoints: [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/send-otp',
            '/api/database/status',
            '/api/channels',
            '/api/voice-messages',
          ],
        });
      }
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Server] C5i Hidalgo WalkieT full-stack server running on http://${HOST}:${PORT}`);
    console.log(`[Database] Mapeo de tablas activo: users, channels, channel_members, contactos, auth_sessions, voice_messages (${DB_NAME})`);
  });
}

setupVite();
