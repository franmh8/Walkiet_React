<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth-session.php';
require_once __DIR__ . '/ptt-handler.php';
header('Cache-Control: no-store');
try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new PttRequestError(405, 'El control de radio requiere POST.');
    require_once __DIR__ . '/conexion.php';
    $token = contactsBearerToken($_SERVER);
    $owner = authenticateContactOwner($pdo, $token);
    if ($owner === null) throw new PttRequestError(401, 'Tu sesión venció. Inicia sesión de nuevo para usar la radio.');
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) throw new PttRequestError(400, 'Se requiere un objeto JSON válido.');
    echo json_encode(handlePtt($pdo, $data, $owner, $token), JSON_UNESCAPED_UNICODE);
} catch (PttRequestError $error) {
    http_response_code($error->status); echo json_encode(['success'=>false, 'message'=>$error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('PTT API: ' . $error->getMessage());
    http_response_code(500); echo json_encode(['success'=>false, 'message'=>'No se pudo acceder a la radio. Revisa la conexión y la migración 004_live_ptt.sql.']);
}
