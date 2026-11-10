# Correo verificado y recuperación de contraseña

El perfil ya no muestra Rol ni Unidad. Los campos existentes en la BD se
conservan. Los controles de ajustes usan guinda y sus variantes para modo oscuro.

El envío admite **Gmail SMTP con contraseña de aplicación** y **Gmail API con
OAuth**, desde una cuenta remitente del servidor. Para la pantalla de contraseñas
de aplicación de Google, seguir [SMTP_GMAIL_DESPLIEGUE.md](SMTP_GMAIL_DESPLIEGUE.md):
no necesita los pasos OAuth de abajo.
No usa una API key, no inicia sesión con Google al usuario y no envía SMS.
La integración está implementada; cada instalación debe autorizar su remitente.
Sin configuración válida responde 503 y no simula un envío.

## 1. Preparar Google (opción Gmail API/OAuth)

1. Entrar con la cuenta que enviará los correos en
   [Google Cloud Console](https://console.cloud.google.com/), crear o seleccionar
   un proyecto y habilitar [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com).
2. En **Google Auth Platform** configurar nombre y correo de soporte del proyecto,
   audiencia y cuenta de prueba. Para pruebas añadir la cuenta remitente a los
   usuarios de prueba. En acceso a datos agregar únicamente el permiso
   `https://www.googleapis.com/auth/gmail.send`.
3. Crear un cliente OAuth de tipo **Aplicación web**. Para obtener inicialmente
   la autorización con OAuth Playground, agregar esta URI de redirección exacta:
   `https://developers.google.com/oauthplayground`.
4. Abrir [OAuth Playground](https://developers.google.com/oauthplayground), entrar
   en su engrane de configuración, activar **Use your own OAuth credentials** e
   introducir el ID y secreto del cliente anterior. No usar las credenciales
   predeterminadas de Playground para la instalación.
5. Autorizar el scope `https://www.googleapis.com/auth/gmail.send` con la cuenta
   remitente. Intercambiar el código de autorización y conservar el
   **refresh token**. El access token temporal no se copia a la configuración:
   PHP obtiene uno nuevo al enviar.
6. El correo de `gmail_sender` debe ser el de esa cuenta autorizada. En Google
   Workspace, el administrador puede tener que permitir la aplicación.

Mantener estos datos privados. No subir capturas con secretos ni publicarlos en
GitHub. Si Google mantiene la aplicación externa en estado **Pruebas**, el
refresh token puede caducar a los siete días; para uso continuo revisar el estado
de publicación y los requisitos de consentimiento/verificación de Google.
También aplican las cuotas de Gmail y los límites de la cuenta remitente.

## 2. Archivo privado en Alwaysdata

Copiar [security-config.example.php](security-config.example.php) como:

```text
/home/walkiet/security-config.php
```

Debe quedar **al lado de `www`, fuera de ella**, igual que la configuración privada
de radio. También admite `/home/walkiet/private/security-config.php` o una ruta
absoluta indicada por la variable del servidor `WALKIET_SECURITY_CONFIG`.
El archivo no se sirve al navegador.

Completar los valores **entre las comillas**, conservándolas:

```php
<?php
return [
    'provider' => 'gmail_api',
    'code_secret' => 'VALOR_ALEATORIO_PROPIO',
    'gmail_client_id' => 'ID_CLIENTE_OAUTH',
    'gmail_client_secret' => 'SECRETO_CLIENTE_OAUTH',
    'gmail_refresh_token' => 'REFRESH_TOKEN_DE_LA_CUENTA',
    'gmail_sender' => 'remitente@tu-dominio.com',
];
```

Generar `code_secret` en una terminal con PHP:

```sh
php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
```

No reutilizar contraseñas ni claves LiveKit para este valor. Cambiarlo invalida
los códigos pendientes. PHP necesita HTTPS saliente hacia
`oauth2.googleapis.com` y `gmail.googleapis.com`, mediante cURL o streams HTTPS
con OpenSSL y `allow_url_fopen`. No desactivar la validación TLS.

## 3. BD y archivos públicos

1. Aplicar completa [006_email_security.sql](migrations/006_email_security.sql)
   en la BD de `conexion.php`, después de las migraciones 002 y 005.
   Puede repetirse: no copia usuarios ni borra información. Los IDs son
   compatibles con texto/número y conservan la collation de `users.id`;
   CHAR puede inferirse como VARCHAR compatible para la FK.
2. Subir a `www`:
   - [security.php](security.php)
   - [security-handler.php](security-handler.php)
   - [security-mail.php](security-mail.php)
   - Para SMTP: [security-smtp.php](security-smtp.php) y la carpeta `lib/PHPMailer/`
     completa, con clases y licencia.
   - [account-handler.php](account-handler.php) actualizado: bloquea cambiar el
     correo con el endpoint antiguo para evitar saltarse la verificación.
   - [.htaccess](.htaccess) actualizado y [api/security.php](api/security.php) si
     se usan los proxies `/api/*.php`.
3. Conservar `conexion.php`, `auth-session.php` y `cors.php`; no sustituirlos por
   los de las pruebas. Actualizar la app desde la rama del PR y reiniciar Expo
   con `npx expo start -c`.

El perfil y estos correos no requieren el worker de radio.
En desarrollo Node, configurar `SECURITY_PHP_ORIGIN` con el origen PHP autorizado;
puede reutilizar `ACCOUNT_PHP_ORIGIN` o `PTT_PHP_ORIGIN`. `/api/security` conserva
estados HTTP, no sigue redirecciones y solo reenvía el Bearer en cambios de correo.

## 4. Comportamiento

- **Cambiar correo:** exige sesión y contraseña actual. Envía un código al
  nuevo destino y conserva el correo anterior hasta verificarlo. El reto queda
  ligado a cuenta, sesión, propósito y dirección; no se puede verificar desde
  otra sesión ni sustituir el destino después de solicitarlo. Una dirección ya
  registrada se rechaza. El cambio invalida la recuperación pendiente al correo
  anterior. No se permite vaciar el correo desde el perfil.
- **Recuperar acceso:** admite teléfono o correo de la cuenta. Siempre envía al
  correo guardado; un teléfono es un identificador, no un envío por SMS. Si no
  existe la cuenta o no tiene correo asociado, muestra la misma respuesta
  genérica y no expone datos de usuarios. En ese último caso se necesita ayuda
  del administrador para vincular un correo tras comprobar la identidad.
- El código abre el menú de nueva contraseña solo si PHP lo verifica. Después
  se emite una autorización aleatoria de un uso, válida por cinco minutos, que
  el servidor exige para guardar. La nueva contraseña requiere al menos ocho
  caracteres, hasta 72 bytes y sin espacios al inicio/final. No se devuelve ni
  rellena en el login.
- Un cambio de contraseña invalida el resto de retos, revoca todas las sesiones
  y restablece el bloqueo temporal por intentos de login, si existen esos campos.
  La recepción PTT de una sesión retirada depende del siguiente
  barrido del worker, como en el cierre/revocación existentes.
- Códigos de seis dígitos generados con `random_int`, guardados solo como HMAC,
  caducidad de diez minutos y máximo cinco intentos. Reenvío cada 60 segundos,
  máximo cinco solicitudes por identificador/destino introducido por hora,
  20 por IP/hora y 60 verificaciones por
  IP/hora. Cambiar de pantalla no elimina los límites del servidor. Reenviar
  invalida los códigos/autorizaciones anteriores del mismo propósito.
- No hay códigos locales, códigos maestros, autocompletado de prueba ni éxito
  cuando la red falla. Las respuestas van con `Cache-Control: no-store`.

El envío confirma aceptación de Gmail API; eso no demuestra que el destinatario
ya haya recibido/leído el mensaje. Revisar spam y que el remitente sea el
autorizado. En recuperación, un fallo de entrega conserva la respuesta genérica
para no revelar si existe una cuenta. En cambio de correo se muestra el fallo y
se conserva la dirección anterior.

Con PHP-FPM se finaliza la respuesta genérica de recuperación antes de contactar
Gmail, tanto para cuentas existentes como para solicitudes señuelo. El mismo
proceso termina el envío después; no necesita un servicio continuo. Si no existe
`fastcgi_finish_request` (por ejemplo, servidor PHP local de pruebas), se usa el
envío síncrono: el cuerpo sigue siendo genérico, pero la latencia puede diferir.
No se guardan códigos en claro ni en una cola pública.

## 5. Diagnóstico y limpieza

`Security Mail: mail_provider_http_401` suele indicar autorización OAuth retirada
o caducada; revisar el refresh token. Un 403 puede corresponder a scope/API
deshabilitada o restricciones de Workspace. Revisar la consola de Google sin
compartir secretos. Otros errores de envío mantienen el correo y contraseña
actuales. `Security API: operation_failed` indica revisar la migración/configuración
y el servicio PHP. Los logs no incluyen código, correo, contraseña ni tokens.

OPTIONS a `/security.php` desde localhost:8081 debe devolver 200 con CORS.
Nunca probar cambiando directamente datos reales sin conservar acceso al correo.
Para la primera prueba usar una cuenta de prueba y verificar que llega el código.

Programar diariamente esta limpieza en la misma BD (repetir por lotes si hace
falta). No depende de mantener un proceso continuo:

```sql
DELETE FROM security_challenges
WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY LIMIT 1000;
DELETE FROM security_rate_limits
WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY LIMIT 1000;
```

Las búsquedas principales usan PK/índices por cuenta/propósito y vencimiento.
Eliminar una cuenta elimina sus retos mediante FK. Los contadores solo guardan
claves HMAC de destino/IP, sin esos valores en claro.

## Pruebas reproducibles

Solo en BD sintéticas locales; nunca contra producción:

- `tests/fixtures/security-mysql.php`: prepara `contacts_test_security`, a partir
  de la fixture de perfil. Requiere `CONTACTS_TEST_SOCKET`.
- `tests/fixtures/security-mail-server.mjs`: servidor HTTP local 8110 que valida
  intercambio OAuth y MIME Gmail sin enviar correo externo.
- Preparar PHP con `tests/fixtures/prepare-private-backend.php` y DSN de esa BD.
  Iniciarlo en 8111 con `WALKIET_SECURITY_TESTING=1`, `WALKIET_SECURITY_CONFIG`
  apuntando a credenciales sintéticas y `CONTACTS_TEST_DSN` de `contacts_test_`.
  La sustitución de destinos OAuth/Gmail solo se habilita con ambas guardas;
  ninguna petición de la app puede activarla.
- `SECURITY_TEST_BACKEND=http://127.0.0.1:8111 CONTACTS_TEST_SOCKET=/ruta/mysql.sock node tests/security-http.mjs`
  verifica identidad, códigos, caducidad, reenvío, límites, uso único, errores y
  revocación; `tests/security-migration.php` prueba IDs/collations y repetición.
- `tests/security-ui.mjs` comprueba con Chromium y PHP/MySQL reales el cambio de
  correo, recuperación, persistencia, errores y color guinda. Configurar las
  mismas variables, `SECURITY_UI_URL` y los binarios Playwright/Chromium locales.

Estas pruebas verifican el código y el protocolo con un proveedor controlado.
La autorización de Google y la entrega real se comprueban al completar los pasos
1 y 2 en la instalación. No se crearon credenciales de Google ni se modificó
Alwaysdata desde este cambio.
