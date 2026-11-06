<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth-session.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405); echo json_encode(['success' => false]); exit();
}
try {
    require_once __DIR__ . '/conexion.php';
    revokeAuthSession($pdo, contactsBearerToken($_SERVER));
    header('Cache-Control: no-store');
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    error_log('Logout: ' . $e->getMessage());
    http_response_code(503); echo json_encode(['success' => false, 'message' => 'No se pudo cerrar la sesión en el servidor.']);
}
