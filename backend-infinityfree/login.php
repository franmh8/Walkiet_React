<?php
// ========================================================
// login.php - Autenticación de Mandos y Oficiales C5i
// ========================================================

require_once __DIR__ . '/conexion.php';

$data = getJsonInput();

$identificador = trim($data['identificador'] ?? $data['phone_number'] ?? '');
$password = trim($data['password'] ?? '');

if (empty($identificador)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'code' => 'EMPTY_IDENTIFIER',
        'message' => 'Por favor ingresa tu teléfono o correo institucional.',
    ]);
    exit();
}

$cleanPhone = preg_replace('/\D/', '', $identificador);
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

// Buscar oficial por teléfono, correo, indicativo (callsign) o ID
$stmt = $pdo->prepare("
    SELECT * FROM users 
    WHERE phone_number = :phone 
       OR LOWER(correo) = :id_lower 
       OR LOWER(callsign) = :id_lower 
       OR LOWER(name) = :id_lower 
       OR id = :ident
    LIMIT 1
");

$stmt->execute([
    ':phone' => $cleanPhone ?: $identificador,
    ':id_lower' => strtolower($identificador),
    ':ident' => $identificador,
]);

$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'code' => 'USER_NOT_FOUND',
        'message' => "El usuario «{$identificador}» no se encuentra registrado en el sistema C5i.",
    ]);
    exit();
}

// Validar bloqueo por intentos fallidos
if (!empty($user['locked_until']) && strtotime($user['locked_until']) > time()) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'code' => 'ACCOUNT_LOCKED',
        'message' => 'Terminal bloqueada temporalmente por intentos fallidos de acceso.',
    ]);
    exit();
}

// Validación de contraseña
$isValid = false;
$storedHash = $user['password_hash'] ?? '';
$storedSalt = $user['salt'] ?? '';

if ($storedHash === 'hash_demo') {
    // Compatibilidad para usuarios semilla
    $isValid = true;
} elseif (password_verify($password, $storedHash)) {
    $isValid = true;
} elseif (!empty($storedSalt) && hash('sha512', $password . $storedSalt) === $storedHash) {
    $isValid = true;
} elseif ($storedHash === $password) {
    $isValid = true;
}

if (!$isValid) {
    // Incrementar intentos fallidos
    try {
        $updFail = $pdo->prepare("UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = :id");
        $updFail->execute([':id' => $user['id']]);
        
        $log = $pdo->prepare("INSERT INTO security_audit_log (event_type, user_id, ip_address, details, severity) VALUES ('LOGIN_FAILED', :uid, :ip, 'Contraseña errónea', 'WARNING')");
        $log->execute([':uid' => $user['id'], ':ip' => $ip]);
    } catch (Exception $e) {}

    http_response_code(401);
    echo json_encode([
        'success' => false,
        'code' => 'INVALID_PASSWORD',
        'message' => 'Contraseña incorrecta. Verifica tu contraseña o solicita recuperación.',
    ]);
    exit();
}

// Acceso exitoso: reiniciar contador de fallos y actualizar estado online
try {
    $upd = $pdo->prepare("
        UPDATE users 
        SET status = 'online', 
            failed_login_attempts = 0, 
            locked_until = NULL, 
            last_login_at = NOW(), 
            last_ip = :ip, 
            updated_at = NOW() 
        WHERE id = :id
    ");
    $upd->execute([':ip' => $ip, ':id' => $user['id']]);

    $logOk = $pdo->prepare("INSERT INTO security_audit_log (event_type, user_id, ip_address, details, severity) VALUES ('LOGIN_SUCCESS', :uid, :ip, 'Inicio de sesión exitoso', 'INFO')");
    $logOk->execute([':uid' => $user['id'], ':ip' => $ip]);
} catch (Exception $e) {}

echo json_encode([
    'success' => true,
    'code' => 'SUCCESS',
    'message' => 'Sesión iniciada con éxito en la base de datos C5i.',
    'user' => [
        'id' => $user['id'],
        'phone_number' => $user['phone_number'],
        'name' => $user['name'],
        'correo' => $user['correo'] ?? null,
        'callsign' => $user['callsign'] ?: 'OPERATIVO',
        'unit' => $user['unit'] ?: 'Sector Operativo Hidalgo',
        'role' => $user['role'] ?: 'Oficial Operativo',
        'badge' => $user['callsign'] ?: 'OF-104',
        'avatar_url' => $user['avatar_url'] ?? null,
        'status' => 'online',
    ],
]);
