-- Ejecutar en la BD de conexion.php, después de 002 y 005.
-- No modifica usuarios, contactos, mensajes ni preferencias anteriores.
CREATE TABLE IF NOT EXISTS account_privacy (
 show_last_seen TINYINT UNSIGNED NOT NULL DEFAULT 1,
 PRIMARY KEY(user_id),
 CONSTRAINT fk_account_privacy_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT id AS user_id FROM users WHERE 1=0;

-- Una conexión por sesión y ventana/dispositivo. El cierre de una ventana no
-- desconecta las otras. Las fechas se escriben siempre en UTC desde PHP.
CREATE TABLE IF NOT EXISTS account_presence (
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 client_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 is_active TINYINT UNSIGNED NOT NULL DEFAULT 0,
 last_active_at DATETIME NOT NULL,
 PRIMARY KEY(token_hash,client_id),
 KEY presence_user(user_id),
 CONSTRAINT fk_account_presence_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT id AS user_id, CAST('' AS CHAR(64)) AS token_hash, CAST('' AS CHAR(36)) AS client_id, UTC_TIMESTAMP() AS last_active_at FROM users WHERE 1=0;
