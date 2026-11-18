-- Ejecutar después de 007 y con las tablas de chat-sync.php ya instaladas.
-- No modifica mensajes ni inventa entregas/lecturas anteriores.
CREATE TABLE IF NOT EXISTS account_read_privacy (
 read_receipts TINYINT UNSIGNED NOT NULL DEFAULT 1,
 PRIMARY KEY(user_id),
 CONSTRAINT fk_read_privacy_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT id AS user_id FROM users WHERE 1=0;

-- AS SELECT conserva los tipos y collations de los identificadores existentes.
CREATE TABLE IF NOT EXISTS chat_message_receipts (
 delivered_at DATETIME(6) NOT NULL,
 read_at DATETIME(6) NULL,
 PRIMARY KEY(message_id,user_id),
 KEY receipt_user(user_id),
 CONSTRAINT fk_chat_receipt_message FOREIGN KEY(message_id) REFERENCES chat_thread_messages(id) ON DELETE CASCADE,
 CONSTRAINT fk_chat_receipt_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT m.id AS message_id,u.id AS user_id,UTC_TIMESTAMP(6) AS delivered_at,CAST(NULL AS DATETIME) AS read_at FROM chat_thread_messages m CROSS JOIN users u WHERE 1=0;
