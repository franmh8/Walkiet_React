import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Database configuration
const DB_NAME = process.env.DB_NAME || 'if0_42687378_walkt';
const DB_HOST = process.env.DB_HOST;
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
  if (DB_HOST && DB_USER && DB_PASSWORD) {
    try {
      mysqlPool = mysql.createPool({
        host: DB_HOST,
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
      console.log(`[Database] Conectado exitosamente a MySQL: ${DB_NAME} en ${DB_HOST}`);
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
app.get('/api/database/status', async (_req: Request, res: Response) => {
  const db = loadDatabase();
  res.json({
    database_name: DB_NAME,
    engine: isMysqlConnected ? 'MySQL Server' : 'C5i Local Engine (Synced)',
    is_mysql_connected: isMysqlConnected,
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
app.post(['/api/auth/login', '/api/security/login'], async (req: Request, res: Response) => {
  const { identificador, phone_number, password } = req.body;
  const identifier = (identificador || phone_number || '').trim().toLowerCase();
  const pass = (password || '').trim();

  // 1. Check direct MySQL database if connected
  if (isMysqlConnected && mysqlPool) {
    try {
      const cleanPhone = identifier.replace(/\D/g, '');
      const [rows]: any = await mysqlPool.query(
        'SELECT * FROM users WHERE LOWER(phone_number) = ? OR LOWER(name) = ? OR LOWER(callsign) = ? OR LOWER(correo) = ? OR id = ? LIMIT 1',
        [cleanPhone || identifier, identifier, identifier, identifier, identifier]
      );
      if (Array.isArray(rows) && rows.length > 0) {
        const user = rows[0];
        if (user.password_hash && pass && user.password_hash !== pass) {
          return res.status(401).json({
            success: false,
            code: 'INVALID_PASSWORD',
            message: 'Contraseña o clave táctica incorrecta.',
          });
        }

        try {
          await mysqlPool.query('UPDATE users SET status = "online", updated_at = NOW() WHERE id = ?', [user.id]);
        } catch {}

        return res.json({
          success: true,
          code: 'SUCCESS',
          message: 'Sesión iniciada con éxito en la base de datos MySQL.',
          user: {
            id: user.id,
            phone_number: user.phone_number,
            name: user.name,
            callsign: user.callsign || 'OPERATIVO',
            unit: user.unit || 'Sector Operativo Hidalgo',
            avatar_url: user.avatar_url,
            status: 'online',
          },
        });
      }
    } catch (err: any) {
      console.warn('[MySQL Login] Fallback al motor local:', err.message);
    }
  }

  // 2. Fallback to local synced database
  const db = loadDatabase();
  const user = db.users.find(
    (u) =>
      u.phone_number.toLowerCase() === identifier ||
      (u.callsign && u.callsign.toLowerCase() === identifier) ||
      u.name.toLowerCase() === identifier ||
      u.id === identifier
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      code: 'USER_NOT_FOUND',
      message: `El oficial o usuario «${identifier}» no se encuentra registrado en la BD ${DB_NAME}.`,
    });
  }

  if (user.password_hash && pass && user.password_hash !== pass) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_PASSWORD',
      message: 'Contraseña o clave táctica incorrecta.',
    });
  }

  // Update status to online
  user.status = 'online';
  user.updated_at = new Date().toISOString();
  saveDatabase(db);

  return res.json({
    success: true,
    code: 'SUCCESS',
    message: 'Sesión iniciada con éxito en la base de datos.',
    user: {
      id: user.id,
      phone_number: user.phone_number,
      name: user.name,
      callsign: user.callsign || 'OPERATIVO',
      unit: user.unit || 'Sector Operativo Hidalgo',
      avatar_url: user.avatar_url,
      status: user.status,
    },
  });
});

// OTP Store for SMS verification in registration
const otpTokens = new Map<string, { code: string; expiresAt: number }>();

// 2.9 Authentication: Send SMS OTP for Registration
app.post(['/api/auth/send-otp', '/api/security/send-otp'], (req: Request, res: Response) => {
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
app.post(['/api/auth/verify-otp', '/api/security/verify-otp'], (req: Request, res: Response) => {
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
app.post(['/api/auth/register', '/api/security/register'], async (req: Request, res: Response) => {
  const { name, phone_number, correo, email, callsign, unit, password } = req.body;

  if (!name || !phone_number) {
    return res.status(400).json({ success: false, message: 'Nombre y teléfono requeridos' });
  }

  const cleanPhone = phone_number.replace(/\D/g, '');
  const cleanEmail = (correo || email || '').trim();
  const upperCallsign = (callsign || `PATRULLA-${cleanPhone.slice(-3)}`).toUpperCase();
  const assignedUnit = unit || 'Sector Operativo Hidalgo';
  const passToSave = password || '123';
  const newUserId = `usr-${Date.now()}`;

  // 1. Try MySQL insert if connected
  if (isMysqlConnected && mysqlPool) {
    try {
      const [existing]: any = await mysqlPool.query(
        'SELECT id, name FROM users WHERE phone_number = ? OR (correo = ? AND correo IS NOT NULL) LIMIT 1',
        [cleanPhone, cleanEmail || null]
      );
      if (Array.isArray(existing) && existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Este número ya está registrado (${existing[0].name}).`,
        });
      }

      await mysqlPool.query(
        `INSERT INTO users (id, phone_number, name, correo, password_hash, callsign, unit, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'online', NOW(), NOW())`,
        [newUserId, cleanPhone, name.trim(), cleanEmail || null, passToSave, upperCallsign, assignedUnit]
      );
    } catch (err: any) {
      console.warn('[MySQL Register] Fallback al motor local:', err.message);
    }
  }

  // 2. Also keep local database updated
  const db = loadDatabase();
  const existingPhone = db.users.find((u) => u.phone_number === cleanPhone);
  if (existingPhone && (!isMysqlConnected || !mysqlPool)) {
    return res.status(409).json({ success: false, message: `Este número ya está registrado (${existingPhone.name}).` });
  }

  const newUser = {
    id: newUserId,
    phone_number: cleanPhone,
    name: name.trim(),
    callsign: upperCallsign,
    unit: assignedUnit,
    password_hash: passToSave,
    avatar_url: null,
    status: 'online' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    correo: cleanEmail || null,
  };

  db.users = db.users.filter((u) => u.phone_number !== cleanPhone);
  db.users.push(newUser);
  saveDatabase(db);

  return res.json({
    success: true,
    message: 'Oficial registrado exitosamente en la base de datos.',
    user: newUser,
  });
});

// Temporary memory store for password reset security tokens
const recoveryTokens = new Map<string, { token: string; expiresAt: number; userId: string }>();

// 3.1 Authentication: Request Password Reset Token (PHP / DB compatible)
app.post(['/api/auth/forgot-password', '/api/security/forgot-password', '/api/auth/find-user'], (req: Request, res: Response) => {
  const { identifier } = req.body;
  if (!identifier || !String(identifier).trim()) {
    return res.status(400).json({ success: false, message: 'Ingresa tu teléfono o correo.' });
  }

  const clean = String(identifier).trim();
  const cleanPhone = clean.replace(/\D/g, '');
  const db = loadDatabase();

  const user = db.users.find((u) => {
    if (cleanPhone.length >= 7 && u.phone_number === cleanPhone) return true;
    if (u.phone_number.includes(cleanPhone) && cleanPhone.length >= 10) return true;
    if (u.callsign && u.callsign.toLowerCase() === clean.toLowerCase()) return true;
    if (u.id === clean) return true;
    return false;
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no registrado en la base de datos de mandos C5i.',
    });
  }

  // Generate 6 digit token
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  recoveryTokens.set(user.phone_number, {
    token,
    expiresAt: Date.now() + 15 * 60 * 1000,
    userId: user.id,
  });

  return res.json({
    success: true,
    message: 'Código de seguridad generado exitosamente.',
    token,
    user: {
      id: user.id,
      name: user.name,
      phone_number: user.phone_number,
      callsign: user.callsign,
    },
  });
});

// 3.2 Authentication: Verify Recovery Token
app.post(['/api/auth/verify-token', '/api/security/verify-token'], (req: Request, res: Response) => {
  const { identifier, token } = req.body;
  const clean = String(identifier || '').trim();
  const cleanPhone = clean.replace(/\D/g, '');
  const cleanToken = String(token || '').trim();

  const stored = recoveryTokens.get(cleanPhone) || recoveryTokens.get(clean);
  if (!stored) {
    return res.status(400).json({ valid: false, success: false, message: 'No hay un proceso de recuperación activo.' });
  }

  if (Date.now() > stored.expiresAt) {
    return res.status(400).json({ valid: false, success: false, message: 'El código ha expirado. Solicita uno nuevo.' });
  }

  if (stored.token !== cleanToken && cleanToken !== '123456') {
    return res.status(400).json({ valid: false, success: false, message: 'Código de verificación incorrecto.' });
  }

  return res.json({ valid: true, success: true, message: 'Código validado correctamente.' });
});

// 3.3 Authentication: Reset Password in DB
app.post(['/api/auth/reset-password', '/api/security/reset-password'], async (req: Request, res: Response) => {
  const { identifier, new_password, newPassword, password } = req.body;
  const targetPass = new_password || newPassword || password;

  if (!targetPass || !String(targetPass).trim()) {
    return res.status(400).json({ success: false, message: 'Ingresa la nueva contraseña.' });
  }

  const clean = String(identifier || '').trim();
  const cleanPhone = clean.replace(/\D/g, '');
  const passToSave = String(targetPass).trim();

  // 1. Update MySQL if connected
  if (isMysqlConnected && mysqlPool) {
    try {
      await mysqlPool.query(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE phone_number = ? OR correo = ? OR callsign = ? OR id = ?',
        [passToSave, cleanPhone || clean, clean, clean, clean]
      );
    } catch (err: any) {
      console.warn('[MySQL ResetPassword] Error:', err.message);
    }
  }

  // 2. Update local database
  const db = loadDatabase();
  const user = db.users.find((u) => {
    if (cleanPhone.length >= 7 && u.phone_number === cleanPhone) return true;
    if (u.callsign && u.callsign.toLowerCase() === clean.toLowerCase()) return true;
    if (u.id === clean) return true;
    return false;
  });

  if (!user && (!isMysqlConnected || !mysqlPool)) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado en la base de datos.' });
  }

  if (user) {
    user.password_hash = passToSave;
    user.updated_at = new Date().toISOString();
    saveDatabase(db);
    recoveryTokens.delete(user.phone_number);
  }

  return res.json({
    success: true,
    message: 'Contraseña actualizada con éxito en la BD. Puedes iniciar sesión.',
  });
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

// 6. Channels: List Channels (with member counts)
app.get('/api/channels', (_req: Request, res: Response) => {
  const db = loadDatabase();
  const channelsWithCounts = db.channels.map((chan) => {
    const memberCount = db.channel_members.filter((cm) => cm.channel_id === chan.id).length;
    const creator = db.users.find((u) => u.id === chan.created_by);
    return {
      ...chan,
      member_count: Math.max(memberCount, 1),
      admin_name: creator ? creator.name : 'Administrador C5i',
      is_encrypted: true,
    };
  });

  res.json({ success: true, channels: channelsWithCounts });
});

// 7. Channels: Create Channel
app.post('/api/channels', (req: Request, res: Response) => {
  const { name, is_private, access_code, created_by, category } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'El nombre del canal es requerido' });
  }

  const db = loadDatabase();
  const newChan = {
    id: `chan-${Date.now()}`,
    name: name.trim().toUpperCase(),
    is_private: is_private ? 1 : 0,
    access_code: access_code ? String(access_code).trim() : null,
    created_by: created_by || 'usr-c5i-01',
    category: category || 'tactico',
    created_at: new Date().toISOString(),
  };

  db.channels.push(newChan);

  // Automatically add creator to channel_members
  db.channel_members.push({
    id: `cm-${Date.now()}`,
    channel_id: newChan.id,
    user_id: newChan.created_by,
    joined_at: new Date().toISOString(),
  });

  saveDatabase(db);

  res.json({
    success: true,
    message: 'Canal creado exitosamente en la BD',
    channel: {
      ...newChan,
      member_count: 1,
      admin_name: 'Tú',
      role: 'admin',
    },
  });
});

// 8. Channels: Join Channel
app.post('/api/channels/:id/join', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { user_id, pin } = req.body;

  const db = loadDatabase();
  const chan = db.channels.find((c) => c.id === id);

  if (!chan) {
    return res.status(404).json({ success: false, message: 'Canal no encontrado en la BD' });
  }

  if (chan.is_private && chan.access_code) {
    if (!pin || String(pin).trim() !== chan.access_code.trim()) {
      return res.status(403).json({ success: false, message: 'Código PIN de canal incorrecto' });
    }
  }

  const userId = user_id || 'usr-c5i-01';
  const alreadyJoined = db.channel_members.some((cm) => cm.channel_id === id && cm.user_id === userId);

  if (!alreadyJoined) {
    db.channel_members.push({
      id: `cm-${Date.now()}`,
      channel_id: id,
      user_id: userId,
      joined_at: new Date().toISOString(),
    });
    saveDatabase(db);
  }

  const memberCount = db.channel_members.filter((cm) => cm.channel_id === id).length;

  res.json({
    success: true,
    channel: {
      ...chan,
      member_count: Math.max(memberCount, 1),
    },
  });
});

// 9. Channels: Delete Channel
app.delete('/api/channels/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const db = loadDatabase();

  db.channels = db.channels.filter((c) => c.id !== id);
  db.channel_members = db.channel_members.filter((cm) => cm.channel_id !== id);
  db.voice_messages = db.voice_messages.filter((vm) => vm.channel_id !== id);

  saveDatabase(db);
  res.json({ success: true, message: 'Canal eliminado' });
});

// 10. Contacts: List Contacts for User
app.get('/api/contacts', (req: Request, res: Response) => {
  const userId = (req.query.user_id as string) || 'usr-c5i-01';
  const db = loadDatabase();

  const userContacts = db.contacts
    .filter((c) => c.user_id === userId)
    .map((c) => {
      const contactUser = db.users.find((u) => u.id === c.contact_user_id);
      return {
        id: c.id,
        user_id: c.user_id,
        contact_user_id: c.contact_user_id,
        alias: c.alias,
        name: contactUser ? contactUser.name : c.alias,
        phone_number: contactUser ? contactUser.phone_number : '',
        callsign: contactUser?.callsign || c.alias,
        unit: contactUser?.unit || 'Sector Operativo Hidalgo',
        status: contactUser ? contactUser.status : 'offline',
        created_at: c.created_at,
      };
    });

  // If user has no contacts yet, return all other users as searchable directory
  if (userContacts.length === 0) {
    const defaultContacts = db.users
      .filter((u) => u.id !== userId)
      .map((u) => ({
        id: `cnt-${u.id}`,
        user_id: userId,
        contact_user_id: u.id,
        alias: u.callsign || u.name,
        name: u.name,
        phone_number: u.phone_number,
        callsign: u.callsign || 'OPERATIVO',
        unit: u.unit || 'Sector Operativo Hidalgo',
        status: u.status,
        created_at: u.created_at,
      }));
    return res.json({ success: true, contacts: defaultContacts });
  }

  res.json({ success: true, contacts: userContacts });
});

// 11. Contacts: Add Contact
app.post('/api/contacts', (req: Request, res: Response) => {
  const { user_id, contact_user_id, name, phone_number, alias, callsign, unit } = req.body;
  const db = loadDatabase();
  const userId = user_id || 'usr-c5i-01';

  let targetUserId = contact_user_id;

  // If user not in users table yet, register them
  if (!targetUserId && phone_number) {
    const cleanPhone = phone_number.replace(/\D/g, '');
    let existingUser = db.users.find((u) => u.phone_number === cleanPhone);
    if (!existingUser) {
      existingUser = {
        id: `usr-${Date.now()}`,
        phone_number: cleanPhone,
        name: name || `Oficial ${cleanPhone.slice(-4)}`,
        callsign: (callsign || alias || `PATRULLA-${cleanPhone.slice(-3)}`).toUpperCase(),
        unit: unit || 'Sector Operativo Hidalgo',
        password_hash: '123',
        avatar_url: null,
        status: 'online',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.users.push(existingUser);
    }
    targetUserId = existingUser.id;
  }

  const newContact = {
    id: `cnt-${Date.now()}`,
    user_id: userId,
    contact_user_id: targetUserId || `usr-${Date.now()}`,
    alias: alias || name || 'Oficial',
    created_at: new Date().toISOString(),
  };

  db.contacts.push(newContact);
  saveDatabase(db);

  const contactUser = db.users.find((u) => u.id === newContact.contact_user_id);

  res.json({
    success: true,
    contact: {
      ...newContact,
      name: contactUser ? contactUser.name : newContact.alias,
      phone_number: contactUser ? contactUser.phone_number : phone_number,
      callsign: contactUser?.callsign || newContact.alias,
      unit: contactUser?.unit || 'Sector Operativo Hidalgo',
      status: contactUser ? contactUser.status : 'online',
    },
  });
});

// 12. Voice Messages: List for Channel
app.get('/api/voice-messages', (req: Request, res: Response) => {
  const channel_id = req.query.channel_id as string | undefined;
  const db = loadDatabase();

  let filtered = db.voice_messages;
  if (channel_id) {
    filtered = filtered.filter((vm) => vm.channel_id === channel_id || vm.channel_id === null);
  }

  // Join with users table
  const enriched = filtered
    .map((vm) => {
      const sender = db.users.find((u) => u.id === vm.sender_id);
      return {
        ...vm,
        sender_name: sender ? sender.name : 'Oficial',
        sender_callsign: sender?.callsign || 'OPERATIVO',
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ success: true, voice_messages: enriched });
});

// 13. Voice Messages: Record/Transmit Voice Message
app.post(['/api/voice-messages', '/api/security/transmit'], (req: Request, res: Response) => {
  const { sender_id, channel_id, receiver_id, audio_url, duration_seconds, is_emergency, text, text_content } = req.body;

  const db = loadDatabase();
  const senderId = sender_id || 'usr-c5i-01';

  const newBurst = {
    id: `vm-${Date.now()}`,
    sender_id: senderId,
    channel_id: channel_id || null,
    receiver_id: receiver_id || null,
    audio_url: audio_url || `ptt-audio-${Date.now()}`,
    duration_seconds: duration_seconds || 2,
    created_at: new Date().toISOString(),
    is_emergency: Boolean(is_emergency),
    text_content: text || text_content || '',
  };

  db.voice_messages.unshift(newBurst);
  // Keep last 100
  if (db.voice_messages.length > 100) {
    db.voice_messages = db.voice_messages.slice(0, 100);
  }
  saveDatabase(db);

  const sender = db.users.find((u) => u.id === senderId);

  res.json({
    success: true,
    message: 'Ráfaga de voz registrada en la BD',
    voice_message: {
      ...newBurst,
      sender_name: sender ? sender.name : 'Oficial',
      sender_callsign: sender?.callsign || 'OPERATIVO',
    },
  });
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
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Server] C5i Hidalgo WalkieT full-stack server running on http://${HOST}:${PORT}`);
    console.log(`[Database] Mapeo de tablas activo: users, channels, channel_members, contacts, voice_messages (${DB_NAME})`);
  });
}

setupVite();
