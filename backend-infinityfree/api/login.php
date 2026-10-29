<?php
require_once __DIR__ . '/../config.php';

$data = getJsonInput();

$identificador = trim($data['identificador'] ?? $data['phone_number'] ?? '');
$password = trim($data['password'] ?? '');

if (empty($identificador)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'code' => 'EMPTY_IDENTIFIER',
        'message' => 'Ingresa tu teléfono o correo.',
    ]);
    exit();
}

$cleanPhone = preg_replace('/\D/', '', $identificador);

// Buscar usuario por teléfono, correo, indicativo o ID
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
        'message' => "El usuario «{$identificador}» no se encuentra registrado en la base de datos.",
    ]);
    exit();
}

// Validar contraseña
if (!empty($user['password_hash']) && !empty($password) && $user['password_hash'] !== $password) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'code' => 'INVALID_PASSWORD',
        'message' => 'Contraseña incorrecta. Verifica tu clave de acceso.',
    ]);
    exit();
}

// Marcar como activo en base de datos
try {
    $upd = $pdo->prepare("UPDATE users SET status = 'online', updated_at = NOW() WHERE id = :id");
    $upd->execute([':id' => $user['id']]);
} catch (Exception $e) {}

echo json_encode([
    'success' => true,
    'code' => 'SUCCESS',
    'message' => 'Sesión iniciada con éxito en la base de datos.',
    'user' => [
        'id' => $user['id'],
        'phone_number' => $user['phone_number'],
        'name' => $user['name'],
        'correo' => $user['correo'] ?? null,
        'callsign' => $user['callsign'] ?: 'OPERATIVO',
        'unit' => $user['unit'] ?: 'Sector Operativo Hidalgo',
        'avatar_url' => $user['avatar_url'] ?? null,
        'status' => 'online',
    ],
]);
