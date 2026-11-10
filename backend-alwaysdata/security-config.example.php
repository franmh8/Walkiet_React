<?php
// Copiar FUERA de www como /home/walkiet/security-config.php. Nunca publicar claves.
return [
    'code_secret' => '', // Generar con: php -r 'echo bin2hex(random_bytes(32));'
    'gmail_client_id' => '',
    'gmail_client_secret' => '',
    'gmail_refresh_token' => '', // OAuth con scope https://www.googleapis.com/auth/gmail.send
    'gmail_sender' => '', // Correo de la cuenta que autorizó OAuth.
];
