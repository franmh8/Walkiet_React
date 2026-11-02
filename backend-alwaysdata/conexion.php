<?php
// ========================================================
// conexion.php - Conexión Alwaysdata C5i Walkie-Talkie
// Servidor: mysql-walkiet.alwaysdata.net
// Base de datos: walkiet_c5i
// Usuario: walkiet
// ========================================================

require_once __DIR__ . '/cors.php';

$db_host = 'mysql-walkiet.alwaysdata.net';
$db_name = 'walkiet_c5i';
$db_user = 'walkiet';
$db_pass = 'franmh88';

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
        'message' => 'Error de conexión con MySQL Alwaysdata: ' . $e->getMessage(),
    ]);
    exit();
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: $_POST;
}
