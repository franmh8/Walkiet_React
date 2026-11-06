# Agendas privadas de contactos

`users` contiene las cuentas registradas y sus credenciales. `contactos` contiene
las fichas que cada cuenta guarda en su agenda. El CRUD de contactos nunca crea,
edita ni elimina cuentas. Un contacto puede existir sin tener una cuenta en la app.
La tabla antigua `contacts` no se usa en este flujo; se conserva como legado.

## Modelo y consultas

- `contactos.owner_user_id` identifica al dueño y referencia `users.id` con clave
  foránea. Tras asignar los registros antiguos se establece como NOT NULL.
- `UNIQUE(owner_user_id, phone_number)` evita duplicados en una agenda. Distintas
  cuentas pueden guardar el mismo teléfono con nombres/correos diferentes.
- `(owner_user_id, name, id)` sirve para listar por nombre y avanzar mediante cursor.
  También hay índices por propietario/teléfono, correo e indicativo para búsqueda.
- Cada petición devuelve 50 contactos; el servidor acepta como máximo 100. Devuelve
  `has_more` y `next_cursor`, sin contar ni descargar toda la agenda.
- La búsqueda usa prefijos de nombre, teléfono, correo e indicativo. Cada rama de
  búsqueda está acotada al dueño y dispone de índice. Los comodines se escapan.
- La vinculación con cuentas registradas se consulta por teléfono para un máximo
  de una página de contactos, en una sola consulta adicional con `IN`. No hay una
  consulta por fila ni un JOIN entre columnas con collations incompatibles.
- `registered_user_id` es una respuesta calculada de solo lectura para chat/PTT.
  El ID de una ficha privada no se usa como ID de cuenta.

## Identidad y aislamiento

El login verifica la contraseña y devuelve un token aleatorio de 256 bits con
caducidad de siete días. Solo su SHA-256 se guarda en `auth_sessions`, separada de
`users`. La agenda exige `Authorization: Bearer TOKEN` y obtiene el dueño desde la
sesión validada. Cualquier `owner_user_id`/`user_id` recibido en body o query se
ignora. Lectura, edición y borrado siempre incluyen el propietario en SQL. Un ID
ajeno devuelve 404; una sesión ausente, vencida o revocada devuelve 401.

En producción se usa HTTPS para enviar el token.

El logout revoca el token y limpia la agenda, conversaciones y selecciones locales.
Las respuestas pendientes de otra cuenta se descartan. La app no usa contactos de
muestra ni una caché compartida. Las sesiones antiguas sin token deben cerrar e
iniciar sesión de nuevo. Los placeholders `hash_demo` no autentican cuentas.
El endpoint antiguo de cambio de contraseña también exige sesión y actúa solo sobre
su titular; revoca todas sus sesiones al cambiar la clave. Se retiró el flujo de
recuperación pública que entregaba códigos al solicitante o permitía cambiar una
clave con solo el teléfono. Recuperar acceso sin sesión requiere al administrador
hasta integrar un canal de verificación real.

## Actualización de una BD existente

Usar la misma BD que utiliza `conexion.php`. Exportar `users` y `contactos` antes
de migrar. Durante el cambio, pausar las altas/ediciones de la versión anterior.

1. Ejecutar **`migrations/002_private_contacts.sql`**. Sirve también si falta
   `contactos`. Toma el tipo y la collation de `users.id` para la relación; elimina
   la unicidad global del teléfono e incorpora los índices privados y sesiones.
   Se probó al repetirla y con collations `unicode_ci`/`uca1400_ai_ci` diferentes.
2. Los registros existentes quedan sin dueño y no aparecen en ninguna agenda
   hasta asignarlos. En **`003_assign_existing_contacts.sql`**, sustituir
   `REEMPLAZAR_TELEFONO` por el teléfono de la cuenta elegida y ejecutar. El script
   resuelve su ID en `users`, asigna únicamente filas sin dueño y, si todas quedan
   asignadas, exige NOT NULL. Si la cuenta no existe no asigna datos. Si hay un
   teléfono que ya está en la agenda destino, resolver el duplicado antes de
   repetir la asignación; la restricción evita sobrescribir fichas.
3. Verificar que `contactos_asignados`, `propietario` y `resultado` sean correctos.
   Las filas que ya tengan dueño conservan su propietario.

La elección de propietario se proporciona durante la instalación; no se guarda
un teléfono real en el repositorio público. No repetir la migración global 001 ni
el INSERT que copiaba todas las cuentas `users`. No borrar cuentas antiguas para
limpiar contactos: su procedencia debe revisarse por separado.

## Archivos que se suben a Alwaysdata

Después de las migraciones, subir primero los helpers y luego las entradas:

