-- Agendas privadas. Seleccionar la misma BD de conexion.php antes de ejecutar.
-- Conserva las filas antiguas con owner_user_id NULL hasta asignarlas explícitamente.
-- No importa users ni cambia datos de cuentas. Puede repetirse.
CREATE TABLE IF NOT EXISTS contactos (
 id VARCHAR(64) NOT NULL PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 phone_number VARCHAR(20) NOT NULL,
 callsign VARCHAR(50) DEFAULT NULL,
 correo VARCHAR(120) DEFAULT NULL,
 unit VARCHAR(100) DEFAULT 'Sector Operativo Hidalgo C5i',
 status VARCHAR(20) DEFAULT 'offline',
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reutilizar exactamente el tipo y la collation de users.id para evitar el error 1267
-- y permitir la clave foránea aunque users tenga una collation heredada diferente.
SET @user_id_definition = (
 SELECT CONCAT(COLUMN_TYPE,
  IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME)))
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
);
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contactos' AND COLUMN_NAME='owner_user_id'),
 'SELECT 1', CONCAT('ALTER TABLE contactos ADD COLUMN owner_user_id ', @user_id_definition, ' NULL'));
PREPARE private_contacts_stmt FROM @ddl; EXECUTE private_contacts_stmt; DEALLOCATE PREPARE private_contacts_stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contactos' AND INDEX_NAME='idx_contactos_phone'),
 'ALTER TABLE contactos DROP INDEX idx_contactos_phone', 'SELECT 1');
PREPARE private_contacts_stmt FROM @ddl; EXECUTE private_contacts_stmt; DEALLOCATE PREPARE private_contacts_stmt;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contactos' AND INDEX_NAME='uq_contactos_owner_phone'),
 'SELECT 1', 'ALTER TABLE contactos ADD UNIQUE KEY uq_contactos_owner_phone (owner_user_id, phone_number)');
PREPARE private_contacts_stmt FROM @ddl; EXECUTE private_contacts_stmt; DEALLOCATE PREPARE private_contacts_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contactos' AND INDEX_NAME='idx_contactos_owner_name'),
 'SELECT 1', 'ALTER TABLE contactos ADD KEY idx_contactos_owner_name (owner_user_id, name, id)');
PREPARE private_contacts_stmt FROM @ddl; EXECUTE private_contacts_stmt; DEALLOCATE PREPARE private_contacts_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contactos' AND INDEX_NAME='idx_contactos_owner_email'),
 'SELECT 1', 'ALTER TABLE contactos ADD KEY idx_contactos_owner_email (owner_user_id, correo)');
PREPARE private_contacts_stmt FROM @ddl; EXECUTE private_contacts_stmt; DEALLOCATE PREPARE private_contacts_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contactos' AND INDEX_NAME='idx_contactos_owner_callsign'),
 'SELECT 1', 'ALTER TABLE contactos ADD KEY idx_contactos_owner_callsign (owner_user_id, callsign)');
PREPARE private_contacts_stmt FROM @ddl; EXECUTE private_contacts_stmt; DEALLOCATE PREPARE private_contacts_stmt;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='contactos' AND CONSTRAINT_NAME='fk_contactos_owner'),
 'SELECT 1', 'ALTER TABLE contactos ADD CONSTRAINT fk_contactos_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE');
PREPARE private_contacts_stmt FROM @ddl; EXECUTE private_contacts_stmt; DEALLOCATE PREPARE private_contacts_stmt;

SET @ddl = CONCAT('CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id ', @user_id_definition, ' NOT NULL,
 expires_at DATETIME NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 KEY idx_auth_sessions_expiry (expires_at), KEY idx_auth_sessions_user (user_id),
 CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
PREPARE private_contacts_stmt FROM @ddl; EXECUTE private_contacts_stmt; DEALLOCATE PREPARE private_contacts_stmt;

SELECT COUNT(*) AS contactos_pendientes_de_asignar FROM contactos WHERE owner_user_id IS NULL;
