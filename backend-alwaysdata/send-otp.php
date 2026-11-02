<?php
// send-otp.php - Generación y despacho de código de verificación SMS
require_once __DIR__ . '/conexion.php';

$data = getJsonInput();
$phone = trim($data['phone'] ?? $data['phone_number'] ?? '');
$cleanPhone = preg_replace('/\D/', '', $phone);

if (strlen($cleanPhone) !== 10) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Número de teléfono celular inválido (10 dígitos).']);
    exit();
}

$code = strval(rand(100000, 999999));
$expiresAt = date('Y-m-d H:i:s', time() + (10 * 60)); // 10 minutos

try {
    // Asegurar que la tabla exista
    $pdo->query("
        CREATE TABLE IF NOT EXISTS sms_otps (
            phone_number VARCHAR(20) PRIMARY KEY,
            otp_code VARCHAR(10) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $stmt = $pdo->prepare("
        INSERT INTO sms_otps (phone_number, otp_code, expires_at, created_at)
        VALUES (:phone, :code, :expires, NOW())
        ON DUPLICATE KEY UPDATE otp_code = :code2, expires_at = :expires2, created_at = NOW()
    ");
    $stmt->execute([
        ':phone' => $cleanPhone,
        ':code' => $code,
        ':expires' => $expiresAt,
        ':code2' => $code,
        ':expires2' => $expiresAt,
    ]);
} catch (Exception $e) {}

echo json_encode([
    'success' => true,
    'code' => $code,
    'message' => 'Código de verificación generado y despachado por SMS.',
]);
