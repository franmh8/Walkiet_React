-- Ejecutar UNA VEZ en la BD seleccionada en phpMyAdmin (Alwaysdata).
-- No cambia users, sus contraseñas ni sus relaciones.
CREATE TABLE IF NOT EXISTS contactos (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  callsign VARCHAR(50) DEFAULT NULL,
  correo VARCHAR(120) DEFAULT NULL,
  unit VARCHAR(100) DEFAULT 'Sector Operativo Hidalgo C5i',
  status VARCHAR(20) DEFAULT 'offline',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Antes de añadir el índice, revisar duplicados heredados. No se borran datos.
SELECT phone_number, COUNT(*) AS total FROM contactos
GROUP BY phone_number HAVING COUNT(*) > 1;
-- Si hay duplicados, resolverlos antes de continuar; el índice fallará explícitamente.
ALTER TABLE contactos ADD UNIQUE KEY idx_contactos_phone (phone_number);

-- Conservar en el directorio los usuarios que antes aparecían mediante UNION.
-- Ejecutar solo durante la migración inicial: repetirlo puede reimportar contactos eliminados.
INSERT INTO contactos (id, name, phone_number, callsign, correo, unit, status)
SELECT u.id, u.name, u.phone_number, u.callsign, u.correo, u.unit, u.status
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM contactos c WHERE c.id = u.id OR c.phone_number = u.phone_number);
