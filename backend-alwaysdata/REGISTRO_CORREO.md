# Registro con verificación por correo

El registro conserva teléfono y correo como datos de la cuenta. El código se envía
al correo escrito en el formulario usando el mismo Gmail SMTP o Gmail API que la
recuperación de acceso. No se envían SMS ni se muestra el código en la app.

## Publicación en Alwaysdata

1. Ejecutar `migrations/011_registration_email.sql` en la misma base de datos de
   `conexion.php`. Se puede repetir y no modifica las cuentas existentes.
2. Subir juntos `registration.php`, `registration-handler.php`, `register.php`,
   `send-otp.php`, `verify-otp.php`, las tres variantes de `api/` y
   `security-mail-template.php`, conservando sus directorios.
3. Conservar `cors.php`, `conexion.php`, `security-handler.php`, `security-mail.php`,
   `security-smtp.php` y `lib/PHPMailer/src/`. Son las dependencias del servicio de
   correo existente. La tabla `user_settings` debe existir (migración 005).
4. Mantener la configuración privada de correo fuera del directorio público,
   indicada por `WALKIET_SECURITY_CONFIG` o `private/security-config.php`.
   Se reutilizan `code_secret`, `gmail_sender` y las credenciales del proveedor
   configurado. No incluir secretos en la app ni en el repositorio.
5. Actualizar la app. Los clientes anteriores deben actualizarse: ya no se admite
   crear cuentas sin verificar el código de correo.

En el servidor Node de desarrollo, configurar `SECURITY_PHP_ORIGIN` con el origen
PHP (por ejemplo `https://walkiet.alwaysdata.net`). `/api/registration` y los alias
de registro delegan en ese PHP para compartir la misma base de cuentas y correo.

## Funcionamiento

`POST registration.php` recibe `action: "request"`, `email` y `phone_number`.
Solo confirma el envío si lo acepta el proveedor. Devuelve `challenge_id`,
`resend_after: 60` y `expires_in: 180`; nunca devuelve el código.

Para validar y crear la cuenta, recibe `action: "complete"`, `challenge_id`,
`code`, `correo`, `phone_number`, `name` y `password`. El código está ligado al
correo y teléfono originales, dura 3 minutos y permite hasta 5 intentos.
Reenviar reemplaza el código anterior. El consumo del código, el alta de la cuenta
y sus preferencias se confirman en una sola transacción. Un error de envío o base
de datos no crea una cuenta local de respaldo.

## Verificación local

Las pruebas usan exclusivamente `contacts_test_registration` y un proveedor de
correo controlado, sin mensajes a direcciones reales. Preparar la fixture con
`tests/fixtures/registration-mysql.php` y el backend temporal con
`tests/fixtures/prepare-private-backend.php`. Ejecutar:

```bash
REGISTRATION_TEST_BACKEND=http://127.0.0.1:8119 \
CONTACTS_TEST_SOCKET=/tmp/walkiet-registration-db.sock node tests/registration-http.mjs

REGISTRATION_TEST_BACKEND=http://127.0.0.1:8119 \
CONTACTS_TEST_SOCKET=/tmp/walkiet-registration-db.sock node tests/registration-ui.mjs
```

El proveedor controlado de `tests/fixtures/security-mail-server.mjs` escucha en
8110. El PHP temporal debe ejecutarse con `WALKIET_SECURITY_TESTING=1`, conexión
a esa base de pruebas y configuración privada sintética. Nunca usar estas
variables ni las fixtures sobre la base de producción.
