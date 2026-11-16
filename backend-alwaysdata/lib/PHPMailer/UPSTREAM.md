# PHPMailer

Se incluyen sin modificar `src/Exception.php`, `src/PHPMailer.php`, `src/SMTP.php`
y `LICENSE` de [PHPMailer 7.2.0](https://github.com/PHPMailer/PHPMailer/releases/tag/v7.2.0).
Commit de origen: `f5eb50148734d03bbbb81825c722c1889636d51a`.
Licencia LGPL 2.1; conservar [LICENSE](LICENSE) al distribuir.

Los archivos se incluyen para poder subir el backend por WebDAV sin ejecutar
Composer en Alwaysdata. El modo SMTP usa autenticación LOGIN protegida por TLS;
no necesita los módulos OAuth de esta biblioteca ni sus ejemplos ejecutables.
Requiere PHP 8 o posterior. No se modifican las clases de terceros; revisar las
actualizaciones de seguridad del proyecto antes de cambiar la versión fijada.
