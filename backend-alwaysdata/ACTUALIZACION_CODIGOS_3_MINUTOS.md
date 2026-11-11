# Actualización: códigos de correo de 3 minutos

Guía para la instalación de Walkiet que ya envía correo mediante Gmail SMTP.
Incluye los cambios del modal de seis casillas, el correo HTML y la vigencia
del código de **180 segundos**, tanto en cambio de correo como en recuperación.

## 1. Actualizar el proyecto local

Detener Expo con **Ctrl+C**. Abrir Terminal en la carpeta `Walkiet_React`, donde
se encuentra `package.json`, y ejecutar:

```sh
git status --short
```

Si muestra modificaciones locales, guardarlas antes de actualizar (esto también
resuelve el bloqueo anterior de `package-lock.json`):

```sh
git stash push -u -m "respaldo-local-antes-de-codigos-3min"
```

El respaldo se consulta con `git stash list`; conservarlo mientras se comprueba
la actualización y revisar sus diferencias antes de recuperarlo.

Después traer la versión nueva e instalar las dependencias:

```sh
git fetch origin
git switch codex/fix-contacts-mysql-crud
git pull --ff-only origin codex/fix-contacts-mysql-crud
npm ci
```

Los cambios están en la rama del PR #1; el PR sigue sin fusionarse a `main`.

## 2. Sustituir cuatro PHP en Alwaysdata

Copiar estos archivos de `backend-alwaysdata/` a **`/home/walkiet/www/`**:

| Archivo | Función |
| --- | --- |
| `security-handler.php` | Verifica los códigos y aplica el límite de 180 segundos. |
| `security-mail.php` | Envía el mensaje HTML y texto por el proveedor configurado. |
| `security-smtp.php` | Envío SMTP de ambas versiones del mensaje mediante PHPMailer. |
| `security-mail-template.php` | Plantilla guinda con código y texto de vigencia de 3 minutos. |

Desde la raíz del proyecto se pueden subir por SSH/SFTP:

```sh
scp backend-alwaysdata/security-handler.php backend-alwaysdata/security-mail.php backend-alwaysdata/security-smtp.php backend-alwaysdata/security-mail-template.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
```

La contraseña solicitada es la del usuario **SSH de Alwaysdata**, no la clave de
aplicación de Gmail. También se pueden sustituir los cuatro archivos con un
cliente SFTP. Este método evita el problema de copia de carpetas por Finder/WebDAV.

La estructura existente debe conservarse:

```text
/home/walkiet/
├── security-config.php             ← privado, fuera de www
└── www/
    ├── conexion.php
    ├── cors.php
    ├── auth-session.php
    ├── security.php
    ├── security-handler.php         ← sustituir
    ├── security-mail.php            ← sustituir
    ├── security-smtp.php            ← sustituir
    ├── security-mail-template.php   ← subir/sustituir
    └── lib/PHPMailer/src/
        ├── Exception.php
        ├── PHPMailer.php
        └── SMTP.php
```

Conservar la configuración privada, su `code_secret`, la contraseña de aplicación
de Gmail y `conexion.php`. PHPMailer ya instalado no necesita sustituirse en esta
actualización. No requiere otra migración ni cambios SQL: se usa la tabla
`security_challenges` de la migración 006 que ya está instalada.

Si la instalación aún no tiene el servicio de correo/006, primero seguir
[CORREO_SEGURIDAD_DESPLIEGUE.md](CORREO_SEGURIDAD_DESPLIEGUE.md) y la configuración
[SMTP_GMAIL_DESPLIEGUE.md](SMTP_GMAIL_DESPLIEGUE.md).

## 3. Reiniciar la app con caché limpia

```sh
npx expo start -c
```

Para probar en navegador, pulsar **w** y recargar la página. Comprobar que aparece
“Caduca en 3 minutos” debajo de las seis casillas. Los cambios de JavaScript también
deben actualizarse en los dispositivos usados para probar la app.

## 4. Comprobar el cambio de correo

1. Iniciar sesión y abrir Perfil → Correo.
2. Introducir otro correo accesible, que no pertenezca a otra cuenta. Ya no se
   pide la contraseña actual: se exige la sesión y el código al nuevo destino.
3. Solicitar el código. El mensaje nuevo debe mostrar el diseño guinda y
   “Válido por 3 minutos”. Revisar el último mensaje de la conversación y spam.
4. Capturarlo en las seis casillas y pulsar **Validar** dentro del plazo.
5. Confirmar que se guarda el correo y que sigue actualizado después de recargar.

El contador pequeño de **reenviar** continúa en **60 segundos**. Cada reenvío
genera un código nuevo con 180 segundos e invalida el anterior. Los cinco intentos
y el uso único siguen activos.

## 5. Comprobar la caducidad sin cambiar la contraseña

1. Cerrar sesión y entrar a **Recuperar acceso**.
2. Solicitar un código con el teléfono o correo de la cuenta. El envío se hace
   al correo asociado, no por SMS.
3. Esperar **más de 3 minutos desde la solicitud** e intentar validarlo: debe
   aparecer un error y no debe abrirse el formulario de nueva contraseña.
4. Solicitar uno nuevo y validarlo dentro del plazo: debe abrirse ese formulario.
   Se puede cancelar la prueba sin guardar una contraseña nueva.

La vigencia empieza al generar el código en el servidor, no al abrir el correo.
Después de validar recuperación, la autorización para guardar una contraseña
nueva conserva su plazo de **5 minutos** y solo puede usarse una vez.

**Códigos anteriores:** los emitidos con la política de 10 minutos dejan de ser
válidos al instalar el nuevo PHP. Solicitar un código nuevo; no hay que borrar
filas ni ejecutar SQL para invalidarlos.

La radio PTT y su proceso continuo son independientes de esta actualización.

## Qué se comprobó en las pruebas locales

La suite HTTP verifica plazo almacenado de 180 segundos, aceptación dentro del
plazo, rechazo al caducar y rechazo de retos de la política anterior, con
PHP/MySQL y proveedores SMTP/OAuth controlados. También comprueba texto y HTML
con la misma vigencia. Las pruebas de navegador revisan las seis casillas,
el mensaje de tres minutos y el recorrido de cambio/recuperación.

Las migraciones, archivos y pruebas del servidor de producción los aplica el
administrador durante esta instalación; no se modificó Alwaysdata desde el PR.
