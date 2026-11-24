# Chats compartidos de canales

Cada canal tiene una sola conversación en **Chat → Grupos**, compartida por sus integrantes. Aparece aunque todavía esté vacía. Los canales existentes se recuperan al consultar los chats; crear un canal o unirse por PIN/QR incorpora al usuario a su conversación. Cambiar la sintonía conserva los chats y sus mensajes en MySQL, también al reiniciar la app o usar otro dispositivo.

## Actualizar Alwaysdata

1. Subir juntos `chat-channels.php` (nuevo), `chat-sync.php`, `chat-actions.php` y `channels-handler.php` a la carpeta que contiene `conexion.php`. Conservar la conexión y las credenciales actuales. `channels.php` y `api/channels.php` siguen usando el mismo handler.
2. Ejecutar `migrations/012_channel_group_chats.sql` en la misma base de datos que contiene `channels`, `channel_members`, `chat_threads`, `chat_thread_members` y `chat_thread_messages`. Se puede repetir; no borra conversaciones ni mensajes. Requiere las migraciones previas ya utilizadas por el chat. También agrega `seen_at` si la instalación de 008 aún no tiene el campo usado por el contador de mensajes no leídos, conservando las lecturas confirmadas.
3. Actualizar la app. Al abrirla se recuperan los canales de la cuenta y aparecen sus conversaciones en Chat → Grupos. Sintonizar otro canal actualiza inmediatamente la lista sin cerrar un chat abierto.

Los grupos manuales y chats privados se conservan por separado. Cambiar de canal conserva membresías; **Salir del grupo** sí revoca el acceso a su conversación. Volver a unirse recupera el mismo chat e historial. Eliminar un canal revoca el acceso de todos; no se eliminan automáticamente sus mensajes. Un grupo manual antiguo con el mismo nombre no se fusiona automáticamente, pues sus participantes podrían ser distintos.

## Validación local

Con la fixture sintética `contacts_test_account`, el backend local en `127.0.0.1:8103` y `CONTACTS_TEST_SOCKET` apuntando a su socket, ejecutar `node tests/channel-chat-http.mjs`. Comprueba autorización, concurrencia, persistencia, migración repetible, grupos existentes/nuevos y bajas. La prueba de interfaz `tests/channel-chat-ui.mjs` usa el mismo backend y una compilación local de la app; nunca ejecutarlas contra producción.
