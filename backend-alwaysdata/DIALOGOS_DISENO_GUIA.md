# Avisos y formularios con el mismo diseño

`src/native/components/TacticalDialog.tsx` define la tarjeta compartida: adorno
redondeado en el borde superior, insignia centrada, título y mensaje, bordes suaves
y acciones del mismo tamaño. La tarjeta sigue la paleta clara/oscura de la cuenta,
se adapta al ancho disponible y permite desplazar formularios largos con teclado.

Se aplica a:

- Avisos que antes aparecían como una barra oscura: ahora tienen botón Entendido.
- Confirmaciones, advertencias, errores de adjuntos y acciones SOS de la app.
- Éxito al crear, sintonizar, unirse, salir o eliminar canales.
- Editar nombre, elegir/retirar foto, cambiar/verificar correo y eliminar cuenta.
- Recuperación de contraseña y confirmación de cambio de servidor.

El texto de cada acción y sus validaciones se conservan. Una confirmación sensible
necesita su botón explícito; Cancelar o cerrar no ejecutan la acción. Durante una
operación de guardado los controles de cierre permanecen bloqueados. Los errores
de campos siguen junto al formulario para que se puedan corregir sin perder datos.

`useNativeFeedback` mantiene sus métodos existentes y usa esta tarjeta; los avisos
breves permanecen hasta pulsar Entendido. El adaptador `showNativeAlert` conserva
los botones y callbacks de los anteriores avisos nativos. Las solicitudes de
permisos del sistema operativo o del navegador conservan su interfaz del sistema.

## Aplicar la actualización

No requiere PHP, SQL ni dependencias nuevas. En Terminal de tu computadora, desde
`Walkiet_React`, guardar primero cambios locales y actualizar:

```sh
git switch main
git pull --ff-only origin main
npm ci
npx expo start -c
```

Recargar los dispositivos conectados a Expo. Si usan un APK instalado, compilar e
instalar otro APK con `npx eas-cli@latest build --platform android --profile preview`.

## Comprobar

1. En Chat → Nueva conversación, tocar un contacto sin cuenta. El aviso debe
   aparecer sobre el selector con la misma tarjeta y volver al selector al cerrar.
2. En Perfil, abrir Nombre, Foto y Correo. Los tres deben compartir el adorno
   superior. Un error debe conservar los datos; Guardar y Cancelar siguen activos
   según las validaciones y el estado de la petición.
3. Verificar un correo con las seis casillas y recuperar una contraseña. Se
   mantienen los códigos de tres minutos y el reenvío como enlace.
4. Abrir una confirmación de eliminación y cancelarla antes de probar otras
   pantallas. No usar cuentas ni contactos reales para las pruebas destructivas.
5. Cambiar entre tema claro/oscuro y revisar tanto móvil como escritorio.

Las suites de navegador de diálogos, perfil, correo y grupos usan cuentas
sintéticas con PHP/MySQL local. También se comprueban tipos y compilación web y
se generan bundles JavaScript de Android/iOS; estos no son APK/IPA firmados ni
sustituyen las pruebas de teclado, cámara y presentación de ventanas en teléfonos.
