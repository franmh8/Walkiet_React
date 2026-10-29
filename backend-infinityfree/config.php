<?php
// ========================================================
// Configuración de Conexión MySQL - C5i Walkie-Talkie
// Base de datos: if0_42687378_walkt en InfinityFree
// ========================================================

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuración de credenciales de InfinityFree:
// En InfinityFree, los scripts PHP se ejecutan en el mismo servidor web que la BD,
// por lo que el host suele ser 'sql206.infinityfree.com' o 'localhost'.
$db_host = 'sql206.infinityfree.com';
$db_name = 'if0_42687378_walkt';
$db_user = 'if0_42687378';
$db_pass = 'TU_PASSWORD_AQUI'; // Reemplazar con la contraseña de tu panel InfinityFree

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error de conexión con la base de datos: ' . $e->getMessage(),
    ]);
    exit();
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: $_POST;
}
