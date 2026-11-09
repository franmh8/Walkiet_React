-- Ejecutar después de 002_private_contacts.sql. No modifica usuarios, grupos ni mensajes existentes.
-- Los identificadores conservan los tipos/collations de las tablas de origen.
SELECT CONCAT(COLUMN_TYPE, IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME)))
INTO @ptt_user_type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='id';
SELECT CONCAT(COLUMN_TYPE, IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME)))
INTO @ptt_channel_type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='channels' AND COLUMN_NAME='id';
SET @ptt_sql = CONCAT('CREATE TABLE IF NOT EXISTS ptt_floor (
 channel_id ', @ptt_channel_type, ' NOT NULL PRIMARY KEY,
 holder_user_id ', @ptt_user_type, ' NULL,
 identity VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
 transmission_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 expires_at DATETIME NULL, started_at DATETIME NULL,
 KEY idx_ptt_floor_expiry(expires_at)
) ENGINE=InnoDB');
PREPARE ptt_stmt FROM @ptt_sql; EXECUTE ptt_stmt; DEALLOCATE PREPARE ptt_stmt;
SET @ptt_sql = CONCAT('CREATE TABLE IF NOT EXISTS ptt_connections (
 channel_id ', @ptt_channel_type, ' NOT NULL,
 identity VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_id ', @ptt_user_type, ' NOT NULL,
 session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 updated_at DATETIME NOT NULL,
 PRIMARY KEY(channel_id, identity), KEY idx_ptt_connections_session(session_hash), KEY idx_ptt_connections_user(user_id)
) ENGINE=InnoDB');
PREPARE ptt_stmt FROM @ptt_sql; EXECUTE ptt_stmt; DEALLOCATE PREPARE ptt_stmt;
SET @ptt_sql = CONCAT('CREATE TABLE IF NOT EXISTS ptt_devices (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 push_token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_id ', @ptt_user_type, ' NOT NULL,
 session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 platform VARCHAR(10) CHARACTER SET ascii NOT NULL,
 updated_at DATETIME NOT NULL,
 KEY idx_ptt_devices_user(user_id), KEY idx_ptt_devices_session(session_hash)
) ENGINE=InnoDB');
PREPARE ptt_stmt FROM @ptt_sql; EXECUTE ptt_stmt; DEALLOCATE PREPARE ptt_stmt;
SET @ptt_sql = CONCAT('CREATE TABLE IF NOT EXISTS ptt_push_outbox (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 transmission_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 channel_id ', @ptt_channel_type, ' NOT NULL,
 sender_id ', @ptt_user_type, ' NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload TEXT NOT NULL,
 expires_at DATETIME NOT NULL,
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 available_at DATETIME NOT NULL,
 state VARCHAR(12) CHARACTER SET ascii NOT NULL DEFAULT ''pending'',
 ticket_id VARCHAR(100) CHARACTER SET ascii NULL,
 UNIQUE KEY uk_ptt_push_event(transmission_id,token_hash), KEY idx_ptt_push_pending(state,available_at), KEY idx_ptt_push_expiry(expires_at)
) ENGINE=InnoDB');
PREPARE ptt_stmt FROM @ptt_sql; EXECUTE ptt_stmt; DEALLOCATE PREPARE ptt_stmt;

CREATE TABLE IF NOT EXISTS ptt_runtime (id TINYINT UNSIGNED PRIMARY KEY, heartbeat_at DATETIME NOT NULL) ENGINE=InnoDB;
