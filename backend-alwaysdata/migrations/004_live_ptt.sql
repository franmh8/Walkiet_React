-- Seleccionar la misma BD de conexion.php. Requiere users, channels y la migración 002.
-- Puede repetirse: no borra ni modifica usuarios, grupos ni filas PTT existentes.
-- AS SELECT ... WHERE 1=0 copia solo los tipos/collations de los IDs, nunca los datos.
-- No usa variables de sesión ni PREPARE: evita preparar NULL al importar desde phpMyAdmin.

CREATE TABLE IF NOT EXISTS ptt_floor (
 identity VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
 transmission_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 expires_at DATETIME NULL,
 started_at DATETIME NULL,
 PRIMARY KEY(channel_id),
 KEY idx_ptt_floor_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT c.id AS channel_id, u.id AS holder_user_id
FROM channels c LEFT JOIN users u ON 1=0 WHERE 1=0;
-- MariaDB puede heredar el flag "sin valor por defecto" de users.id aunque el LEFT JOIN sea nullable.
ALTER TABLE ptt_floor ALTER COLUMN holder_user_id SET DEFAULT NULL;

CREATE TABLE IF NOT EXISTS ptt_connections (
 identity VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 updated_at DATETIME NOT NULL,
 PRIMARY KEY(channel_id, identity),
 KEY idx_ptt_connections_session(session_hash),
 KEY idx_ptt_connections_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT c.id AS channel_id, u.id AS user_id,
 '' AS identity, '' AS session_hash, UTC_TIMESTAMP() AS updated_at
FROM channels c CROSS JOIN users u WHERE 1=0;

CREATE TABLE IF NOT EXISTS ptt_devices (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 push_token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 platform VARCHAR(10) CHARACTER SET ascii NOT NULL,
 updated_at DATETIME NOT NULL,
 KEY idx_ptt_devices_user(user_id),
 KEY idx_ptt_devices_session(session_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT u.id AS user_id, '' AS token_hash, '' AS push_token,
 '' AS session_hash, '' AS platform, UTC_TIMESTAMP() AS updated_at
FROM users u WHERE 1=0;

CREATE TABLE IF NOT EXISTS ptt_push_outbox (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 transmission_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload TEXT NOT NULL,
 expires_at DATETIME NOT NULL,
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 available_at DATETIME NOT NULL,
 state VARCHAR(12) CHARACTER SET ascii NOT NULL DEFAULT 'pending',
 ticket_id VARCHAR(100) CHARACTER SET ascii NULL,
 UNIQUE KEY uk_ptt_push_event(transmission_id,token_hash),
 KEY idx_ptt_push_pending(state,available_at),
 KEY idx_ptt_push_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT c.id AS channel_id, u.id AS sender_id,
 '' AS transmission_id, '' AS token_hash, '' AS payload,
 UTC_TIMESTAMP() AS expires_at, UTC_TIMESTAMP() AS available_at
FROM channels c CROSS JOIN users u WHERE 1=0;

CREATE TABLE IF NOT EXISTS ptt_runtime (
 id TINYINT UNSIGNED PRIMARY KEY,
 heartbeat_at DATETIME NOT NULL
) ENGINE=InnoDB;
