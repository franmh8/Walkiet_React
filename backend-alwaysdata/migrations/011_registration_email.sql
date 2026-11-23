-- Registro por correo. Ejecutar en la BD de conexion.php antes de publicar los PHP.
-- No modifica usuarios ni los códigos de recuperación/cambio de correo existentes.
CREATE TABLE IF NOT EXISTS registration_email_challenges (
 email VARCHAR(120) NOT NULL PRIMARY KEY,
 id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 phone_number VARCHAR(20) NOT NULL,
 code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 status ENUM('pending','sent','used','failed') NOT NULL DEFAULT 'pending',
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL,
 expires_at DATETIME NOT NULL,
 UNIQUE KEY registration_challenge_id(id),
 KEY registration_challenge_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_rate_limits (
 bucket CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 hits INT UNSIGNED NOT NULL DEFAULT 0,
 expires_at DATETIME NOT NULL,
 KEY idx_security_rate_expiry(expires_at)
) ENGINE=InnoDB;
