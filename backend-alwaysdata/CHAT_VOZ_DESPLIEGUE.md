# Notas de voz reales en el chat

El micrófono del chat ahora graba audio real. Mantenerlo presionado inicia la
grabación y soltarlo guarda y envía el archivo; un toque breve no envía nada.
Se muestra el tiempo de grabación y se puede cancelar. Cambiar de chat, salir de
la pantalla o poner la app en segundo plano cancela la captura. El límite es un
minuto; al alcanzarlo se termina y envía la nota.

La primera vez se solicita permiso de micrófono. Si se soltó el botón mientras
aparecía el permiso, mantenerlo presionado otra vez después de autorizarlo.
En navegador se necesita HTTPS o localhost. No se graba en segundo plano.

Las notas tienen controles para reproducir/pausar y conservan las confirmaciones
de entrega/lectura. Sin internet se guardan en la cola del mismo dispositivo y
cuenta, y se reintentan al recuperar conexión. Si no queda espacio para guardar,
se ofrece reintentar o cancelar mientras la pantalla siga abierta. No borrar
los datos de la app cuando haya mensajes pendientes.

La captura del navegador se convierte a WAV mono de 12 kHz; iOS y Android usan
AAC/M4A. Ambos formatos se guardan con el mensaje. Iniciar una nota o reproducirla
desconecta la radio PTT para evitar que compitan por el micrófono y el audio.
Los mensajes anteriores que solo contenían el texto «Mensaje de Voz PTT (0:04)»
no tienen audio recuperable: se indica que el audio no está disponible, sin
borrar el historial.

## Actualizar el proyecto

Desde la Terminal del Mac, dentro del proyecto, guardar primero cualquier cambio
local y descargar la versión actual:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
```

## Publicar dos PHP en Alwaysdata

Esta actualización no añade migraciones. Requiere las tablas y los PHP de la
[actualización de confirmaciones y cola sin conexión](CHAT_CONFIRMACIONES_DESPLIEGUE.md),
incluida la migración 008, ya instalados.

Guardar una copia de los PHP actuales. Ejecutar desde la Terminal del Mac,
dentro del proyecto actualizado; primero subir el nuevo auxiliar y después el
endpoint que lo utiliza:

```sh
scp backend-alwaysdata/chat-voice.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
scp backend-alwaysdata/chat-sync.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
```

Con WebDAV, respetar el mismo orden. `chat-sync.php` requiere `chat-voice.php`
en su misma carpeta. No modificar `conexion.php` ni los archivos privados del
servidor. Descargar Git solo actualiza la computadora, no publica los PHP.

## Actualizar las apps

Para probar los chats en Expo Go:

```sh
npx expo start --go -c
```

Para una compilación de desarrollo instalada, usar
`npx expo start --dev-client -c`. La configuración incluye el permiso de
`expo-audio`; las apps nativas ya instaladas deben recompilarse para incorporar
esta configuración. Para APK de pruebas:

```sh
npx eas-cli build --platform android --profile preview
```

Actualizar ambos participantes y recargar la web. La radio nativa sigue
necesitando su compilación propia; Expo Go permite probar el chat y sus notas.

## Comprobar con dos cuentas

1. Autorizar micrófono; mantener presionado, hablar y soltar. La otra cuenta debe
   recibir una nota reproducible con la voz grabada, también después de recargar.
2. Probar el recorrido inverso y audio entre navegador, iPhone y Android.
3. Cancelar, soltar durante el permiso o pasar a segundo plano: no debe enviarse
   una nota y el indicador del micrófono debe apagarse.
4. Cortar internet, grabar y soltar, recargar y recuperar conexión: se envía una
   sola vez, conservando el audio y las palomitas.

La validación automatizada usa micrófono simulado con muestras audibles en
Chromium, reproducción real en otra cuenta, PHP/MySQL y cola sin conexión.
Las exportaciones de Expo comprueban la integración de Android/iOS, pero aún
hace falta la comprobación física con los teléfonos del equipo. El error 503
de `ptt.php` corresponde al servicio de radio y se atiende por separado.
