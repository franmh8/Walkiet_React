<?php
// COPIAR FUERA DEL DIRECTORIO PÚBLICO: /home/walkiet/private/ptt-config.php
// Nunca subir el archivo con claves al repositorio ni a www.
return [
    'url' => getenv('LIVEKIT_URL') ?: '', // wss://tu-proyecto.livekit.cloud
    'key' => getenv('LIVEKIT_API_KEY') ?: '',
    'secret' => getenv('LIVEKIT_API_SECRET') ?: '',
    'expo_access_token' => getenv('EXPO_ACCESS_TOKEN') ?: '', // Si se activa protección del servicio Expo Push.
];
