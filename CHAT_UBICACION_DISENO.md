# Ubicaciones en el chat

Las ubicaciones se presentan en una tarjeta compacta de 264 px como máximo, con miniatura del mapa, pin, «Ubicación compartida», coordenadas en una segunda línea y acceso «Abrir en mapa». Mantiene la hora, los acuses, la cita/reenvío si corresponde y el menú al mantener presionado. Los mensajes anteriores con el enlace de Google Maps o la leyenda automática también utilizan el nuevo diseño; no se reescribe el historial.

La miniatura utiliza cuatro teselas de OpenStreetMap con atribución, centradas en la coordenada mediante Web Mercator. Solo solicita las de mensajes visibles; al abrir se usa un enlace canónico de Google Maps. Sin red, al fallar la miniatura o fuera de su cobertura, la tarjeta conserva las coordenadas y el acceso al mapa. Si el mensaje no contiene coordenadas válidas, indica «Ubicación no disponible» y desactiva el acceso. Se mantienen los permisos de GPS y la cola de envío de la app. Es una ubicación puntual, sin seguimiento en vivo.

## Actualizar

Solo requiere actualizar la app. No agrega dependencias, PHP ni migraciones SQL. El backend actual sigue recibiendo `mediaType: location` con el mismo enlace; en los nuevos envíos, el texto de vista previa pasa a «Ubicación compartida». Las instalaciones nativas compiladas necesitan una nueva compilación para recibir cambios de interfaz; con Expo Go basta actualizar el código y reiniciar Expo.

La miniatura consulta el área del punto en `tile.openstreetmap.org`; no requiere una API key ni geocodificación adicional. El texto de créditos abre la atribución de OpenStreetMap. La apertura del enlace no depende de que se haya podido cargar la imagen.

## Verificación

- `npm run build`: TypeScript y Vite.
- `node_modules/.bin/tsx tests/chat-location.ts`: coordenadas/URLs válidas, compatibilidad anterior, enlace canónico, proyección y cobertura, antimeridiano y límites polares.
- `tests/chat-location-ui.mjs`: Chromium a 430 × 932 y 1024 × 900 con cuentas y teselas sintéticas; tarjeta propia/recibida, créditos, copia, pulsación larga sin abrir el enlace, envío desde GPS simulado, fallo de miniatura y datos ausentes.
- Exportación Expo web/Android/iOS. La prueba de paquetes no sustituye la comprobación de gestos y permisos en dispositivos físicos.
