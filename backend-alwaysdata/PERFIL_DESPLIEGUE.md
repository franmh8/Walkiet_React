# Perfil y ajustes de la cuenta

## Qué cambia

`src/native/profile/ProfileScreen.tsx` contiene el perfil y sus formularios.
`SettingsScreen.tsx` contiene apariencia, avisos, sonidos, modo PTT y conexión.
`useAccountProfile.ts` administra la sesión, las solicitudes y su estado;
`accountApi.ts` usa una sola ruta y descarta errores sin anunciar éxito local.

El perfil muestra nombre, teléfono y correo. Rol y Unidad se retiraron de esta
vista, conservando sus datos existentes en la BD. Nombre y foto se editan para
el titular del token. El cambio de correo exige sesión activa y un código
enviado al nuevo destino; la API de edición directa no permite saltarlo.
El teléfono es de consulta: el cliente no puede modificarlo ni editar otra
cuenta enviando un ID. El nombre/correo guardados se reflejan en la sesión
local; volver a iniciar sesión consulta los datos actualizados de la BD.

Se reutiliza **`user_settings`** del esquema original, con `theme_mode`,
`push_notifications`, `channel_message_sounds`, `ptt_mode` y `roger_beep`.
La migración conserva las filas y campos anteriores. En una instalación nueva
los avisos empiezan desactivados y requieren autorización del dispositivo.
Las fotos se guardan aparte en **`account_avatars`**, con ID/FK compatibles con
`users.id`, sin cargar imágenes en cada consulta de usuarios o contactos.
Solo la API autenticada de la cuenta devuelve su foto.

La selección usa archivos en navegador y galería/cámara en la app nativa, con
recorte cuadrado y reducción
JPEG de 320 × 320. El servidor acepta JPEG/PNG/WebP válidos de hasta 512 × 512 y
128 KB; rechaza SVG, URLs arbitrarias y cadenas no válidas. Un error conserva
la imagen y el formulario previos.

La configuración de Gmail (SMTP u OAuth), migración 006, rutas de verificación y recuperación
están en [CORREO_SEGURIDAD_DESPLIEGUE.md](CORREO_SEGURIDAD_DESPLIEGUE.md).

## Instalación en Alwaysdata

1. En phpMyAdmin seleccionar la misma BD de `conexion.php` y aplicar completo
   [005_account_profile.sql](migrations/005_account_profile.sql). Requiere la
   migración 002 para las sesiones. Puede repetirse y no importa usuarios ni
   restablece sus preferencias. No requiere `PREPARE` ni variables SQL.
2. Subir junto a `conexion.php` y `auth-session.php`:
   - [account.php](account.php)
   - [account-handler.php](account-handler.php)
   - [channels-handler.php](channels-handler.php) actualizado, para coordinar
     cambios de grupo con la eliminación de una cuenta.
   - [ptt-handler.php](ptt-handler.php) actualizado, para respetar los sonidos
     y avisos de cada destinatario al despachar una notificación.
   - [.htaccess](.htaccess) actualizado y [api/account.php](api/account.php) si se
     usan los proxies `/api/*.php`. Conservar `cors.php` y `auth-session.php`.
3. Actualizar la rama de la app, ejecutar `npm ci` y reiniciar Expo con caché
   limpia. El perfil no requiere que el worker PTT esté funcionando. Si se usa
   un worker, reiniciarlo para que cargue el helper PTT actualizado.
4. En una compilación nativa propia reconstruir la app después de añadir los
   módulos Expo Image Picker, Image Manipulator y Audio. El JavaScript nuevo no
   incorpora módulos nativos a un binario antiguo. La cámara/fotos solicitan sus
   permisos; una cancelación no sube nada. Los módulos se cargan al usarse y los
   módulos ausentes muestran un diagnóstico sin bloquear el login.

Un GET a `/account.php` sin token debe responder 401. OPTIONS con origen
`http://localhost:8081` debe responder 200 con la cabecera de origen.
Errores de esquema/conexión responden 503 y se registran con el prefijo
`Account API:`; revisar el registro PHP sin compartir contraseñas ni claves.

## Ajustes que se aplican

- **Claro/Oscuro/Sistema:** se guardan por cuenta. Sistema sigue la apariencia
  del dispositivo; el tema alcanza perfil, ajustes, navegación y pantallas
  nativas existentes. Fotos y medios conservan sus colores.
- **Sonidos de mensajes:** controla los avisos locales de mensajes/radio y el
  sonido de los pushes despachados a esa cuenta. Android usa un canal separado
  `ptt-radio-silent` cuando se desactivan; el sonido real del mensaje de voz no
  se silencia. El tono de inicio PTT y las emergencias son independientes.
- **Roger Beep:** tono al finalizar una transmisión; los botones de prueba usan
  el motor real de sonido y respetan la preferencia. En nativo se usa Expo Audio
  sin cambiar la categoría de la sesión WebRTC. La sesión se conserva durante
  la escucha y los reproductores se liberan al desconectar/cerrar sesión.
