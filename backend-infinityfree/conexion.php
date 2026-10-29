<?php
// ========================================================
// conexion.php - Conexión Oficial C5i Walkie-Talkie
// Servidor: sql206.infinityfree.com
// Base de datos: if0_42687378_walkt
// Usuario: if0_42687378
// ========================================================

require_once __DIR__ . '/cors.php';

$db_host = 'sql206.infinityfree.com';
$db_name = 'if0_42687378_walkt';
$db_user = 'if0_42687378';
$db_pass = 'GL1VUtpmEw6PD8b'; // Clave de acceso confirmada del panel

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
        'message' => 'Error de conexión con la base de datos C5i: ' . $e->getMessage(),
    ]);
    exit();
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: $_POST;
}
