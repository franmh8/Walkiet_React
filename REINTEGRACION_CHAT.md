# Actualizar el chat modular sin perder los ajustes de V1

Se mantienen `src/native/chat/ChatController.tsx`,
`src/native/chat/ChatAttachmentsMenu.tsx` y `src/services/chatSyncApi.ts`.
La sincronización sigue utilizando el `chat-sync.php` publicado por el equipo.
Esta actualización no reemplaza ese archivo ni cambia sus tablas.

Los cambios recuperados son:

- Sin SOS, llamadas telefónicas ni videollamadas. Se conservan PTT, texto,
  notas de voz y los cuatro adjuntos del menú separado.
- Cabecera e indicadores con `usePeerPresence`. El estado antiguo `isOnline`
  de una conversación o contacto no se usa como prueba de actividad. El ajuste
  **Perfil → Configuración y ajustes → Privacidad → Mostrar última conexión**
  sigue aplicándose desde el servidor.
- Avisos de cámara, ubicación, documentos y errores del controlador con el
  mismo `TacticalDialog` de perfil, incluida su gota superior. Los callbacks de
  confirmación y la conservación del borrador al fallar un envío siguen activos.
- Restauración del canal con `useChannelSelection`, por cuenta y servidor,
  después de validar los grupos reales. Recupera el ID guardado incluso si se
  renombra el grupo. Sin preferencia local, recupera una membresía existente.
  Un error de red muestra reintento; una cuenta nueva o sin membresías muestra
  que no hay grupo. Las preferencias antiguas se leen para migrarlas.

## Instalar en los equipos

Desde la carpeta `Walkiet_React` en la Terminal del Mac, detener Expo con Ctrl+C,
revisar `git status --short` y respaldar cualquier cambio propio antes de actualizar:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npx expo start -c
```

No hay dependencias nuevas ni una migración SQL nueva para esta reintegración.
Si aún no se instaló la presencia en Alwaysdata, aplicar primero la migración
007 y los tres archivos indicados en la
[guía de presencia](backend-alwaysdata/PRESENCIA_CHAT_DESPLIEGUE.md).
No volver a ejecutar migraciones anteriores ni reemplazar `chat-sync.php` con
un archivo de otra versión.

Los APK instalados deben recompilarse con el perfil `preview` existente e
instalarse en cada teléfono:

```sh
npx eas-cli build --platform android --profile preview
```

## Comprobar entre dos cuentas

1. Iniciar sesión, abrir el canal restaurado y revisar que el contador y los
   miembros coincidan. Reiniciar y comprobar que conserva el canal elegido.
2. Abrir un chat y enviar un mensaje; verificarlo en el otro dispositivo y al
   reabrir la conversación. Probar los adjuntos desde su menú separado.
3. Minimizar la app del contacto y comprobar la última conexión. Desactivarla
   en Ajustes y verificar que la fecha se oculta. El estado online caduca si la
   app pierde conexión, como explica la guía de presencia.
4. Comprobar que ya no hay SOS ni llamadas/video en chat y contactos, y que los
   avisos propios de la app comparten el diseño del perfil.

La prueba automatizada del cliente usa un contrato controlado de `chat-sync.php`
y cuentas/presencia/contactos con PHP/MySQL local. No modifica el chat de
producción. La prueba final del endpoint publicado y de Android/iOS debe hacerse
con las apps actualizadas en los teléfonos del equipo.