- **Mantener/Alternar:** Mantener emite mientras se pulsa; Alternar inicia con
  un toque y termina con otro. Salir de PTT, perder foco, pasar a segundo plano,
  cambiar de cuenta/grupo o alcanzar el límite corta ambos modos.
- **Avisos:** se solicitan permisos reales y solo se confirma el cambio después
  de guardar. Desactivar retira los dispositivos de la cuenta; el despachador
  revisa también la preferencia antes de enviar, incluso ante un registro tardío.
  Un aviso que ya fue aceptado por el proveedor no puede retirarse.

**En navegador** los avisos de voz necesitan esta página abierta y el permiso
Notification. Pueden aparecer al minimizarla; cerrar o suspender la pestaña no
queda cubierto por Web Push/service worker en esta etapa. La pantalla explica
este alcance. **En Android/iPhone** se conserva el registro Expo Push existente:
requiere app instalada, proyecto EAS/FCM/APNs y pruebas físicas. Esta pantalla
no implementa Apple PushToTalk ni elimina el pendiente de recepción automática
cuando iOS suspende la app. Ver [PTT_DESPLIEGUE.md](PTT_DESPLIEGUE.md).

## Conexión y sesiones

El apartado de servidor está dentro de ajustes y contraído al abrir.
“Probar conexión” consulta la API sin credenciales y exige un `SELECT 1` correcto;
no muestra contadores de ejemplo ni promete audio sin servidor.
La URL se edita como borrador. Cambiarla exige confirmar, cierra la sesión del
servidor anterior y luego guarda la dirección: no reenvía el token al nuevo host.
Se permite HTTPS y HTTP solo para direcciones locales de desarrollo.
Los errores no guardan cambios a medias y las respuestas de otra sesión/servidor
se descartan. Un 401 del perfil cierra la sesión y limpia la contraseña local.

Para el proxy Node configurar `ACCOUNT_PHP_ORIGIN=https://walkiet.alwaysdata.net`
(o reutilizar `PTT_PHP_ORIGIN`). `/api/account` conserva el estado HTTP del PHP;
no simula un perfil si la configuración/BD falla. La cuenta se consulta en el
backend PHP autorizado, usando la misma sesión que login.

## Eliminación de cuenta

La ventana exige contraseña actual y escribir **ELIMINAR**. La API comprueba
ambas cosas para el titular del token. No se ejecuta ninguna eliminación real
al instalar o abrir la pantalla.

Si la cuenta administra grupos, responde 409 y conserva todo hasta resolverlos
explícitamente. Si otra FK impide borrar la cuenta, hace rollback y pide revisión
del administrador; no desactiva comprobaciones de integridad.
Cuando se confirma una eliminación válida, retira agenda privada, foto,
preferencias, membresías, sesiones y dispositivos propios, y elimina la cuenta.
Los grupos de otras cuentas se conservan. Las FK del esquema pueden eliminar
mensajes vinculados al titular; la ventana lo advierte. Los registros históricos
sin cascada se conservan conforme al esquema existente; no es una purga de
historiales operativos. Las conexiones PTT revocadas quedan para que el worker
las expulse en su siguiente barrido.

## Verificación reproducible

Usar únicamente fixtures locales; no ejecutar estos comandos contra producción.

- `CONTACTS_TEST_SOCKET=/ruta/mysql.sock php tests/fixtures/account-mysql.php`
  prepara `contacts_test_account` con tres cuentas sintéticas y ajustes previos.
- Preparar el directorio PHP temporal con `tests/fixtures/prepare-private-backend.php`,
  DSN de esa BD e iniciar PHP en `127.0.0.1:8103`.
- `ACCOUNT_TEST_BACKEND=http://127.0.0.1:8103 CONTACTS_TEST_SOCKET=/ruta/mysql.sock node tests/account-http.mjs`
  comprueba identidad, edición, validaciones, aislamiento, avatar y eliminación.
- Recrear la fixture antes de `ACCOUNT_TEST_BACKEND=http://127.0.0.1:8103 node tests/account-ui.mjs`.
  Usa el build web/preview en `ACCOUNT_UI_URL` (por defecto localhost:3001) y
  verifica los formularios, permiso de navegador, persistencia, temas y sesiones.
- `CONTACTS_TEST_SOCKET=/ruta/mysql.sock php tests/account-migration.php` comprueba
  instalación/repetición y FK con collations e IDs de texto/número.
- `WALKIET_PTT_TESTING=1 WALKIET_PTT_PUSH_TEST_URL=http://127.0.0.1:8102 CONTACTS_TEST_SOCKET=/ruta/mysql.sock php tests/account-notifications.php`
  usa el proveedor sintético de las pruebas PTT y verifica avisos silenciosos,
  sonoros y desactivados con collations heredadas. No contacta a Expo real.
- La prueba de PTT en vivo puede añadir `PTT_TEST_ACCOUNT_PREFS=1`, después de
  aplicar 005 y copiar los PHP de cuenta a su backend de pruebas, para verificar
  Alternar con audio/turnos reales y el corte al cambiar de pestaña.

Las pruebas del navegador y los bundles JavaScript no sustituyen pruebas de
cámara, audio/mezcla y notificaciones en dispositivos físicos ni builds firmados.
