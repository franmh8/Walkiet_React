# Estado en línea y última conexión

La app comprueba la actividad con la cuenta autenticada cada 15 segundos mientras
está en primer plano. Ya no utiliza el `status=online` que quedaba guardado desde
el login ni el estado congelado de la conversación.

Al minimizarla o cambiar de pestaña comunica la salida. Si se cierra bruscamente,
pierde internet o el sistema no permite avisar, el estado caduca a los 45 segundos
del último pulso. El contacto ve el cambio en su siguiente consulta (hasta unos
15 segundos adicionales). No es una garantía de disponibilidad instantánea.
Una segunda ventana o dispositivo activo mantiene la cuenta en línea. Cerrar
sesión revoca esa sesión, sin desconectar las demás.

En **Perfil → Configuración y ajustes → Privacidad → Mostrar última conexión**
cada cuenta puede ocultar su fecha de actividad. La preferencia se guarda en el
servidor y este deja de enviar la fecha a otros usuarios. El estado «en línea»
sigue visible mientras la app está abierta. Solo pueden consultar la presencia
los contactos propios y compañeros de grupo. Una falta de conexión al servidor
muestra «Estado no disponible», sin conservar un indicador verde antiguo.

## 1. Actualizar el proyecto en el Mac

En la **Terminal del Mac**, dentro de `Walkiet_React`, detener Expo con Ctrl+C.
Revisar `git status --short` y respaldar cualquier cambio propio antes de actualizar.

```sh
git fetch origin
git switch main
git pull --ff-only origin main
ls backend-alwaysdata/account-presence.php
```

No ejecutar el comando de copia del paso 3 desde la consola SSH de Alwaysdata:
el origen de esos archivos está en el Mac.

## 2. Crear las tablas en Alwaysdata

En phpMyAdmin seleccionar la misma base de datos configurada en `conexion.php`.
Abrir la pestaña SQL y ejecutar **todo** el contenido del archivo:

```text
backend-alwaysdata/migrations/007_chat_presence.sql
```

Requiere las migraciones 002 y 005 ya aplicadas. Crea `account_privacy` y
`account_presence`, sin borrar ni importar usuarios, contactos o mensajes.
Puede repetirse y conserva las preferencias y la actividad existentes.
Ejecutarla antes de reemplazar los archivos PHP.

## 3. Subir los tres archivos PHP

Guardar una copia de los archivos PHP anteriores. Desde la Terminal del Mac,
ubicada en el proyecto actualizado:

```sh
scp backend-alwaysdata/account-presence.php backend-alwaysdata/account-handler.php backend-alwaysdata/account.php walkiet@ssh-walkiet.alwaysdata.net:/home/walkiet/www/
```

También pueden copiarse por WebDAV a `www`, reemplazando `account.php` y
`account-handler.php`, y agregando `account-presence.php` junto a ellos.
Los tres deben corresponder a esta actualización. No reemplazar `conexion.php`
ni los archivos privados de configuración.

No hace falta crear un servicio continuo ni iniciar el worker de radio para esta
función. Si se usa el proxy Node de desarrollo, debe apuntar al PHP actualizado
mediante `ACCOUNT_PHP_ORIGIN`, como en el despliegue de perfil existente.

## 4. Actualizar las apps de todos los compañeros

```sh
npx expo start -c
```

Para APK de distribución interna, generar una nueva compilación con el perfil
`preview` existente e instalarla en cada teléfono:

```sh
npx eas-cli build --platform android --profile preview
```

La compilación EAS puede requerir acceso a la cuenta del proyecto. Este cambio
no genera ni distribuye un APK automáticamente. Los clientes anteriores no
emiten estos pulsos: todos los equipos deben actualizarse para informar su
actividad correctamente. Las sesiones existentes se conservan si siguen vigentes.

## 5. Comprobar con dos cuentas

1. Agregar la otra cuenta a contactos o compartir un grupo. Abrir su chat.
2. Mantener la otra app abierta: debe aparecer «en línea» en la siguiente consulta.
3. Minimizarla: debe aparecer «últ. vez hoy…». Ante un cierre sin aviso, esperar
   hasta un minuto aproximadamente para la caducidad y la consulta del contacto.
4. En la otra cuenta desactivar **Mostrar última conexión**, volver a minimizar:
   debe aparecer «desconectado», sin fecha. Al abrirla otra vez, aparece «en línea».
5. Reiniciar la app: la preferencia debe seguir desactivada. Otra cuenta conserva
   su propia elección.

Si aparece «Estado no disponible», revisar en Red la respuesta de `account.php`
a la acción `presence` y el registro PHP. Un error de tabla ausente requiere
comprobar que se ejecutó 007 en la base correcta; no cambiar usuarios ni borrar
sesiones para solucionarlo. No compartir tokens ni credenciales en capturas.
