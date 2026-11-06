# Desplegar la corrección de contactos

El 6 de noviembre de 2026, la consulta de solo lectura a
`https://walkiet.alwaysdata.net/contacts.php` devolvió HTTP 200 con un error de
sintaxis PHP: `unexpected end of file`, línea 161. La app anterior mostraba éxito
antes de comprobar la respuesta y retenía contactos locales.

## HTTP 500 después de sustituir el PHP

El registro PHP del servidor confirmó:
`SQLSTATE[42S02]: 1146 Table 'walkiet_c5i.contactos' doesn't exist`.
Para ese caso, seleccionar **walkiet_c5i** en phpMyAdmin y aplicar una sola vez
`migrations/001_contacts.sql`. El PHP puede conectar con MySQL y aun así fallar
si no existe esta tabla. La separación de React no crea tablas en el servidor.

Si el endpoint devuelve JSON con `success:false`, ya se está ejecutando el PHP,
pero no se confirmó el acceso al directorio. El mensaje genérico no permite
atribuirlo a una tabla ausente, una columna o permisos sin revisar el log.
El indicador ONLINE de `status.php` tampoco comprueba la tabla `contactos`.

Subir las versiones actuales de **ambos** PHP y volver a abrir `/contacts.php`.
La respuesta incluirá uno de estos códigos cuando PDO identifica la causa:

| Código | Acción |
| --- | --- |
| `CONTACTS_TABLE_MISSING` | Crear `contactos` con la migración en la BD que usa `conexion.php`. |
| `CONTACTS_SCHEMA_MISMATCH` | Comparar las columnas existentes con la migración y corregir las diferencias. |
| `CONTACTS_DATABASE_PERMISSIONS` | Dar al usuario de conexión permisos sobre esa tabla. |
| `CONTACTS_DATABASE_UNAVAILABLE` | Revisar la conexión al host MySQL. |
| `CONTACTS_SERVER_ERROR` | Consultar la línea `Contacts API:` del registro PHP de Alwaysdata. |

Estos diagnósticos responden con HTTP 503 para errores reconocidos de BD;
los detalles SQL se registran únicamente en el servidor. No se simula éxito.
Para verificar la BD seleccionada sin modificar datos, ejecutar en phpMyAdmin:

```sql
SELECT DATABASE() AS base_actual;
SHOW TABLES LIKE 'contactos';
```

## Base de datos

En phpMyAdmin, seleccionar la misma BD que usa `conexion.php`. Hacer respaldo de
`contactos` antes de aplicar `migrations/001_contacts.sql`, una sola vez:

1. Crear la tabla si falta.
2. Consultar duplicados de teléfono. Resolverlos antes de añadir el índice único;
   la migración no borra registros ni elige automáticamente cuál conservar.
3. Añadir el índice único y copiar al directorio los usuarios existentes que aún
   no están en `contactos`. No repetir la importación después de eliminar contactos.

El CRUD opera sobre el directorio global `contactos`. Las cuentas y contraseñas
de `users` permanecen independientes; registrar un contacto no crea una cuenta
de acceso. Los usuarios importados conservan su ID para las conversaciones existentes.
Los registros locales que nunca llegaron a la BD ya no se muestran como guardados;
se deben registrar otra vez después de corregir el servidor.

## Archivos del servidor

Si la creación terminó pero la importación devuelve **1267 / Illegal mix of
collations**, ejecutar únicamente este INSERT corregido, una vez, para completar
la importación inicial. No hace falta repetir CREATE ni añadir otra vez el índice:

```sql
INSERT INTO contactos (id, name, phone_number, callsign, correo, unit, status)
SELECT u.id, u.name, u.phone_number, u.callsign, u.correo, u.unit, u.status
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM contactos c
  WHERE c.id COLLATE utf8mb4_unicode_ci = u.id COLLATE utf8mb4_unicode_ci
     OR c.phone_number COLLATE utf8mb4_unicode_ci = u.phone_number COLLATE utf8mb4_unicode_ci
);
```

