# Mostrar la foto del perfil en otros dispositivos

La foto ya se guardaba en `account_avatars`, pero los chats mostraban solamente
iniciales. Ahora la app consulta las fotos por cuenta registrada en lista de
chats, cabecera de conversación, selector de contacto y agenda/detalle.

## Actualizar el servidor

La versión actual del perfil incluye presencia y privacidad. Aplicar primero
[007_chat_presence.sql](migrations/007_chat_presence.sql), después de la 005,
y copiar los tres archivos desde la Terminal del Mac, dentro del proyecto:

```sh
scp backend-alwaysdata/account-presence.php backend-alwaysdata/account-handler.php backend-alwaysdata/account.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
```

Conservar `conexion.php`, archivos privados y fotos actuales. No requiere volver
a cargar la imagen. Los pasos completos están en
[PRESENCIA_CHAT_DESPLIEGUE.md](PRESENCIA_CHAT_DESPLIEGUE.md). Si aún no existe
`account_avatars`, seguir primero [PERFIL_DESPLIEGUE.md](PERFIL_DESPLIEGUE.md).

## Actualizar ambos dispositivos

Guardar primero los cambios locales y, desde la raíz de `Walkiet_React`:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npx expo start -c
```

Recargar la app en ambos teléfonos. Un APK que ya está instalado no incorpora un
`git pull`: generar e instalar una nueva versión con
`npx eas-cli@latest build --platform android --profile preview`.
No se agregaron módulos nativos en esta corrección.

## Comprobar con dos cuentas

1. A guarda su foto en Perfil.
2. B tiene a A en su agenda, con el teléfono asociado a la cuenta de A, y abre
   una conversación directa. Debe ver la foto en el selector, cabecera y lista.
3. A cambia o retira su foto. Mientras Chat/Contactos está visible y la app activa,
   B consulta novedades cada 30 segundos; también al volver a la pestaña/app.
4. Si no existe foto o la imagen no se puede cargar, se muestran las iniciales.

La consulta exige una sesión válida. Solo permite la foto propia, de un contacto
que el solicitante tiene guardado o de una cuenta con la que comparte grupo.
No publica una URL abierta, datos del perfil ni el directorio de otros usuarios.
La imagen procede del usuario registrado, no del nombre guardado en la agenda.
El nombre personalizado del contacto se conserva.

La API consulta hasta 20 IDs por solicitud. Una revisión SHA-256 evita reenviar
imágenes sin cambios. Retirar la foto o perder el vínculo devuelve `null`, incluso
si se presenta una revisión conocida. La caché es temporal, separada por servidor
y sesión; no se guarda en conversaciones ni en almacenamiento persistente.
Esta actualización no requiere el worker PTT.

## Pruebas locales

Las suites `tests/account-avatars-http.mjs` y `tests/account-avatars-ui.mjs` usan
cuentas sintéticas en `contacts_test_account`. Verifican lectura desde otra cuenta,
restricciones, actualización/retirada, revisiones y visualización en navegador.
Las pruebas del teléfono físico y el despliegue en Alwaysdata se realizan durante
la instalación; el cambio en Git no sustituye los PHP de producción.
