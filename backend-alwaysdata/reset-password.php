<?php
// reset-password.php - Actualización de contraseña en la BD C5i
require_once __DIR__ . '/conexion.php';

$data = getJsonInput();
$identifier = trim($data['identifier'] ?? $data['phone_number'] ?? '');
$newPass = trim($data['new_password'] ?? $data['newPassword'] ?? $data['password'] ?? '');

if (empty($identifier) || empty($newPass)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Identificador y nueva contraseña requeridos.']);
    exit();
}

$cleanPhone = preg_replace('/\D/', '', $identifier);

// Generar nuevo salt y hash seguro
$newSalt = bin2hex(random_bytes(16));
$newHash = hash('sha512', $newPass . $newSalt);

try {
    $stmt = $pdo->prepare("
        UPDATE users 
        SET password_hash = :hash, 
            salt = :salt, 
            failed_login_attempts = 0, 
            locked_until = NULL, 
            updated_at = NOW() 
        WHERE phone_number = :phone 
           OR LOWER(correo) = :id_lower 
           OR LOWER(callsign) = :id_lower 
           OR id = :ident
    ");
    $stmt->execute([
        ':hash' => $newHash,
        ':salt' => $newSalt,
        ':phone' => $cleanPhone ?: $identifier,
        ':id_lower' => strtolower($identifier),
        ':ident' => $identifier,
    ]);

    if ($stmt->rowCount() === 0) {
        // Verificar si el usuario existe
        $chk = $pdo->prepare("SELECT id FROM users WHERE phone_number = :phone OR id = :ident LIMIT 1");
        $chk->execute([':phone' => $cleanPhone ?: $identifier, ':ident' => $identifier]);
        if (!$chk->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Usuario no encontrado en la base de datos.']);
            exit();
        }
    }

    echo json_encode(['success' => true, 'message' => 'Contraseña actualizada correctamente en la base de datos C5i.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error al actualizar contraseña: ' . $e->getMessage()]);
}
