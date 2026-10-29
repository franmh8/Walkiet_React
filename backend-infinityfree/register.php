<?php
// ========================================================
// register.php - Registro y Alta de Oficiales C5i
// ========================================================

require_once __DIR__ . '/conexion.php';

$data = getJsonInput();

$name = trim($data['name'] ?? '');
$phone = trim($data['phone_number'] ?? $data['phone'] ?? '');
$correo = trim($data['correo'] ?? $data['email'] ?? '');
$password = trim($data['password'] ?? '123456');
$callsign = trim($data['callsign'] ?? '');
$unit = trim($data['unit'] ?? 'Sector Operativo Hidalgo');

if (empty($name) || empty($phone)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Nombre completo y número de teléfono celular requeridos.',
    ]);
    exit();
}

$cleanPhone = preg_replace('/\D/', '', $phone);
if (strlen($cleanPhone) !== 10) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'El teléfono celular debe contener exactamente 10 dígitos.',
    ]);
    exit();
}

// Validar si el número o correo ya existen en la base de datos
$check = $pdo->prepare("SELECT id, name FROM users WHERE phone_number = :phone OR (correo = :email AND correo IS NOT NULL) LIMIT 1");
$check->execute([
    ':phone' => $cleanPhone,
    ':email' => !empty($correo) ? $correo : null,
]);
$existing = $check->fetch();

if ($existing) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => "El número o correo ya se encuentra registrado ({$existing['name']}).",
    ]);
    exit();
}

// Generación de identificador único y credenciales criptográficas
$userId = 'u-' . substr(md5(uniqid(rand(), true)), 0, 13);
$finalCallsign = !empty($callsign) ? strtoupper($callsign) : 'PATRULLA-' . substr($cleanPhone, -4);
$salt = bin2hex(random_bytes(16)); // 32 caracteres hexadecimales
$passwordHash = hash('sha512', $password . $salt);

try {
    $pdo->beginTransaction();

    // 1. Insertar en tabla `users` respetando el esquema estricto
    $stmt = $pdo->prepare("
        INSERT INTO users (
            id, phone_number, name, correo, callsign, unit, role, id_rol,
            password_hash, salt, auth_algorithm, failed_login_attempts, status,
            created_at, updated_at
        ) VALUES (
            :id, :phone, :name, :correo, :callsign, :unit, 'Oficial Operativo', 3,
            :pass_hash, :salt, 'PBKDF2-SHA512', 0, 'online',
            NOW(), NOW()
        )
    ");

    $stmt->execute([
        ':id' => $userId,
        ':phone' => $cleanPhone,
        ':name' => $name,
        ':correo' => !empty($correo) ? $correo : null,
        ':callsign' => $finalCallsign,
        ':unit' => $unit,
        ':pass_hash' => $passwordHash,
        ':salt' => $salt,
    ]);

    // 2. Insertar configuración por defecto en `user_settings`
    $stmtSettings = $pdo->prepare("
        INSERT INTO user_settings (
            user_id, theme_mode, push_notifications, channel_message_sounds,
            ptt_mode, roger_beep, vibration_on_ptt, updated_at
        ) VALUES (
            :user_id, 'system', 1, 1, 'hold', 1, 1, NOW()
        )
        ON DUPLICATE KEY UPDATE updated_at = NOW()
    ");
    $stmtSettings->execute([':user_id' => $userId]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Oficial registrado exitosamente en la base de datos C5i.',
        'user' => [
            'id' => $userId,
            'phone_number' => $cleanPhone,
            'name' => $name,
            'correo' => $correo ?: null,
            'callsign' => $finalCallsign,
            'badge' => $finalCallsign,
            'unit' => $unit,
            'role' => 'Oficial Operativo',
            'status' => 'online',
        ],
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al registrar oficial en la base de datos: ' . $e->getMessage(),
    ]);
}
