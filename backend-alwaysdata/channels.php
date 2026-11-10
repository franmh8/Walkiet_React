<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth-session.php';
require_once __DIR__ . '/channels-handler.php';
header('Cache-Control: no-store');
try {
    require_once __DIR__ . '/conexion.php';
    $owner = authenticateContactOwner($pdo, contactsBearerToken($_SERVER));
    $raw = file_get_contents('php://input');
    $data = $raw === '' ? [] : json_decode($raw, true);
    if (!is_array($data)) throw new ChannelsRequestError(400, 'Se requiere un objeto JSON válido.');
    echo json_encode(handleChannels($pdo, $_SERVER['REQUEST_METHOD'] ?? 'GET', $data, $_GET, $owner), JSON_UNESCAPED_UNICODE);
} catch (ChannelsRequestError $error) {
    http_response_code($error->status);
    echo json_encode(['success' => false, 'message' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('Channels API: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'No se pudo acceder a los grupos. Revisa la conexión y las tablas channels y channel_members.']);
}
