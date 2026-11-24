# Tarjeta de remitente sin guardar

Actualizar `chat-sync.php` en Alwaysdata y descargar la versión nueva de la app. Este cambio no requiere SQL nuevo. Mantener los auxiliares y las migraciones que ya utiliza el servicio (incluida 012 para chats de canal).

En conversaciones privadas, si el interlocutor ya envió mensajes y no está en la agenda del usuario, la app muestra su foto disponible, teléfono, nombre registrado, indicativo, unidad y cantidad de canales en común. Los chats de personas sin guardar muestran el teléfono tanto en la lista principal como en la cabecera; la búsqueda acepta el número con o sin espacios y prefijo. Los contactos guardados conservan su nombre o apodo. Los canales comunes se calculan con las membresías actuales del servidor, sin duplicar los chats vinculados a ellos.

«Añadir a contactos» permite elegir un nombre o apodo antes de guardar en la agenda privada. La tarjeta desaparece y la cabecera usa el apodo; el perfil registrado del compañero no se modifica. Los errores conservan el formulario y permiten reintentar. Mientras está abierto el formulario no se confirman como leídos los mensajes cubiertos.

La condición de contacto se consulta en toda la agenda de la cuenta, no en la página de 50 contactos cargada en el teléfono. Los datos nuevos solo se devuelven para los participantes de sus propias conversaciones. Los grupos y chats con mensajes exclusivamente salientes no muestran la tarjeta. Una app nueva conectada a un PHP anterior sigue mostrando el chat sin la tarjeta hasta actualizar el archivo.

Validado con `npm run lint`, `npm run build`, `tests/chat-unknown-sender-http.mjs` y `tests/chat-unknown-sender-ui.mjs` contra el backend PHP/MySQL local con cuentas sintéticas. No ejecutar las fixtures contra producción.
