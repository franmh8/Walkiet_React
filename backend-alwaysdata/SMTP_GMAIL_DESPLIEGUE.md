# Gmail SMTP con contraseña de aplicación

La pantalla **Contraseñas de aplicaciones** de Google permite usar Gmail por
SMTP. Se admite como proveedor de los códigos de cambio de correo y recuperación.
No requiere Google Cloud, client ID, client secret ni refresh token.

## Configuración privada

1. Usar la contraseña de aplicación creada para **Walkiet**. Google la muestra
   al generarla: son 16 caracteres, a veces separados en bloques. Si ya no se
   tiene guardada, generar una nueva. No usar la contraseña normal de Gmail ni
   pegar la clave en el chat, código de la app o GitHub. Esta función requiere
   que la cuenta de Google permita contraseñas de aplicación y tenga verificación
   en dos pasos.
2. Crear o actualizar **`/home/walkiet/security-config.php`**, fuera de `www`.
   Conservar el `code_secret` aleatorio que ya se hubiera configurado. El contenido
   para SMTP es:

   ```php
   <?php
   return [
       'provider' => 'gmail_smtp',
       'code_secret' => 'TU_SECRETO_ALEATORIO_EXISTENTE',
       'gmail_sender' => 'tu-cuenta@gmail.com',
       'gmail_app_password' => 'TU_CONTRASEÑA_DE_APLICACION',
       'gmail_smtp_port' => 587,
   ];
   ```

   Sustituir los valores entre comillas y conservarlas. `gmail_sender` es el correo
   completo de la misma cuenta que generó la clave. Los espacios entre bloques de
   la contraseña de aplicación se eliminan al cargar la configuración.
   Si todavía no hay `code_secret`, generar uno con:

   ```sh
   php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
   ```

3. El servidor usa **`smtp.gmail.com:587` con STARTTLS obligatorio**, autenticación
   LOGIN y verificación del certificado. También admite configurar el número
   `465`, con TLS implícito. No hay que introducir un host SMTP en la app.
   Alwaysdata debe permitir conexión TCP saliente a ese destino/puerto y PHP
   debe tener OpenSSL. Si el puerto está bloqueado, revisar el acceso saliente con
   el proveedor; no desactivar TLS ni la validación del certificado.

## Archivos que subir

Actualizar desde la rama `codex/fix-contacts-mysql-crud` y subir a `www`:

- [security-mail.php](security-mail.php)
- [security-smtp.php](security-smtp.php)
- [security-mail-template.php](security-mail-template.php)
- [security-handler.php](security-handler.php)
- La carpeta completa **`lib/PHPMailer/`**, conservando su estructura, los tres
  archivos de `src/`, `LICENSE` y `UPSTREAM.md`.

Se incluye PHPMailer 7.2.0 de su repositorio oficial para no tener que ejecutar
Composer en el servidor. Las clases originales están sin modificar y requieren
PHP 8 o posterior.

Si aún no se instaló el flujo de correo, aplicar además la migración **006** y
subir `security.php`, `account-handler.php`, `.htaccess` y el proxy indicado en
[CORREO_SEGURIDAD_DESPLIEGUE.md](CORREO_SEGURIDAD_DESPLIEGUE.md). Si ya se aplicó 006,
**cambiar de OAuth a SMTP no requiere otra migración ni cambios de la app**.
No copiar `security-config.example.php` dentro de `www` con datos reales.

## Prueba y diagnóstico

Probar con una cuenta de prueba que tenga correo accesible:

1. En Perfil → Correo introducir la nueva dirección (requiere sesión iniciada).
2. Solicitar el código y revisar entrada/spam del nuevo correo.
3. Verificarlo y comprobar que la dirección se actualiza después de validarlo.
4. Cerrar sesión → Recuperar acceso. Introducir teléfono o correo de la cuenta;
   el mensaje llega al correo asociado, no por SMS.

Los mensajes incluyen una plantilla HTML guinda y texto plano equivalente.
El servicio conserva los límites, caducidad, cinco intentos y uso único de los
códigos. Un fallo SMTP mantiene los datos anteriores. Aceptación SMTP significa
que Gmail recibió el mensaje para entrega, no que el destinatario ya lo leyó.

Los registros PHP muestran solo una categoría técnica:

- `mail_smtp_auth_failed`: revisar correo remitente y contraseña de aplicación.
  Puede haber sido revocada; Google también revoca estas claves al cambiar la
  contraseña de la cuenta.
- `mail_smtp_tls_failed`: revisar OpenSSL y certificados de confianza del servidor.
- `mail_smtp_delivery_failed`: revisar acceso saliente, cuotas/restricciones de
  Gmail y registros del alojamiento.

No compartir la contraseña al enviar registros. Una cuenta Workspace puede tener
restricciones del administrador. Siguen aplicando los límites de envío de Gmail.

La instalación sin `provider` conserva el modo anterior `gmail_api`. Para volver
a él, configurar `provider => 'gmail_api'` y las credenciales OAuth de la guía
general. No se cambia automáticamente de proveedor si falla la autenticación.

## Validación local

`tests/fixtures/security-smtp-server.mjs` implementa SMTP local con STARTTLS,
autenticación y un certificado de prueba. No reenvía a Gmail ni a destinatarios.
Configurar certificado/clave sintéticos fuera del repo mediante
`WALKIET_SMTP_TEST_CERT` y `WALKIET_SMTP_TEST_KEY`.

El backend de pruebas local (8116) requiere `WALKIET_SECURITY_TESTING=1`, DSN
de `contacts_test_security`, configuración SMTP sintética y `WALKIET_SMTP_TEST_CA`.
Solo con las guardas de pruebas se sustituye el host por 127.0.0.1:8114 y se añade
esa CA. La comprobación TLS sigue activa. Ningún cliente puede elegir el host,
la CA o desactivar TLS en una petición.

La suite `tests/security-http.mjs` acepta `SECURITY_TEST_MAIL=smtp` y
`SECURITY_TEST_BACKEND=http://127.0.0.1:8116`, además de `CONTACTS_TEST_SOCKET`.
Cubre los dos flujos, fallos de autenticación/entrega y autenticación solo tras
TLS. `tests/security-smtp.php` añade los casos de CA no confiable y STARTTLS
no disponible; requiere `WALKIET_SMTP_TEST_BAD_CA` con otro certificado sintético
y comprueba que no se envía AUTH ni se entrega el mensaje en esos casos.
La entrega real en Gmail debe comprobarse con la clave privada al instalar;
no se crearon ni usaron credenciales reales en estas pruebas.
