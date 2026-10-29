<?php
// cors.php - Configuración de cabeceras CORS para aplicaciones móviles y web

// Permitir peticiones desde cualquier origen (Web localhost:8081, Expo, etc.)
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Origin, Accept");
header("Access-Control-Max-Age: 86400"); // 24 horas de caché para preflight
header("Content-Type: application/json; charset=UTF-8");

// Si es una solicitud de verificación previa (OPTIONS / Preflight), responder de inmediato con 200 OK
if (isset($_SERVER['REQUEST_METHOD']) && strtoupper($_SERVER['REQUEST_METHOD']) === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['status' => 'preflight_ok']);
    exit();
}
