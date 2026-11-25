<?php
/** Envío simple de push una vez confirmado el mensaje en MySQL.
 * Nota: para producción es recomendable añadir cola persistente, reintentos y comprobación de recibos Expo.
 */
function walkietSendChatPush(PDO $pdo, string $threadId, string $senderId): void {
  if (!function_exists('curl_init')) {
    error_log('[chat-push] La extensión cURL no está habilitada.');
    return;
  }
  $stmt = $pdo->prepare('SELECT DISTINCT d.expo_token,d.user_id FROM chat_push_devices d
    INNER JOIN chat_thread_members m ON m.user_id=d.user_id
    WHERE m.thread_id=? AND m.user_id<>? AND d.enabled=1');
  $stmt->execute([$threadId, $senderId]);
  $tokens = $stmt->fetchAll(PDO::FETCH_ASSOC);
  if (!$tokens) return;
  $messages = [];
  foreach ($tokens as $device) {
    $messages[] = [
      'to'=>$device['expo_token'],
      'title'=>'Walkiet C5i',
      'body'=>'Tienes un mensaje nuevo', // No exponer contenidos de chats en pantalla bloqueada.
      'sound'=>'default',
      'priority'=>'high',
      'channelId'=>'messages',
      'data'=>['kind'=>'chat','threadId'=>$threadId,'recipientUserId'=>(string)$device['user_id']],
    ];
  }
  foreach (array_chunk($messages, 100) as $batch) {
    $handle = curl_init('https://exp.host/--/api/v2/push/send');
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    $accessToken = getenv('EXPO_PUSH_ACCESS_TOKEN');
    if (is_string($accessToken) && $accessToken !== '') $headers[]='Authorization: Bearer '.$accessToken;
    curl_setopt_array($handle, [
      CURLOPT_POST=>true,
      CURLOPT_POSTFIELDS=>json_encode($batch, JSON_UNESCAPED_UNICODE),
      CURLOPT_HTTPHEADER=>$headers,
      CURLOPT_RETURNTRANSFER=>true,
      CURLOPT_CONNECTTIMEOUT=>2,
      CURLOPT_TIMEOUT=>5,
    ]);
    $result = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_HTTP_CODE);
    if ($result === false || $status < 200 || $status >= 300) {
      error_log('[chat-push] Falló la solicitud Expo HTTP '.$status.': '.curl_error($handle));
    } else {
      $response = json_decode($result, true);
      // El ticket aceptado no garantiza entrega: validar recibos en una fase posterior.
      if (!is_array($response) || isset($response['errors'])) error_log('[chat-push] Expo devolvió errores de ticket.');
    }
    curl_close($handle);
  }
}

function walkietRespondSavedWithPush(PDO $pdo, array $response, string $threadId, string $senderId): void {
  // Mantener ágil el envío normal: responder antes de solicitar push cuando PHP-FPM lo permite.
  http_response_code(201);
  header('Content-Type: application/json; charset=UTF-8');
  header('Cache-Control: no-store');
  echo json_encode($response, JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
  if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
  try { walkietSendChatPush($pdo, $threadId, $senderId); }
  catch (Throwable $e) { error_log('[chat-push] '.$e->getMessage()); }
  exit;
}
