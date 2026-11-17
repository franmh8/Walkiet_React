# Recuperar el canal al entrar o reabrir la app

La membresía se guarda en `channel_members` del servidor. El canal sintonizado es
una preferencia del dispositivo: una preferencia ausente no significa que la
cuenta se haya salido del grupo.

La app ahora espera a consultar las membresías y leer la preferencia antes de
mostrar el resultado. Recupera el último ID si sigue autorizado, incluso si el
nombre cambió; si no hay preferencia válida, selecciona el primer grupo real que
devuelve el servidor (orden de creación descendente). No crea membresías ni se
une automáticamente mediante un PIN.

Una cuenta nueva, o una que ya no tiene membresías, muestra el estado vacío solo
después de una consulta correcta. Una carga pendiente muestra “Recuperando tu
canal…” y un error muestra su diagnóstico y “Reintentar grupos”. Las lecturas
lentas no se descartan continuamente por el sondeo de cuatro segundos.

## Instalar

**Esta corrección es de la app. No requiere subir PHP ni ejecutar SQL.** Desde
Terminal de tu computadora, en `Walkiet_React`, guardar los cambios locales y:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npx expo start -c
```

Recargar la app de los dispositivos conectados a Expo. Si usan un APK instalado,
generar e instalar otro APK con los cambios:

```sh
npx eas-cli@latest build --platform android --profile preview
```

No es necesario salir del grupo ni unirse otra vez. Los PHP de grupos/sesiones
deben corresponder a la instalación existente; esta actualización no cambia su
contrato. Si Grupos muestra un error de API, revisarlo mediante “Reintentar
grupos” y [GRUPOS_DESPLIEGUE.md](GRUPOS_DESPLIEGUE.md).

## Comprobar con Carlos y un compañero

1. Carlos inicia sesión. Si el servidor devuelve sus grupos, se sintoniza el
   último canal válido o uno de sus grupos reales.
2. El compañero abre los miembros del mismo canal: ambos deben ver a Carlos y
   el mismo número de miembros. Ese número representa membresías, no conexiones
   de radio ni presencia en línea.
3. Carlos cierra y vuelve a abrir la app sin cerrar sesión: una sesión todavía
   válida se recupera y se consulta otra vez su pertenencia al canal.
4. Si cierra sesión expresamente, debe volver a autenticarse. Esa operación no
   lo saca del grupo y conserva la preferencia del dispositivo.
5. Si usa varios grupos, puede cambiar el activo en Grupos → Sintonizar. La
   selección se guarda por servidor y cuenta; no se comparte con otra persona
   que use el mismo equipo. En otro dispositivo sin preferencia se elige un
   grupo real de su cuenta, que puede ser distinto si pertenece a varios.
6. Salir o eliminar el grupo retira esa selección; si quedan otras membresías se
   selecciona una de ellas. Sin ninguna, aparece el estado vacío.

La sesión conserva su caducidad de seguridad existente. Cerrar sesión, revocarla
por cambio de contraseña o alcanzar su vencimiento requiere autenticarse de nuevo.
Las preferencias antiguas se leen para migrarlas y las escrituras se serializan
para que una operación lenta no sobrescriba la elección más reciente.

La restauración del canal no pone en marcha el worker PTT: “Radio desconectada”
puede seguir apareciendo si falta configurar el servicio de transmisión.

## Validación

`tests/channel-restore-ui.mjs` usa PHP/MySQL con dos cuentas y datos sintéticos:
contador/membresía, consulta de 6.5 s, reapertura sin login, nuevo dispositivo,
nuevo token para la misma cuenta, renombre, preferencia entre varios grupos,
error/reintento, salida y cambio a una cuenta sin grupos. No captura micrófono.
