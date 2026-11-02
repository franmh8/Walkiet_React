<?php
require_once __DIR__ . '/../config.php';

$data = getJsonInput();

$name = trim($data['name'] ?? '');
$phone = trim($data['phone_number'] ?? $data['phone'] ?? '');
$correo = trim($data['correo'] ?? $data['email'] ?? '');
$password = trim($data['password'] ?? '123');
$callsign = trim($data['callsign'] ?? '');
$unit = trim($data['unit'] ?? 'Sector Operativo Hidalgo');

if (empty($name) || empty($phone)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Nombre y número de teléfono requeridos.',
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

// Verificar si ya existe el teléfono o correo
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
        'message' => "Este usuario ya se encuentra registrado ({$existing['name']}).",
    ]);
    exit();
}

$userId = 'usr-' . round(microtime(true) * 1000);
$finalCallsign = !empty($callsign) ? strtoupper($callsign) : 'PATRULLA-' . substr($cleanPhone, -3);

$stmt = $pdo->prepare("
    INSERT INTO users (id, phone_number, name, correo, password_hash, callsign, unit, status, created_at, updated_at)
    VALUES (:id, :phone, :name, :correo, :pass, :callsign, :unit, 'online', NOW(), NOW())
");

$stmt->execute([
    ':id' => $userId,
    ':phone' => $cleanPhone,
    ':name' => $name,
    ':correo' => !empty($correo) ? $correo : null,
    ':pass' => $password,
    ':callsign' => $finalCallsign,
    ':unit' => $unit,
]);

echo json_encode([
    'success' => true,
    'message' => 'Oficial registrado exitosamente en la base de datos.',
    'user' => [
        'id' => $userId,
        'phone_number' => $cleanPhone,
        'name' => $name,
        'correo' => $correo ?: null,
        'callsign' => $finalCallsign,
        'unit' => $unit,
        'status' => 'online',
    ],
]);
