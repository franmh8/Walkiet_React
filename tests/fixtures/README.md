# Pruebas locales de agenda privada

Usar solo una instancia MySQL/MariaDB de pruebas. El esquema crea bases con prefijo
`contacts_test_`; los tests eliminan sus filas. Requiere PHP con PDO MySQL/SQLite,
Node y Playwright. Nunca apuntar estas variables a producción.

1. Ejecutar `contacts-mysql.sql` con el cliente MySQL.
2. Aplicar `backend-alwaysdata/migrations/002_private_contacts.sql` a
   `contacts_test_php`, `contacts_test_node` y `contacts_test_fresh`. La primera
   contiene una agenda antigua con collation distinta; la última usa otra
   collation en users. Repetir 002 para comprobar que no altera datos existentes.
3. Ejecutar `php tests/contacts-php.php` con `CONTACTS_TEST_DSN` apuntando a
   `contacts_test_php` y `CONTACTS_TEST_USER`/`CONTACTS_TEST_PASSWORD` del servidor
   local. Sin variables, prueba SQLite en memoria.
4. Ejecutar `CONTACTS_TEST_SOCKET=/ruta/mysql.sock node --import tsx tests/contacts-directory.test.ts`.
5. Para navegador real, con las mismas variables PHP de prueba, ejecutar
   `php tests/fixtures/contacts-ui-seed.php`. Crear un directorio temporal y ejecutar
   `php tests/fixtures/prepare-private-backend.php /ruta/directorio-temporal`.
6. Conservar las variables de conexión al iniciar
   `php -S 127.0.0.1:8099 -t /ruta/directorio-temporal /ruta/directorio-temporal/router.php`.
   Los endpoints se copian a ese directorio y usan una conexión de prueba, sin
   leer las credenciales de `backend-alwaysdata/conexion.php`.
7. Iniciar `npm run build` y `npm run preview`. Ejecutar
   `CONTACTS_TEST_BACKEND=http://127.0.0.1:8099 node tests/contacts-private-ui.mjs`.
   Admite `CHROMIUM_PATH` para Chromium del sistema. Recrear el seed antes de
   repetir: la prueba cambia la contraseña de B y revoca sus sesiones.

Las pruebas usan cuentas sintéticas owner-a/owner-b, sin relación con cuentas de
producción ni con el propietario elegido para la migración de datos reales.

8. Para HTTP Node, después de recrear los datos con la prueba DAO de Node, iniciar
   `server.ts` con `NODE_ENV=production`, `DB_NAME=contacts_test_node`,
   `DB_SOCKET=/ruta/mysql.sock`, `DB_USER=root`, `DB_PASSWORD` configurada para la
   instancia local, `HOST=127.0.0.1` y `PORT=3010`. Ejecutar
   `CONTACTS_TEST_NODE_BACKEND=http://127.0.0.1:3010 node tests/contacts-node-http.mjs`.
   La prueba comprueba el nombre de la BD antes de modificar cuentas sintéticas.
9. Para interoperabilidad de sesiones, con el backend PHP anterior activo, ejecutar
   `CONTACTS_TEST_BACKEND=http://127.0.0.1:8099 CONTACTS_TEST_SOCKET=/ruta/mysql.sock node --import tsx tests/contacts-session-interop.test.ts`.
