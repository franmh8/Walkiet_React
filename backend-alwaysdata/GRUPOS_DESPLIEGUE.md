# Grupos por membresía

Actualizar la app desde la rama `codex/fix-contacts-mysql-crud` y subir juntos al
mismo directorio que `conexion.php`:

- `channels.php` (sustituir el anterior).
- `channels-handler.php` (nuevo).

Conservar `auth-session.php`, `cors.php`, `conexion.php` y `.htaccess` de la
instalación de agendas privadas. `api/channels.php` sigue siendo un proxy al
endpoint principal; no necesita cambios. El acceso usa el token del login, tanto
en PHP como en Node. Si se conserva una sesión anterior sin token, cerrar sesión
y volver a entrar.

No se requiere otra migración en la instalación existente: usa `channels` y
`channel_members`, que ya existen. Deben ser InnoDB para las transacciones y
conservar los índices por `channel_id` y `user_id` del esquema original. No volver
a importar el esquema completo sobre una BD con datos.

## Comportamiento

- Una cuenta nueva recibe `channels: []`, aunque otras cuentas tengan grupos.
  La app muestra “Sin ningún grupo registrado” y permite crear o unirse.
- Solo se listan los grupos con una membresía de la cuenta autenticada.
  Los canales antiguos sin membresías no aparecen; no se eliminan datos antiguos.
- Crear guarda el canal y al creador en una sola transacción. Se utiliza el ID de
  la sesión, nunca `created_by` o `user_id` del cuerpo. No hay usuarios de respaldo
  ni canales de ejemplo automáticos.
- Todos los grupos se presentan como Táctico; los nuevos se guardan con categoría
  `tactico`, compatible con el ENUM existente. Se conserva la búsqueda por nombre
  o PIN y se retiran los filtros y la selección de tipo.
- El contador es `COUNT(DISTINCT channel_members.user_id)` del grupo. Muestra
  miembros registrados, no presencia en línea. No utiliza el antiguo campo
  `channels.member_count`, números aleatorios ni mínimos inventados.
- Unirse por PIN o QR valida el grupo en la BD y registra una sola membresía.
  Un PIN inexistente devuelve 404 y no crea un canal local. El QR nuevo incluye
  el ID real del canal y su PIN. Si existen PIN antiguos duplicados, utilizar el
  QR nuevo para distinguirlos; crear un grupo con un PIN ocupado devuelve 409.
- Salir elimina únicamente la membresía de la sesión. Solo el creador puede
  eliminar el canal. Estas operaciones se confirman en pantalla después de que
  el servidor las guarda; un error conserva el formulario.
- La lista y los contadores se actualizan cada cuatro segundos. La selección PTT
  guardada se restaura solo si la cuenta sigue siendo miembro. El escáner muestra
  la cámara y el ingreso por PIN, sin botones de simulación ni supuestos canales
  cercanos. Cerrar el escáner libera la cámara.

## Archivos de la app

`src/native/groups/GroupsScreen.tsx` contiene el listado y las ventanas para crear,
unirse, configurar y confirmar. `ChannelQrScanner.tsx` administra cámara/QR;
`ChannelMembersModal.tsx` consulta miembros reales; `useChannelsDirectory.ts`
mantiene el estado por sesión. `NativeApp.tsx` conserva la navegación, PTT y la
preferencia de selección. `src/services/channelsApi.ts` maneja el contrato HTTP y
`channelsDirectory.ts` su implementación MySQL para Node.

## Pruebas locales reproducibles

Requiere la instancia local y los esquemas de `tests/fixtures/README.md`.
`tests/fixtures/groups-mysql.ts` prepara exclusivamente
`contacts_test_groups_php` y `contacts_test_groups_node`, con cuentas sintéticas.
Nunca utilizar estos scripts sobre producción.

1. Configurar `CONTACTS_TEST_SOCKET` y ejecutar
   `node --import tsx tests/fixtures/groups-mysql.ts`.
2. Preparar el backend PHP con `prepare-private-backend.php`, usando
   `CONTACTS_TEST_DSN` en `contacts_test_groups_php`. Iniciar PHP en
   `127.0.0.1:8099` conservando las variables de conexión de pruebas.
3. Iniciar `server.ts` con `DB_NAME=contacts_test_groups_node`, socket local,
   credenciales de pruebas, `HOST=127.0.0.1` y `PORT=3010`.
4. Ejecutar `GROUPS_TEST_BACKEND=http://127.0.0.1:8099 node tests/groups-http.mjs`
   y repetir con `http://127.0.0.1:3010`.
5. Ejecutar `npm run build`, iniciar `npm run preview` y lanzar
   `GROUPS_TEST_BACKEND=http://127.0.0.1:8099 node tests/groups-ui.mjs`.
   Admite `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` y `GROUPS_UI_URL`.

La prueba de navegador verifica estados vacíos, errores de escritura, recuento
1→2→1, aislamiento, recarga, configuración sin “Cerrar” duplicado y escáner sin
simulación. También prueba la unión QR con un adaptador de cámara/decodificador
controlado y comprueba que se detienen sus pistas al cerrar. La cámara física
iOS/Android requiere la prueba en el dispositivo. El bundle iOS se verifica con
`npx expo export --platform ios`.
