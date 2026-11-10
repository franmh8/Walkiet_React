-- Ejecutar completa en la BD de conexion.php, después de 002 y 005.
-- NULLIF infiere un tipo compatible con users.id y permite retos señuelo sin cuenta.
CREATE TABLE IF NOT EXISTS security_challenges (
 id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '' PRIMARY KEY,
 purpose ENUM('email_change','password_reset') NOT NULL DEFAULT 'password_reset',
 session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 target_email VARCHAR(120) NULL,
 credential_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
 proof_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 status ENUM('pending','sent','verified','used','failed') NOT NULL DEFAULT 'pending',
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 expires_at DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00',
 proof_expires_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_security_owner(user_id,purpose,status),
 KEY idx_security_expiry(expires_at),
 CONSTRAINT fk_security_challenge_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT NULLIF(id,id) AS user_id FROM users WHERE 1=0;

CREATE TABLE IF NOT EXISTS security_rate_limits (
 bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 hits INT UNSIGNED NOT NULL DEFAULT 0,
 expires_at DATETIME NOT NULL,
 KEY idx_security_rate_expiry(expires_at)
) ENGINE=InnoDB;
