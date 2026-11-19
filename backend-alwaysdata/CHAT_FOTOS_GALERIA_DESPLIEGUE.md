# Fotos sin leyenda, visor con zoom y galería

Las fotos de cámara y biblioteca se envían sin texto automático. La burbuja
muestra la imagen con hora y, para el remitente, sus confirmaciones. Las leyendas
automáticas de mensajes anteriores también se ocultan al mostrarlos; no se borran
mensajes ni se modifica el texto del historial en la base de datos.

Tocar una foto abre el visor completo. Permite pellizcar, arrastrar al ampliar,
hacer doble toque, usar +/− o restablecer el tamaño. Atrás/Cerrar sale del visor;
en navegador también funcionan la rueda y Escape. Guardar crea una copia en
Fotos en el teléfono; Descargar solicita una descarga manual en navegador.

## Guardado automático

En **Perfil → Configuración y ajustes → Fotos del chat → Guardar fotos
automáticamente**, cada cuenta puede activar o desactivar la opción. Está activa
por defecto al instalar la migración, pero la escritura requiere el permiso del
sistema para añadir fotos. La app espera a cargar la preferencia antes de iniciar
el guardado. Un servidor anterior sin esta función no activa el guardado.

- Se aplica a las fotos nuevas que la app recibe y a las capturadas con la cámara
  del chat mientras la opción está activa. No vuelve a copiar las seleccionadas
  de la biblioteca ni guarda el historial al abrir una conversación.
- Se registra por cuenta, servidor y dispositivo qué imágenes ya se guardaron,
  para evitar duplicados al recargar, reconectar o repetir una entrega. El registro
  recuerda las últimas 5.000; no contiene fotos ni tokens. Borrar datos de la app
  elimina ese registro. No puede hacerse una transacción atómica entre Fotos y
  ese registro si el sistema cierra la app durante el guardado.
- Apagar la opción evita nuevos guardados automáticos, sin borrar las imágenes
  existentes de Fotos o del chat. Guardar manualmente desde el visor sigue disponible.
- Si se deniega el permiso no se insiste en cada mensaje ni se interrumpe el envío.
  La foto queda en el chat; se puede conceder permiso en los ajustes del teléfono
  y usar Guardar en el visor. Tampoco se simula éxito cuando falta espacio.
- La preferencia se guarda en la cuenta y se sincroniza al iniciar sesión/cargar
  el perfil. Los permisos de Fotos y las copias guardadas pertenecen a cada teléfono.
- En navegador no existe escritura automática en la galería del móvil: no se
  descargan archivos por recibir/abrir fotos. Se usa Descargar de forma explícita.
- El guardado ocurre cuando la app recibe la imagen, sin prometer ejecución con
  la app cerrada. No importa imágenes de otras cuentas que usen el mismo teléfono.

## 1. Actualizar el proyecto

Desde la Terminal del Mac, dentro de Walkiet_React, guardar primero cualquier
cambio local y descargar la versión nueva:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
```

Se añade expo-media-library compatible con SDK 58. Conservar package-lock.json.

## 2. Aplicar la migración 009 en Alwaysdata

Respaldar la BD y ejecutar en phpMyAdmin, sobre la misma BD de conexion.php:

`backend-alwaysdata/migrations/009_chat_photo_gallery.sql`

Solo crea account_media_preferences, con los tipos y collations de users.id.
Puede repetirse sin sobrescribir preferencias ni importar cuentas. No borra fotos,
no altera mensajes ni modifica los ajustes existentes. Requiere el despliegue de
perfil/chat anterior, incluidas las migraciones 005, 007 y 008.

## 3. Publicar los PHP

Ejecutar desde la Terminal del Mac, en el proyecto actualizado. Guardar antes una
copia de los archivos actuales. Subir primero el manejador y después el endpoint:

```sh
scp backend-alwaysdata/account-handler.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
scp backend-alwaysdata/account.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
```

No cambiar conexion.php ni configuraciones privadas. El health de account.php
anuncia autoSavePhotos cuando la tabla está disponible. Si falta 009, el perfil
sigue disponible y guardar esa preferencia devuelve un aviso que nombra la migración.

## 4. Actualizar las apps

Para Expo Go, actualizar Expo Go a la versión compatible con el proyecto y ejecutar:

```sh
npx expo start --go -c
```

Recargar ambos participantes. Las apps nativas ya instaladas requieren una nueva
compilación para incluir expo-media-library y el permiso de añadir fotos. Para APK
con el perfil de pruebas existente:

```sh
npx eas-cli build --platform android --profile preview
```

Para la compilación de desarrollo instalada, usar npx expo start --dev-client -c
una vez reconstruida. Actualizar JavaScript solamente no añade un módulo nativo
a un APK anterior.

## Comprobar en los teléfonos

1. Autorizar cámara, tomar/enviar una foto y comprobar que no tiene leyenda.
2. Recibirla en la otra cuenta, abrirla, ampliar y moverla. Confirmar que la copia
   aparece en Fotos después de autorizar añadir imágenes.
3. Reabrir/reconectar: no debe crear otra copia automáticamente.
4. Desactivar Guardar fotos automáticamente, recibir/tomar otra foto y verificar
   que sigue en el chat y no se añade a Fotos. Recargar: la opción sigue apagada.
5. Rechazar el permiso o probar sin espacio: el mensaje se conserva y el fallo
   de galería no se confunde con un error de envío. Guardar desde el visor permite
   volver a intentarlo cuando se haya resuelto el permiso/espacio.

Las pruebas automatizadas cubren cámara simulada, envío sin leyenda, recepción,
zoom/pellizco/arrastre/descarga en Chromium, preferencias PHP/MySQL, deduplicación,
permisos y limpieza con un sistema de galería simulado. Las exportaciones de Expo
verifican web/Android/iOS. Falta la comprobación de escritura real en Fotos y de
los gestos nativos en iPhone y Android físicos.
