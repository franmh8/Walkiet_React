-- Ejecutar DESPUÉS de 002. Asignación inicial explícita de los contactos globales.
-- Sustituir el teléfono por la cuenta elegida; nunca copiar todas las cuentas users.
SET @contacts_owner_phone = 'REEMPLAZAR_TELEFONO';
SET @contacts_owner_id = (SELECT id FROM users WHERE phone_number = @contacts_owner_phone);
START TRANSACTION;
UPDATE contactos SET owner_user_id = @contacts_owner_id
WHERE owner_user_id IS NULL AND @contacts_owner_id IS NOT NULL;
SELECT ROW_COUNT() AS contactos_asignados;
COMMIT;
SELECT @contacts_owner_id AS propietario,
 IF(@contacts_owner_id IS NULL, 'Usuario no encontrado: no se asignó ningún contacto', 'Asignación completada') AS resultado;

-- Una vez asignadas todas las filas, exigir dueño también a nivel de BD.
SET @owner_column_definition = (
 SELECT CONCAT(COLUMN_TYPE,
  IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME)))
 FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='contactos' AND COLUMN_NAME='owner_user_id'
);
SET @ddl = IF(@contacts_owner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM contactos WHERE owner_user_id IS NULL),
 CONCAT('ALTER TABLE contactos MODIFY COLUMN owner_user_id ', @owner_column_definition, ' NOT NULL'),
 'SELECT ''Quedan registros sin dueño o la cuenta no existe; no se cambia la restricción'' AS aviso');
PREPARE assign_contacts_stmt FROM @ddl; EXECUTE assign_contacts_stmt; DEALLOCATE PREPARE assign_contacts_stmt;
