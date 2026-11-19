-- Preferencia por cuenta. No altera mensajes, fotos ni ajustes existentes.
CREATE TABLE IF NOT EXISTS account_media_preferences (
 auto_save_photos TINYINT UNSIGNED NOT NULL DEFAULT 1,
 PRIMARY KEY(user_id),
 CONSTRAINT fk_media_preferences_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT id AS user_id FROM users WHERE 1=0;
