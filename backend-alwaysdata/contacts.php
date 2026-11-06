<?php
// El directorio no modifica ni elimina las cuentas de acceso de users.
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';
require_once __DIR__ . '/contacts-handler.php';

try {
    $raw = file_get_contents('php://input');
    $data = $raw === '' ? [] : json_decode($raw, true);
    if (!is_array($data)) contactsRespond(400, ['success' => false, 'message' => 'Se requiere un objeto JSON válido.']);
    [$status, $result] = handleContacts($pdo, $_SERVER['REQUEST_METHOD'] ?? 'GET', $data, $_GET);
    contactsRespond($status, $result);
} catch (Throwable $e) {
    error_log('Contacts API: ' . $e->getMessage());
    contactsRespond(500, ['success' => false, 'message' => 'No se pudo acceder al directorio de contactos. Verifica la conexión y la migración de la BD.']);
}
