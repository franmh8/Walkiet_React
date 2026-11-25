-- Ejecutar una vez en walkiet_c5i, después de realizar respaldo.
-- No contiene ni sustituye conversaciones existentes.
CREATE TABLE IF NOT EXISTS chat_push_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  expo_token VARCHAR(240) NOT NULL,
  platform ENUM('android','ios') NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  last_seen_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_chat_push_token (expo_token),
  KEY ix_chat_push_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
