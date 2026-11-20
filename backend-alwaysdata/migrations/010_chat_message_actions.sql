-- Metadatos de edición, respuesta y eliminación. No altera mensajes existentes.
CREATE TABLE IF NOT EXISTS chat_message_annotations (
 edited_at DATETIME(6) NULL,
 deleted_at DATETIME(6) NULL,
 forwarded TINYINT UNSIGNED NOT NULL DEFAULT 0,
 send_hash CHAR(64) NULL,
 PRIMARY KEY(message_id),
 KEY annotation_reply(reply_to_id),
 CONSTRAINT fk_annotation_message FOREIGN KEY(message_id) REFERENCES chat_thread_messages(id) ON DELETE CASCADE,
 CONSTRAINT fk_annotation_reply FOREIGN KEY(reply_to_id) REFERENCES chat_thread_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT m.id AS message_id,r.id AS reply_to_id FROM chat_thread_messages m LEFT JOIN chat_thread_messages r ON 1=0 WHERE 1=0;

CREATE TABLE IF NOT EXISTS chat_message_hidden (
 hidden_at DATETIME(6) NOT NULL,
 PRIMARY KEY(message_id,user_id),
 KEY hidden_owner(user_id),
 CONSTRAINT fk_hidden_message FOREIGN KEY(message_id) REFERENCES chat_thread_messages(id) ON DELETE CASCADE,
 CONSTRAINT fk_hidden_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT m.id AS message_id,u.id AS user_id,UTC_TIMESTAMP(6) AS hidden_at FROM chat_thread_messages m CROSS JOIN users u WHERE 1=0;
