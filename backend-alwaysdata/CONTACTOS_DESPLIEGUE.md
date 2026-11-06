# Desplegar la corrección de contactos

El 6 de noviembre de 2026, la consulta de solo lectura a
`https://walkiet.alwaysdata.net/contacts.php` devolvió HTTP 200 con un error de
sintaxis PHP: `unexpected end of file`, línea 161. La app anterior mostraba éxito
antes de comprobar la respuesta y retenía contactos locales.

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
