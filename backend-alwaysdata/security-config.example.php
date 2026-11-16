<?php
// Copiar FUERA de www como /home/walkiet/security-config.php. Nunca publicar claves.
return [
    'code_secret' => '', // Generar con: php -r 'echo bin2hex(random_bytes(32));'
    'provider' => 'gmail_smtp',
    'gmail_sender' => '', // Correo completo de la cuenta que creó la contraseña de aplicación.
    'gmail_app_password' => '', // Contraseña de aplicación de Google (16 caracteres), no la del login.
    'gmail_smtp_port' => 587, // STARTTLS; también admite 465 con TLS implícito.
    // Si prefieres Gmail API: provider=gmail_api y los tres campos OAuth siguientes.
    // 'gmail_client_id' => '',
    // 'gmail_client_secret' => '',
    // 'gmail_refresh_token' => '',
];
