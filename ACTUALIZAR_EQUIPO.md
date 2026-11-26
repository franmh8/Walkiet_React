# Actualizar el equipo conservando los cambios locales

Si `git status --short` muestra modificaciones de `package.json`, de
`backend-infinityfree/config.php` y una carpeta `ios/` sin seguimiento, Git está
mostrando archivos locales. Los pasos siguientes conservan el trabajo de ese
estado antes de actualizar.

## 1. Respaldo y guardado de los dos archivos modificados

Ejecutar desde la raíz de `Walkiet_React`, en la misma terminal:

```sh
backup_walkiet=$(mktemp -d ../walkiet-respaldo.XXXXXX)
cp package.json "$backup_walkiet/package.json"
cp backend-infinityfree/config.php "$backup_walkiet/config-anterior.php"
if [ -f .env ]; then cp .env "$backup_walkiet/.env"; fi
git stash push -m "respaldo-config-antigua" -- backend-infinityfree/config.php
git stash push -m "respaldo-package-ios" -- package.json
```

Esto guarda por separado el cambio del backend retirado y el de dependencias.
La carpeta `ios/` permanece en el equipo y no se incluye en esos stashes.

## 2. Descargar main

```sh
git switch main
git pull --ff-only origin main
cp .env.example .env
git stash list -2
```

`.env` pasa a ser configuración local ignorada por Git. La copia anterior queda
en el respaldo; la nueva usa la URL de Alwaysdata y deja vacías las credenciales
del servidor Node opcional. Si necesitas ajustes adicionales, recupera solo los
valores correspondientes al entorno actual. Las carpetas nativas generadas
`ios/` y `android/` se ignoran y sus archivos permanecen en el equipo.

## 3. Recuperar únicamente el cambio de package.json

Si la primera entrada de `git stash list -2` corresponde a
**respaldo-package-ios**, aplicar esa entrada:

```sh
git stash apply 'stash@{0}'
```

El stash de la configuración del backend retirado se conserva como respaldo y no
se reaplica. Si Git muestra un conflicto en `package.json`, resolverlo antes de
instalar dependencias; el respaldo y los stashes siguen disponibles.

Después de aplicar los cambios sin conflictos:

```sh
npm install
npx expo start --dev-client --clear
```

`npm install` coordina el archivo de bloqueo con las dependencias locales
recuperadas. Si no se recuperaron cambios de dependencias, se puede usar `npm ci`.

## 4. Backend activo

La carpeta activa es `backend-alwaysdata/`. Sus alias `config.php` y
`api/status.php` reutilizan la conexión y el diagnóstico principales. Si se
utilizan estos alias en el servidor, publicar sus versiones actualizadas
conservando el `conexion.php` de la instalación.

Para el PR #22, publicar también `backend-alwaysdata/chat-push-dispatch.php`
según las dependencias de las guías. El PR #22 no agrega SQL nuevo. La limpieza
del repositorio tampoco exige ejecutar nuevamente el esquema inicial.

## 5. Nombre e iconos de C5i Walkiet

El nombre visible es **C5i Walkiet** en web, Android e iOS. Los iconos se generan
desde `assets/c5i-logo.png`, conservando el logo institucional. El identificador
de las apps sigue siendo `com.c5i.hidalgo.walkiet`.

Después de descargar los cambios e instalar las dependencias, si ya existen las
carpetas nativas en el equipo, ejecutar:

```sh
npm run branding:sync
```

Este comando actualiza los iconos, `CFBundleDisplayName` de iOS y `app_name` de
Android. Conserva el proyecto de Xcode, la firma, los identificadores y las
capacidades. No necesita `expo prebuild --clean`.

Para instalar el cambio en el iPhone conectado:

```sh
npx expo run:ios --device
```

Para instalarlo en un Android conectado:

```sh
npx expo run:android --device
```

Si todavía no existe un proyecto nativo, Expo toma el nombre y los iconos de
`app.base.json` al crearlo. El cambio de icono y nombre requiere una nueva
compilación e instalación; reiniciar Metro o una actualización JavaScript no
cambia los recursos del lanzador.

Para web, `npm run build` genera `dist/` con el título y los iconos actualizados.
Publicar esa carpeta en el alojamiento web correspondiente. El favicon y el
icono para agregar a Inicio están incluidos en `public/assets/`.

Si se reemplaza el logo original, regenerar los recursos con
`npm run branding:assets` antes de sincronizar y compilar.
