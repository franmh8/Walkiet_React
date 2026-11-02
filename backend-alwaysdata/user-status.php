<?php
// user-status.php - Actualización de estado en línea de oficiales
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?? [];
$status = $data['status'] ?? 'online';
$user_id = $_GET['user_id'] ?? ($data['user_id'] ?? null);

if ($user_id) {
    try {
        $stmt = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
        $stmt->execute([$status, $user_id]);
    } catch (Exception $e) {}
}

echo json_encode(['success' => true, 'status' => $status]);
exit();
