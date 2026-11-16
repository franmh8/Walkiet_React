<?php
// Cambio de contraseña de la cuenta autenticada. No acepta identidad desde el body.
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/auth-session.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); echo json_encode(['success' => false]); exit(); }
try {
    require_once __DIR__ . '/conexion.php';
    $owner = authenticateContactOwner($pdo, contactsBearerToken($_SERVER));
    if ($owner === null) { http_response_code(401); echo json_encode(['success' => false, 'message' => 'El cambio de contraseña requiere una sesión válida. Para recuperar acceso, contacta al administrador.']); exit(); }
    $data = getJsonInput();
    $password = $data['new_password'] ?? $data['newPassword'] ?? $data['password'] ?? '';
    $password = is_string($password) ? trim($password) : '';
    if (strlen($password) < 6 || strlen($password) > 72) { http_response_code(422); echo json_encode(['success' => false, 'message' => 'Usa una contraseña de al menos 6 caracteres y de longitud menor.']); exit(); }
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_BCRYPT), $owner]);
    $pdo->prepare('DELETE FROM auth_sessions WHERE user_id = ?')->execute([$owner]);
    $pdo->commit();
    header('Cache-Control: no-store');
    echo json_encode(['success' => true, 'message' => 'Contraseña actualizada. Inicia sesión de nuevo.']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Password change: ' . $e->getMessage());
    http_response_code(503); echo json_encode(['success' => false, 'message' => 'No se pudo actualizar la contraseña.']);
}