- `auth-session.php`, `contacts-handler.php`.
- `contacts.php`, `login.php`, `logout.php`, `reset-password.php`, `register.php`, `api/login.php`, `api/register.php`.
- `.htaccess`, que deja pasar Authorization y evita cabeceras CORS de origen duplicadas.

Conservar `conexion.php` y `cors.php`. Se necesita SELECT sobre cuentas y sesiones,
CRUD sobre agenda/sesiones y los permisos DDL necesarios durante la migración.
`database_schema.sql` ya no inserta usuarios demo; no hace falta volver a ejecutarlo
sobre una instalación existente.

Actualizar también la app y cerrar/iniciar sesión. Abrir `contacts.php` directamente
sin token ahora debe devolver **401**: no es una prueba de fallo de conexión. Para
probar, entrar con A, guardar un contacto, cambiar a B y verificar su agenda propia.
Después intentar editar/borrar un ID de A con el token de B: debe responder 404.

Node usa la misma BD, esquema y tokens que PHP. Login y registro devuelven error si
MySQL no está disponible; no simulan una cuenta persistida en `.walkiet_db.json`.
Node requiere `npm install` para incorporar `bcryptjs` y validar hashes compatibles.
Admite `DB_SOCKET` para una conexión Unix local, además de `DB_HOST`/`DB_PORT` para TCP.

## App

- `src/native/contacts/ContactsScreen.tsx`: listado virtualizado con SectionList,
  búsqueda en servidor, ficha y formularios de CRUD, y botón Cargar más contactos.
- `useContactsDirectory.ts`: estado acotado a usuario/token/servidor, búsqueda con
  debounce de 350 ms, cursor, invalidación de respuestas antiguas y recarga tras
  escrituras. No realiza sondeos periódicos de toda la agenda.
- `src/services/contactsApi.ts`: contrato HTTP, token, validación y páginas acotadas.
- `NativeApp.tsx`: login/logout y uso de la misma agenda en chat y selección de grupo.
  Los contactos sin cuenta registrada pueden guardarse y llamarse por teléfono;
  chat/grupos solo utilizan IDs de cuentas existentes.

## Mantenimiento y rendimiento

Programar, por ejemplo cada hora, una tarea en Alwaysdata que ejecute por lotes:

```sql
DELETE FROM auth_sessions WHERE expires_at <= UTC_TIMESTAMP() LIMIT 1000;
```

El índice de caducidad evita recorrer sesiones vigentes. El borrado de una cuenta
elimina sus sesiones y su agenda mediante claves foráneas. Un borrado de contacto
elimina solo esa ficha. Verificar el plan con el ID real de un propietario:

```sql
EXPLAIN SELECT id, name FROM contactos
WHERE owner_user_id = 'ID_DEL_USUARIO'
ORDER BY name, id LIMIT 51;
```

En las pruebas MariaDB usó `idx_contactos_owner_name`. Las páginas con cursor evitan
el costo creciente de OFFSET y la app virtualiza la lista. No se promete un tiempo
universal: depende del volumen, hardware y consultas; medir planes en la BD real
antes de añadir índices o cambios de infraestructura.

## Validación reproducible

La preparación del entorno temporal está en `tests/fixtures/README.md`.

- `npm run build`
- `node --import tsx tests/contacts-api.test.ts`
- `node --import tsx tests/contacts-directory.test.ts` (las pruebas MariaDB necesitan
  `CONTACTS_TEST_SOCKET` y una BD exclusiva `contacts_test_node` con la migración).
- `php tests/contacts-php.php` usa PDO SQLite en memoria. Para probar MariaDB,
  `CONTACTS_TEST_DSN` debe apuntar a una BD cuyo nombre empiece por `contacts_test_`.
  **Esas pruebas eliminan datos de las tablas de la BD de pruebas. Nunca usar producción.**
- `node tests/contacts-ui.mjs` usa Chromium con backend interceptado para fallos,
  formularios conservados, recarga, edición/baja y registro desde chat.
- `node tests/contacts-private-ui.mjs` exige `CONTACTS_TEST_BACKEND` local, con PHP,
  MariaDB y dos cuentas de prueba; verifica sesiones reales, páginas y aislamiento
  al cambiar de cuenta. Necesita Playwright y una app local en puerto 3000.

También hay pruebas HTTP del servidor Node en `tests/contacts-node-http.mjs` y
sesiones PHP ↔ Node en `tests/contacts-session-interop.test.ts`; consultar las fixtures.

La compilación, ambas capas contra MariaDB y el flujo de navegador se verificaron
localmente. Esta rama no despliega PHP ni ejecuta cambios en la BD de producción.