Las comparaciones usan una collation explícita común a ambas tablas, aunque la
BD haya heredado `utf8mb4_uca1400_ai_ci` para la tabla nueva. Esta consulta no
modifica la estructura de `users` ni de `contactos`. La migración actualizada
también declara la collation al crear una tabla nueva.

Subir juntos al directorio del backend, normalmente `/home/walkiet/www/`:

- `contacts.php`
- `contacts-handler.php`
- `.htaccess` (incluye las rutas `/api/contacts` y `/api/contacts/:id`)

Reutilizar `conexion.php` y `cors.php` existentes. No cambiar sus credenciales.
El proceso PHP debe tener permisos SELECT, INSERT, UPDATE y DELETE en `contactos`.
Las operaciones HTTP son GET (lista), POST con `action: create|update|delete`,
PUT (edición) y DELETE (eliminación). Actualizar/eliminar requiere el ID persistido.
Los errores tienen `success:false` y HTTP 4xx/5xx; no se devuelve una lista vacía
cuando falla SQL. Las escrituras usan consultas preparadas y responden después
de confirmar la transacción. Teléfono único, de 10 a 15 dígitos, y correo opcional.

## Organización del código de la app

- `src/native/contacts/ContactsScreen.tsx`: listado, búsqueda, ficha, formularios y confirmación de eliminación.
- `src/native/contacts/useContactsDirectory.ts`: estado del directorio, consultas, escrituras y sondeo compartidos con chat/grupos. Reintenta cada 15 s si está disponible y cada 60 s tras un error, además del botón manual.
- `src/services/contactsApi.ts`: contrato HTTP y validación de las respuestas.
- `src/native/components/NativeFeedback.tsx`: avisos y confirmaciones reutilizables.
- `NativeApp.tsx`: integración con navegación, conversaciones y selección de miembros; sin formularios ni peticiones de contactos.

## Aplicación y Node

Publicar la app actualizada o reiniciar Expo con esta rama. Al abrir Contactos se
consulta la BD; el botón **Actualizar contactos** permite reintentar. Las operaciones
mantienen abierto el formulario con el error si el servidor no confirma el cambio.
En caso de timeout, consultar de nuevo antes de reintentar: la escritura pudo
completarse aunque no llegara la respuesta.

Si se usa `server.ts`, configurar sus variables MySQL para apuntar a la misma BD y
aplicar la misma migración. Contactos devuelve 503 si MySQL no está disponible;
ya no escribe `.walkiet_db.json` para aparentar una sincronización.

## Validación

- `npm run build`
- `node --import tsx tests/contacts-api.test.ts`
- `node --import tsx tests/contacts-directory.test.ts`
- `php -l backend-alwaysdata/contacts.php`
- `php -l backend-alwaysdata/contacts-handler.php`
- `php tests/contacts-php.php` (requiere PDO SQLite; usa una BD en memoria)

Las pruebas PHP comprueban CRUD y persistencia al volver a consultar usando PDO
SQLite. Las de Node comprueban el contrato y el driver simulado; no sustituyen una
prueba con MySQL desplegado. Después del despliegue, crear un contacto de prueba,
recargar, editar teléfono/correo, recargar y eliminar; verificar la fila en
phpMyAdmin después de cada operación y limpiar el contacto de prueba.

Este cambio no despliega archivos ni ejecuta migraciones en producción.

## Regresión de navegador (opcional)

Con la app local en el puerto 3000 (`npm run build` y `npm run preview`),
instalar Playwright para pruebas con `npm install --no-save --package-lock=false playwright`
y su navegador (`npx playwright install chromium`). Ejecutar
`node tests/contacts-ui.mjs`. Admite `CHROMIUM_PATH` para usar Chromium del sistema.
Todas las peticiones al backend remoto se interceptan con datos de prueba.
Se comprueban error PHP con HTTP 200, formulario conservado, bloqueo durante
guardado, recarga, edición y borrado con fallo/éxito, sin contactos locales fantasma.
También se verifica el error de consulta, el reintento manual sin sondeo continuo,
el alta desde chat y la búsqueda por correo en la pantalla separada.
