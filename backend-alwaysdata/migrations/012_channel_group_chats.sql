-- Compatibilidad con instalaciones de 008 previas al contador de no leídos.
-- No registra como vistos los mensajes que no tienen lectura confirmada.
SET @walkiet_has_seen = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_message_receipts' AND COLUMN_NAME='seen_at');
SET @walkiet_seen_sql = IF(@walkiet_has_seen>0,'SELECT 1','ALTER TABLE chat_message_receipts ADD COLUMN seen_at DATETIME(6) NULL');
PREPARE walkiet_seen_stmt FROM @walkiet_seen_sql;
EXECUTE walkiet_seen_stmt;
DEALLOCATE PREPARE walkiet_seen_stmt;
SET @walkiet_seen_sql = IF(@walkiet_has_seen>0,'SELECT 1','UPDATE chat_message_receipts SET seen_at=read_at WHERE read_at IS NOT NULL');
PREPARE walkiet_seen_stmt FROM @walkiet_seen_sql;
EXECUTE walkiet_seen_stmt;
DEALLOCATE PREPARE walkiet_seen_stmt;

-- Un chat compartido por canal. Ejecutar después de instalar las tablas de chat.
-- Conserva los tipos/collations originales de los identificadores.
-- No borra ni modifica conversaciones existentes.
CREATE TABLE IF NOT EXISTS chat_channel_threads (
 PRIMARY KEY(channel_id),
 UNIQUE KEY channel_chat_thread(thread_id),
 CONSTRAINT fk_channel_chat_thread FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
AS SELECT c.id AS channel_id,t.id AS thread_id FROM channels c CROSS JOIN chat_threads t WHERE 1=0;
-- El enlace permanece si se elimina el canal: los permisos comprueban que el
-- canal y la membresía sigan existiendo, sin borrar el historial automáticamente.
