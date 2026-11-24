<?php
/** Registro seguro de dispositivos push, asociado a la sesión real de Walkiet. */
require_once __DIR__.'/cors.php';
require_once __DIR__.'/conexion.php';
require_once __DIR__.'/auth-session.php';
header('Cache-Control: no-store');
function pushReply(int $status, array $data): void {
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
  exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') pushReply(405, ['success'=>false,'message'=>'Método no permitido.']);
$owner = authenticateContactOwner($pdo, contactsBearerToken($_SERVER));
if (!$owner) pushReply(401, ['success'=>false,'message'=>'Inicia sesión nuevamente.']);
$data = getJsonInput();
$action = $data['action'] ?? null;
$pushToken = $data['push_token'] ?? null;
if (!is_string($pushToken) || strlen($pushToken) > 240 ||
    !preg_match('/^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{8,200}\]$/D', $pushToken)) {
  pushReply(422, ['success'=>false,'message'=>'Token de dispositivo inválido.']);
}
try {
  if ($action === 'register') {
    $platform = $data['platform'] ?? null;
    if (!in_array($platform, ['ios','android'], true)) pushReply(422,['success'=>false,'message'=>'Plataforma inválida.']);
    $stmt = $pdo->prepare('INSERT INTO chat_push_devices (expo_token,user_id,platform,enabled,last_seen_at)
      VALUES(?,?,?,1,UTC_TIMESTAMP(6))
      ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),platform=VALUES(platform),enabled=1,last_seen_at=UTC_TIMESTAMP(6)');
    $stmt->execute([$pushToken,$owner,$platform]);
    pushReply(200,['success'=>true]);
  }
  if ($action === 'unregister') {
    $pdo->prepare('DELETE FROM chat_push_devices WHERE expo_token=? AND user_id=?')->execute([$pushToken,$owner]);
    pushReply(200,['success'=>true]);
  }
  pushReply(422,['success'=>false,'message'=>'Acción no válida.']);
} catch (Throwable $e) {
  error_log('[chat-push-devices] '.$e->getMessage());
  pushReply(500,['success'=>false,'message'=>'No se pudo registrar el dispositivo.']);
}
