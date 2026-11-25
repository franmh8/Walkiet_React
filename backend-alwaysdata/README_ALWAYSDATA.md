# Backend Walkiet · Alwaysdata

Los endpoints PHP activos están en este directorio. La app utiliza
`https://walkiet.alwaysdata.net` como servidor predeterminado.

`conexion.php` mantiene la conexión de la instalación; `config.php` reutiliza esa
conexión como alias de compatibilidad. `/status.php` y `/api/status.php` comparten
el mismo diagnóstico. Mantener las credenciales privadas del servidor al publicar.

## Guías de instalación y actualización

- [Publicación de archivos](INSTRUCCIONES_GESTOR_ARCHIVOS.md)
- [Instalación y conexión](README_INSTRUCCIONES.md)
- [Contactos y sesiones](CONTACTOS_DESPLIEGUE.md)
- [Canales y membresías](GRUPOS_DESPLIEGUE.md)
- [Chats persistentes de canal](CHAT_CANALES_DESPLIEGUE.md)
- [Remitentes sin guardar](CHAT_REMITENTE_DESCONOCIDO_DESPLIEGUE.md)
- [Perfil y ajustes](PERFIL_DESPLIEGUE.md)
- [Registro por correo](REGISTRO_CORREO.md)
- [Recuperación y correo](CORREO_SEGURIDAD_DESPLIEGUE.md)
- [Presencia y privacidad](PRESENCIA_CHAT_DESPLIEGUE.md)
- [Recibos y cola de mensajes](CHAT_CONFIRMACIONES_DESPLIEGUE.md)
- [Notas de voz](CHAT_VOZ_DESPLIEGUE.md)
- [Fotos y galería](CHAT_FOTOS_GALERIA_DESPLIEGUE.md)
- [Opciones de mensajes](CHAT_MENSAJES_OPCIONES_DESPLIEGUE.md)
- [Radio PTT](PTT_DESPLIEGUE.md)

Los conjuntos de PHP y las migraciones se actualizan de manera coordinada según
la guía del módulo. Mantener respaldos y verificar qué migraciones están aplicadas
antes de modificar datos. El esquema inicial no debe reimportarse sobre una
instalación con información para intentar resolver una actualización.
