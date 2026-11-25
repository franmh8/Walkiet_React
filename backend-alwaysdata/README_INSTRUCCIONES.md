# Instalación del backend Alwaysdata

El backend activo está en `backend-alwaysdata/`. La app utiliza por defecto
`https://walkiet.alwaysdata.net` y conserva los servidores personalizados elegidos
por el usuario.

## Conexión

La conexión PDO de la instalación se administra en `conexion.php`. Conservar sus
credenciales privadas en el servidor. `config.php` es únicamente un alias de esa
conexión; no crea una conexión alternativa.

## Publicación

1. En Alwaysdata, confirmar el directorio raíz del sitio y seleccionar su base de
   datos desde phpMyAdmin.
2. Subir los conjuntos coordinados de PHP descritos en las guías de cada módulo,
   manteniendo la estructura de `api/` y `auth/` cuando se utilicen sus alias.
3. Aplicar las migraciones que falten según sus dependencias. El esquema inicial
   `database_schema.sql` crea tablas dentro de la base seleccionada: no crea ni
   selecciona una base por su nombre y no sustituye las migraciones posteriores.
4. Conservar `conexion.php`, las configuraciones privadas y los datos de la
   instalación. Registrar el resultado y comprobar la app actualizada.

Consultar [README_ALWAYSDATA.md](README_ALWAYSDATA.md) para las guías por módulo y
[las instrucciones del gestor de archivos](INSTRUCCIONES_GESTOR_ARCHIVOS.md).

## Desarrollo Node

El servidor Node es una alternativa de desarrollo. Copiar `.env.example` a `.env`
y completar solo las variables necesarias para la base local autorizada.
`.env` no se versiona. La app que consume los PHP no necesita credenciales MySQL
expuestas en el cliente.
