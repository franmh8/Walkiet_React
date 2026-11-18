# Fechas, hora local y desplazamiento de los chats

Esta actualización conserva el controlador y el menú de adjuntos separados.
Recupera la fecha completa del mensaje y muestra separadores **Hoy**, **Ayer**
o la fecha del día en el teléfono/navegador. La hora se convierte desde un
instante UTC; no se resta un número fijo de horas.

`chat-sync.php` se incluye ahora en el repositorio, a partir del código publicado
por el equipo. Conserva los participantes, chats directos, grupos y adjuntos.
No borra conversaciones ni modifica la fecha de los mensajes existentes.
La confirmación de envío y las siguientes lecturas devuelven la misma fecha
persistida, con zona explícita.

## Por qué aparecía el 400 de account.php

La respuesta **«Operación de cuenta no disponible.»** indica que el handler
publicado aún no reconoce una acción que la app ya utiliza (presencia o fotos).
El cambio #7 volvió a conectar la presencia del chat, por eso hizo visible la
incompatibilidad. No se arregla borrando cuentas, contactos ni sesiones.

Hay que publicar juntos los archivos actuales de cuenta indicados abajo.
Además, la app normaliza los IDs a cadenas y deja de repetir una operación que
el servidor identifica expresamente como no disponible. Después de actualizar
el PHP, recargar la app reinicia la comprobación.

## 1. Actualizar el proyecto en el Mac

Detener Expo con Ctrl+C, revisar `git status --short` y respaldar cambios locales.
Desde la carpeta `Walkiet_React`:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
```

## 2. Comprobar la instalación de presencia

La presencia requiere la migración existente
[007_chat_presence.sql](migrations/007_chat_presence.sql), después de 002 y 005.
Si aún no se aplicó, ejecutarla en phpMyAdmin en la BD de `conexion.php`.
Crea `account_presence` y `account_privacy` sin importar ni borrar usuarios.
Es repetible y conserva los datos existentes.

**La corrección de fechas del chat no requiere una migración nueva.**
No volver a crear las tablas de chat ni ejecutar SQL para desplazar sus fechas.

## 3. Publicar los cinco archivos PHP

Guardar una copia del `chat-sync.php` y de los archivos de cuenta actuales.
En la Terminal **del Mac**, dentro del proyecto actualizado:

```sh
scp backend-alwaysdata/chat-time.php backend-alwaysdata/account-presence.php backend-alwaysdata/account-handler.php backend-alwaysdata/account.php backend-alwaysdata/chat-sync.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
```

Por WebDAV, ponerlos juntos dentro de `www`, cargando primero `chat-time.php`
y `account-presence.php`. No reemplazar `conexion.php`, las credenciales ni la
configuración privada de correo/radio.

Para verificar la versión de cuenta sin compartir una sesión:

```sh
curl -sS https://walkiet.alwaysdata.net/account.php -H 'Content-Type: text/plain' --data '{"action":"health"}'
```

La respuesta debe incluir `success: true`, `database: true` y `features` con
`avatars`, `presence` y `showLastSeen`. Si no aparece `features`, comprobar
la carpeta del sitio y que se reemplazó `account.php` en esa instalación.

## 4. Zona de los datos del chat

El helper consulta el tipo real de `chat_thread_messages.created_at`:

- **TIMESTAMP**: consulta el instante Unix de MySQL y lo devuelve en UTC, sin
  cambiar la zona de conexión ni actualizar los instantes históricos.
- **DATETIME**: conserva la hora original del almacenamiento. Para el despliegue
  Alwaysdata existente se utiliza `Europe/Paris`, coherente con la diferencia
  observada de 17:33 a 10:33 en México. Los envíos nuevos usan esa misma zona.
  Un servidor con datos guardados en otra zona puede definir la variable
  `WALKIET_CHAT_STORAGE_TIME_ZONE` con su zona IANA real, por ejemplo `UTC`.

La API entrega `sent_at` en UTC con microsegundos y mantiene `created_at`.
La app da prioridad a esa fecha completa y usa la zona del dispositivo para
la hora y los días. Durante la actualización admite también el `created_at`
del PHP anterior de `walkiet.alwaysdata.net`, interpretado como París.
Una hora aislada sin fecha no permite reconstruir un día; no se inventan fechas
para respuestas incompletas de otros servidores.

## 5. Actualizar las apps

```sh
npx expo start -c
```

Recargar el navegador después de publicar todos los PHP. Los APK instalados
requieren una nueva compilación e instalación en cada teléfono:

```sh
npx eas-cli build --platform android --profile preview
```

## 6. Verificación

1. Abrir una conversación con mensajes de distintos días: debe separar Hoy,
   Ayer y fechas anteriores, usando el día local incluso cerca de medianoche.
2. Comprobar que 17:33 en París durante noviembre aparece como 10:33 en un
   teléfono configurado en Ciudad de México. Otro dispositivo usa su propia zona.
3. Abrir una conversación larga: aparece al final. Al recibir estando abajo o
   enviar un mensaje, sigue el contenido nuevo. Al leer mensajes anteriores,
   conserva la posición y ofrece **Mensajes nuevos** para volver al final.
4. Verificar que desaparece el 400 de cuenta y que la privacidad de última
   conexión sigue funcionando.

El **503 de ptt.php** que también aparece en la captura es independiente:
corresponde al servicio de radio. Estos cambios no inician el worker de PTT.
