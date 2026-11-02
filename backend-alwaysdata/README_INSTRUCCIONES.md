# Guía de Conexión a Base de Datos C5i Walkie-Talkie

Este paquete contiene todo lo necesario para conectar el Login y el Registro directamente con la base de datos MySQL `if0_42687378_walkt`.

---

## OPCIÓN 1: En tu Servidor InfinityFree (`http://walkt.gt.tc`)

Como InfinityFree bloquea conexiones remotas externas al puerto MySQL 3306, la forma nativa de conectar es colocar los archivos PHP en tu hosting:

### Paso 1: Subir archivos
Copia la carpeta `backend-infinityfree` a la carpeta `htdocs` de tu servidor en InfinityFree (mediante FTP o el Administrador de Archivos de cPanel):
```text
htdocs/
  ├── config.php
  └── api/
      ├── login.php
      ├── register.php
      ├── send-otp.php
      ├── verify-otp.php
      └── status.php
```

### Paso 2: Configurar la contraseña
Abre `config.php` y escribe la contraseña de tu base de datos de InfinityFree:
```php
$db_pass = 'TU_CONTRASEÑA_DE_CPANEL';
```

### Paso 3: Importar la Base de Datos
1. Entra a tu cPanel de InfinityFree -> **phpMyAdmin**.
2. Selecciona la base de datos `if0_42687378_walkt`.
3. Haz clic en la pestaña **Importar** y selecciona el archivo `database_schema.sql`.
4. ¡Listo! Las tablas `users`, `channels`, `channel_members`, `voice_messages` y `sms_otps` estarán creadas con los mandos iniciales.

---

## OPCIÓN 2: Conexión Directa desde el Servidor Node (`server.ts`)

Si tienes una base de datos MySQL en un servidor (VPS, Railway, Supabase, PlanetScale, etc.) o InfinityFree con acceso externo, configura tu archivo `.env`:

```env
DB_HOST=sql206.infinityfree.com
DB_NAME=if0_42687378_walkt
DB_USER=if0_42687378
DB_PASSWORD=tu_contraseña_aqui
DB_PORT=3306
```

El servidor Node `server.ts` se conectará automáticamente, creará las tablas si no existen, y procesará el Login y Registro directamente sobre la base de datos MySQL.
