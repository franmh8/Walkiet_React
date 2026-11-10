-- Seleccionar la BD de conexion.php. Requiere users y auth_sessions (migración 002).
-- Reutiliza user_settings si ya existe. No cambia preferencias ni importa usuarios.
-- Los IDs conservan el tipo/collation de users.id, sin variables de sesión ni PREPARE.
CREATE TABLE IF NOT EXISTS user_settings (
 theme_mode ENUM('light','dark','system') NOT NULL DEFAULT 'system',
 push_notifications TINYINT UNSIGNED NOT NULL DEFAULT 0,
 channel_message_sounds TINYINT UNSIGNED NOT NULL DEFAULT 1,
 ptt_mode ENUM('hold','toggle') NOT NULL DEFAULT 'hold',
 roger_beep TINYINT UNSIGNED NOT NULL DEFAULT 1,
 vibration_on_ptt TINYINT UNSIGNED NOT NULL DEFAULT 1,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id),
 CONSTRAINT fk_profile_settings_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT id AS user_id FROM users WHERE 1=0;

-- Imagen acotada, separada del listado de usuarios y accesible solo mediante la sesión propia.
CREATE TABLE IF NOT EXISTS account_avatars (
 image_data MEDIUMTEXT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id),
 CONSTRAINT fk_account_avatar_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT id AS user_id FROM users WHERE 1=0;
