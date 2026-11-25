# Publicar archivos en Alwaysdata

1. Abrir **Sitios** en el panel de Alwaysdata y consultar el directorio raíz del
   sitio `walkiet.alwaysdata.net`. Usar ese directorio, no una ruta de otro sitio.
2. Acceder mediante el gestor de archivos, SFTP o SSH autorizado y localizar los
   PHP que están sirviendo la instalación.
3. Subir los archivos de `backend-alwaysdata/` correspondientes a la actualización,
   conservando los subdirectorios `api/` y `auth/` cuando sean necesarios.
4. Conservar el `conexion.php` privado del servidor y sus configuraciones de
   correo/PTT. Revisar cada guía antes de sustituir un conjunto de archivos.
5. Aplicar las migraciones que falten a la base de esa instalación y comprobar
   el acceso con cuentas autorizadas.

La ruta `/api/status.php` y `/status.php` utilizan el mismo diagnóstico y la misma
conexión. Una respuesta de estado no sustituye las pruebas de acceso, chat y audio.

Los archivos privados de correo y radio se mantienen fuera del directorio
público. Las instrucciones de cada módulo están en
[README_ALWAYSDATA.md](README_ALWAYSDATA.md).
