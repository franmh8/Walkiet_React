<?php
// El directorio no modifica ni elimina las cuentas de acceso de users.
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/contacts-handler.php';
require_once __DIR__ . '/auth-session.php';

try {
    require_once __DIR__ . '/conexion.php';
    $owner = authenticateContactOwner($pdo, contactsBearerToken($_SERVER));
    if ($owner === null) contactsRespond(401, ['success' => false, 'code' => 'AUTH_REQUIRED', 'message' => 'Tu sesión venció. Inicia sesión de nuevo para consultar tu agenda privada.']);
    $raw = file_get_contents('php://input');
    $data = $raw === '' ? [] : json_decode($raw, true);
    if (!is_array($data)) contactsRespond(400, ['success' => false, 'message' => 'Se requiere un objeto JSON válido.']);
    [$status, $result] = handleContacts($pdo, $_SERVER['REQUEST_METHOD'] ?? 'GET', $data, $_GET, $owner);
    contactsRespond($status, $result);
} catch (Throwable $e) {
    error_log('Contacts API: ' . $e->getMessage());
    [$status, $result] = contactsErrorResponse($e);
    contactsRespond($status, $result);
}
