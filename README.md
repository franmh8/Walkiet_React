# Walkiet

Aplicación de radio PTT, grupos, chat, contactos privados y perfil con Expo SDK 58,
React Native 0.88 y un servidor PHP/MySQL en Alwaysdata. La versión que comparte
el equipo está en la rama `main`.

Para la V1 se retiran los accesos de emergencia/SOS de todas las pantallas y las
llamadas telefónicas y videollamadas de chat y contactos. Se conservan la radio
PTT, los mensajes, los adjuntos y los datos de contacto. Este cambio solo requiere
actualizar la app; no necesita cambios en PHP ni SQL. Los APK ya instalados deben
recompilarse e instalarse de nuevo para reflejarlo.

La actividad de los chats usa presencia autenticada y permite ocultar la última
conexión desde Ajustes. Para instalar esta actualización, seguir la
[guía de presencia y privacidad](backend-alwaysdata/PRESENCIA_CHAT_DESPLIEGUE.md):
requiere la migración 007 y actualizar tres archivos PHP además de la app.

La [guía de reintegración del chat modular](REINTEGRACION_CHAT.md) explica cómo
actualizar conservando la sincronización y recuperar los ajustes de V1.

Para separar los mensajes por día, corregir la hora y resolver el 400 de cuenta,
seguir la [guía de fechas del chat](backend-alwaysdata/CHAT_FECHAS_DESPLIEGUE.md).
Incluye la publicación coordinada de los PHP actuales sin modificar el historial.

Las opciones de responder, reenviar, copiar, editar y eliminar al mantener presionado
un mensaje se instalan siguiendo la [guía del menú de mensajes](backend-alwaysdata/CHAT_MENSAJES_OPCIONES_DESPLIEGUE.md).
Requieren la migración 010, actualizar tres PHP y ejecutar `npm ci` en la app.

El [diseño de las ubicaciones del chat](CHAT_UBICACION_DISENO.md) usa una tarjeta
con miniatura de mapa y acceso para abrirla. Solo requiere actualizar la app.

## Actualizar un equipo existente

Desde la carpeta `Walkiet_React`, detener Expo con **Ctrl+C** y revisar primero:

```sh
git status --short
```

Si aparecen cambios locales, guardarlos en un commit propio o crear un respaldo
antes de cambiar de rama:

```sh
git stash push -u -m "respaldo-antes-de-actualizar-main"
```

Conservar ese respaldo y revisar sus diferencias antes de recuperarlo; no es
necesario borrar archivos ni descartar cambios para actualizar.

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npx expo start -c
```

Usar Node **24 LTS, versión 24.3 o posterior**, compatible con las dependencias
actuales. Conservar `package-lock.json`: `npm ci` instala las mismas versiones en
todos los equipos. Si Git informa que las ramas han divergido, revisar los commits
locales antes de continuar; no forzar la actualización.

Para un equipo nuevo:

```sh
git clone https://github.com/franmh8/Walkiet_React.git
cd Walkiet_React
npm ci
npx expo start -c
```

Pulsar **w** para probar en navegador. La radio nativa usa LiveKit y un módulo
propio de Android: necesita una compilación de desarrollo instalada; Expo Go no
incluye estos módulos. Las instrucciones y las limitaciones de segundo plano en
iOS están en la guía PTT.

## Servidor y configuración

Actualizar Git descarga el código en cada computadora. El servidor de Alwaysdata
se actualiza por separado, subiendo los PHP y aplicando las migraciones indicadas
en cada guía. Las contraseñas de MySQL, Gmail y las claves de LiveKit permanecen en
archivos privados del servidor y no se comparten mediante Git.

- [Contactos y sesiones](backend-alwaysdata/CONTACTOS_DESPLIEGUE.md)
- [Grupos](backend-alwaysdata/GRUPOS_DESPLIEGUE.md)
- [Restaurar el canal al entrar o reabrir la app](backend-alwaysdata/RESTAURAR_CANAL_GUIA.md)
- [Radio en vivo, notificaciones y proceso continuo](backend-alwaysdata/PTT_DESPLIEGUE.md)
- [Perfil y ajustes](backend-alwaysdata/PERFIL_DESPLIEGUE.md)
- [Diseño uniforme de avisos y modales](backend-alwaysdata/DIALOGOS_DISENO_GUIA.md)
- [Fotos de perfil visibles en chats y contactos](backend-alwaysdata/FOTOS_CHAT_DESPLIEGUE.md)
- [Notas de voz: grabar al mantener, enviar al soltar y reproducir](backend-alwaysdata/CHAT_VOZ_DESPLIEGUE.md)
- [Fotos del chat, zoom y guardado automático en galería](backend-alwaysdata/CHAT_FOTOS_GALERIA_DESPLIEGUE.md)
- [Verificación de correo y recuperación de acceso](backend-alwaysdata/CORREO_SEGURIDAD_DESPLIEGUE.md)
- [Envío mediante Gmail SMTP](backend-alwaysdata/SMTP_GMAIL_DESPLIEGUE.md)
- [Actualizar códigos a 3 minutos](backend-alwaysdata/ACTUALIZACION_CODIGOS_3_MINUTOS.md)

El servicio continuo de PTT requiere un alojamiento que permita mantener el
proceso en ejecución. El plan gratuito de Alwaysdata usado durante las pruebas
rechaza la creación de Servicios. La recepción de audio con iOS suspendido aún
requiere integrar Apple PushToTalk y probar una compilación nativa en dispositivos.

## Comprobaciones locales

```sh
npm run lint
npm run build
```

Las pruebas de integración están en `tests/`; sus fixtures usan bases y cuentas
sintéticas. Revisar sus variables de entorno antes de ejecutarlas.

### Entrega, lectura y envío sin conexión

Consultar [CHAT_CONFIRMACIONES_DESPLIEGUE.md](backend-alwaysdata/CHAT_CONFIRMACIONES_DESPLIEGUE.md) para aplicar la migración 008, publicar los seis PHP y actualizar las apps.
