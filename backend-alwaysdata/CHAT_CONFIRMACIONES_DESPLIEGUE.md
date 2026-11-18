# Entregas, lecturas privadas y mensajes sin conexión

Esta actualización requiere publicar el servidor y actualizar las apps de todos
los participantes. Las versiones anteriores no envían acuses y sus mensajes
permanecerán con una palomita hasta que una app actualizada los reciba.

## Comportamiento

- **Pendiente de envío**: quedó guardado en este dispositivo y todavía no hay
  confirmación del servidor. Se reintenta al recuperar internet o volver a abrir
  la app, sin duplicar el mensaje aunque se pierda la respuesta del primer envío.
- **Una palomita gris**: el servidor guardó el mensaje, falta el acuse del receptor.
- **Dos grises**: la app del destinatario recibió y confirmó el mensaje. Estar
  «en línea» por sí solo no cuenta como entrega.
- **Dos verdes**: el destinatario vio la burbuja en el chat abierto y comparte
  confirmaciones. Estar en PTT, en otro chat o con la app en segundo plano no lee.
- En grupos, las dos palomitas requieren el acuse de **todos los demás miembros**.
  Si alguno oculta sus lecturas, el mensaje puede quedar entregado sin verse verde.

En **Perfil → Configuración y ajustes → Privacidad → Confirmaciones de lectura**
cada cuenta puede desactivarlas. La API también oculta lecturas ya registradas
mientras está apagado y no registra las nuevas. Activarlo después no publica
lo que se leyó mientras estaba desactivado; volver a ver esa burbuja con la opción
activa sí puede confirmarla. La opción de última conexión es independiente.

El encabezado muestra **Última vez hoy/ayer/fecha a las…** si hay un registro
permitido. Sin registro o con última conexión oculta, no muestra «desconectado»
ni inventa una fecha. La actividad se comparte también entre participantes del chat.

La cola se guarda por cuenta y servidor en el dispositivo, sin guardar el token.
Sobrevive a recargar/cerrar la app y se reanuda al entrar en la misma cuenta.
No se comparte con otras cuentas ni con otros dispositivos. Borrar datos de la
app o desinstalarla elimina los pendientes. Hay un límite de 30 pendientes y
el espacio disponible del dispositivo; si no puede guardarlo, conserva el borrador
y muestra el error. Adjuntos y texto usan la misma cola. Los errores permanentes
(por ejemplo, ya no pertenecer al chat) muestran **No enviado** para reintentar.

## 1. Descargar main en el Mac

Desde la Terminal del Mac, dentro de `Walkiet_React`, revisar/respaldar cambios
locales antes de cambiar de rama:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
```

## 2. Aplicar la migración en Alwaysdata

Respaldar la BD y ejecutar en phpMyAdmin, en la misma BD de `conexion.php`:

`backend-alwaysdata/migrations/008_chat_receipts.sql`

Requiere 005/007 y las tablas de `chat-sync.php` ya existentes. Crea únicamente
`account_read_privacy` y `chat_message_receipts`. Es repetible: no borra mensajes,
no desplaza sus fechas ni inventa estados para el historial. Conserva los tipos
y collations de los IDs existentes. No importar una BD de pruebas ni recrear chats.

## 3. Subir seis PHP

Guardar una copia de los PHP actuales. Ejecutar **en la Terminal del Mac**, desde
el proyecto actualizado, no dentro de la consola SSH de Alwaysdata:

```sh
scp backend-alwaysdata/chat-time.php backend-alwaysdata/chat-receipts.php backend-alwaysdata/account-presence.php backend-alwaysdata/account-handler.php backend-alwaysdata/account.php backend-alwaysdata/chat-sync.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
```

Por WebDAV, cargar primero `chat-time.php`, `chat-receipts.php` y
`account-presence.php`, después los otros tres. No reemplazar `conexion.php`
ni configuraciones privadas.

```sh
curl -sS https://walkiet.alwaysdata.net/account.php -H 'Content-Type: text/plain' --data '{"action":"health"}'
```

Debe incluir `readReceipts` en `features`. Con sesión autenticada, la respuesta
`threads` del chat debe incluir `receipts` e `idempotentSend` en `features`.
La app conserva los pendientes hasta que el servidor confirme el contrato nuevo.

## 4. Actualizar todas las apps

```sh
npm ci
npx expo start -c
```

Recargar la web. Para teléfonos con APK instalado, generar e instalar una nueva
compilación en cada equipo:

```sh
npx eas-cli build --platform android --profile preview
```

## 5. Verificar con dos cuentas

1. Cerrar la app del receptor y enviar: debe quedar una palomita.
2. Abrir la otra app en PTT: debe pasar a dos grises; abrir el chat y ver el
   mensaje: dos verdes. Al leer historial, las burbujas fuera de pantalla no se leen.
3. Apagar confirmaciones en el receptor, recargar y comprobar que persiste.
   Los mensajes recibidos y vistos con esa opción quedan en dos grises.
4. Activar modo avión en el emisor, escribir/enviar y recargar la app: el mensaje
   sigue pendiente. Recuperar conexión: se envía una sola vez.
5. Poner al receptor en segundo plano: el encabezado muestra su última vez si
   existe y está permitida; el cierre abrupto caduca la presencia en hasta 45 s.

Los acuses se sincronizan aproximadamente cada 4 s con la app abierta; la cola
reintenta cada 5 s y al recuperar conexión. No promete recepción con la app
cerrada ni ejecuta un servicio de fondo. El 503 del servicio PTT es independiente.
