# Menú de mensajes del chat

Al mantener presionado un mensaje durante unos 450 ms aparece una tarjeta compacta con iconos y las opciones disponibles. Desplazar el dedo cancela la pulsación larga para conservar el scroll. En web también funciona el clic derecho o Mayús+F10; Escape o tocar fuera cierra la tarjeta. La hora del mensaje ofrece un acceso alternativo a sus opciones.

- **Responder:** muestra una cita sobre el compositor y la guarda junto al mensaje enviado. Funciona con texto y adjuntos. La cita procede del mensaje original autorizado en ese mismo chat; el servidor no acepta citas inventadas de otra conversación.
- **Reenviar:** permite elegir una conversación existente o un contacto registrado de la agenda privada. La copia pertenece a quien la reenvía, lleva «Reenviado» y conserva el contenido multimedia. No transfiere la cita ni la identidad privada del origen. Usa una referencia al mensaje original para evitar duplicar archivos grandes en la cola local y en la petición.
- **Copiar:** copia texto, enlace de ubicación o nombre de documento, según el contenido. No ofrece copiar en fotos, audios ni mensajes eliminados.
- **Editar:** solo aparece en textos propios confirmados. Conserva la hora de envío, los acuses y el borrador anterior del compositor; muestra «Editado» y sincroniza el texto con los participantes. Cancelar conserva el borrador anterior.
- **Eliminar:** «Para mí» oculta el mensaje únicamente en tu cuenta, incluidos otros dispositivos, bandeja de recepción y vista previa del chat. En mensajes propios también permite «Para todos», que sustituye el contenido por «Mensaje eliminado» y retira el archivo de la respuesta del servidor. No elimina copias ya reenviadas, descargadas o guardadas en Fotos. Los mensajes pendientes pueden quitarse de la cola de este dispositivo mientras no estén siendo enviados.

Responder y reenviar a conversaciones existentes usan la cola persistente sin conexión. Crear una conversación con un contacto nuevo, editar y eliminar mensajes confirmados requieren conexión. Si un mensaje de origen deja de estar disponible antes de confirmar un reenvío, el envío pendiente informa del error. Una referencia ya confirmada conserva su idempotencia aunque posteriormente se edite o elimine su origen.

## Publicación

1. Realizar respaldo de MySQL. Se requiere la estructura del chat y las migraciones anteriores, incluida la 008 de acuses.
2. Ejecutar **[migrations/010_chat_message_actions.sql](migrations/010_chat_message_actions.sql)** en la base de Alwaysdata. Crea `chat_message_annotations` y `chat_message_hidden`; no cambia el contenido ni las fechas del historial existente. Es repetible y conserva los tipos/collations de los IDs de mensajes y usuarios.
3. Publicar **`chat-actions.php` primero**, después `chat-receipts.php` y `chat-sync.php` de esta versión, en el mismo directorio del backend actual. Conservar las conexiones, credenciales y configuración privada del servidor.
4. Actualizar la app con `npm ci` y reiniciar Expo (`npx expo start --go -c` si se prueba con Expo Go). Se incorpora `expo-clipboard` compatible con SDK 58 para copiar en móvil. Una app nativa compilada anteriormente necesita recompilarse para incluir ese módulo; la importación diferida permite abrir la app anterior y muestra un aviso si copiar todavía no está disponible.
5. Actualizar ambos dispositivos de prueba. Verificar primero con cuentas de prueba: copia, respuesta con texto/foto/audio, edición propia, reenvío a un tercero, eliminar para mí y para todos, y reconexión tras enviar sin red.

Sin la 010, la API sigue sirviendo los chats existentes y no anuncia `messageActions`; la app muestra un aviso al intentar las nuevas operaciones. No anunciar la función como publicada hasta instalar SQL/PHP y actualizar la app. Los clientes anteriores no representan citas ni el indicador «Editado»; actualizar ambos lados permite comprobar el comportamiento completo.

## Validación de esta entrega

Pruebas automatizadas con datos sintéticos en MySQL local y dos sesiones de Chromium de 430 × 932: pulsación larga, tamaño de tarjeta, copiar al portapapeles, edición propia sincronizada, cita, foto sin abrir accidentalmente el visor, reenvío, eliminación por alcance, cancelar pendientes y enviar citas/reenvíos sin red. Pruebas HTTP de autorización de origen/destino, redacción de citas ocultas/eliminadas, adjuntos, historial, acuses e idempotencia. Migración nueva/repetida con IDs de texto/binarios y numéricos; caché invalidada al eliminar y aislamiento de la cola por cuenta. Compilación Vite/TypeScript y exportación Expo web/Android/iOS.

La exportación de paquetes no sustituye la prueba física de pulsación larga y portapapeles en iPhone/Android. No se han publicado archivos ni ejecutado SQL en producción. La ventana de historial sigue siendo los 100 mensajes más recientes que devuelve el chat actual.
