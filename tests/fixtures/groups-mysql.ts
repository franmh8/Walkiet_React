// Solo bases sintéticas locales; nunca lee conexion.php ni credenciales de producción.
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
const socketPath = process.env.CONTACTS_TEST_SOCKET;
if (!socketPath) throw new Error('Configura CONTACTS_TEST_SOCKET para MariaDB/MySQL local de pruebas.');
const db = await mysql.createConnection({ socketPath, user: 'root' });
try {
  for (const name of ['contacts_test_groups_php', 'contacts_test_groups_node']) {
    await db.query(`CREATE DATABASE IF NOT EXISTS ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await db.changeUser({ database: name });
    for (const table of ['users', 'auth_sessions', 'contactos']) await db.query(`CREATE TABLE IF NOT EXISTS ${table} LIKE contacts_test_php.${table}`);
    await db.query(`CREATE TABLE IF NOT EXISTS channels (
      id VARCHAR(64) PRIMARY KEY, name VARCHAR(100) NOT NULL, is_private TINYINT DEFAULT 0, access_code VARCHAR(255),
      created_by VARCHAR(64) NOT NULL, category ENUM('general','emergencia','tactico','vialidad','inteligencia') NOT NULL DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await db.query(`CREATE TABLE IF NOT EXISTS channel_members (
      id VARCHAR(64) PRIMARY KEY, channel_id VARCHAR(64) NOT NULL, user_id VARCHAR(64) NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uk_channel_user(channel_id,user_id), KEY idx_cm_user(user_id),
      FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    for (const table of ['channel_members', 'channels', 'auth_sessions', 'contactos', 'users']) await db.query(`DELETE FROM ${table}`);
    for (const [id, phone, label] of [['group-a', '7710000101', 'Prueba Grupo A'], ['group-b', '7710000102', 'Prueba Grupo B'], ['group-c', '7710000103', 'Prueba Grupo C']]) {
      await db.execute('INSERT INTO users (id, name, phone_number, password_hash, status) VALUES (?, ?, ?, ?, ?)', [id, label, phone, await bcrypt.hash('group-password', 4), 'online']);
    }
    console.log(`Listo: ${name}, 3 cuentas sintéticas sin grupos`);
  }
} finally { await db.end(); }
