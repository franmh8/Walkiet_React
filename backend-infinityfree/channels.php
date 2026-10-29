<?php
// channels.php - Listado de canales tácticos encriptados C5i
require_once __DIR__ . '/conexion.php';

try {
    $stmt = $pdo->query("SELECT id, name, is_private, category, member_count, created_at FROM channels ORDER BY created_at ASC");
    $channels = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'channels' => $channels,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener canales: ' . $e->getMessage(),
    ]);
}
