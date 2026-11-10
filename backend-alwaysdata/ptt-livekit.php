<?php
class PttRequestError extends RuntimeException {
    public $status;
    public function __construct($status, $message) { parent::__construct($message); $this->status = $status; }
}
function pttConfig() {
    $file = getenv('WALKIET_PTT_CONFIG') ?: dirname(__DIR__) . '/private/ptt-config.php';
    $config = is_file($file) ? require $file : [];
    foreach (['url'=>'LIVEKIT_URL', 'key'=>'LIVEKIT_API_KEY', 'secret'=>'LIVEKIT_API_SECRET', 'expo_access_token'=>'EXPO_ACCESS_TOKEN'] as $key=>$env) {
        if (getenv($env) !== false) $config[$key] = getenv($env);
    }
    $url = $config['url'] ?? '';
    $local = getenv('WALKIET_PTT_TESTING') === '1' && preg_match('#^ws://(127\.0\.0\.1|localhost):\d+$#D', $url);
    if ((!preg_match('#^wss://[a-z0-9.-]+(?::\d+)?/?$#iD', $url) && !$local) || empty($config['key']) || strlen($config['secret'] ?? '') < 16) {
        throw new PttRequestError(503, 'El servicio de radio en vivo aún no está configurado en el servidor.');
    }
    $config['url'] = rtrim($url, '/');
    return $config;
}
function pttB64($value) { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }
function pttJwt(array $config, array $claims) {
    $now = time();
    $body = pttB64(json_encode(['alg'=>'HS256', 'typ'=>'JWT'])) . '.' . pttB64(json_encode(array_merge(['iss'=>$config['key'], 'nbf'=>$now-5, 'iat'=>$now, 'exp'=>$now+300], $claims), JSON_UNESCAPED_UNICODE));
    return $body . '.' . pttB64(hash_hmac('sha256', $body, $config['secret'], true));
}
function pttRoom($channel) { return 'walkiet-' . substr(hash('sha256', (string)$channel), 0, 32); }
function pttIdentity($owner, $device) { return 'u-' . substr(hash('sha256', (string)$owner), 0, 32) . '-' . $device; }
function pttHttpJson($url, array $data, array $headers = []) {
    $context = stream_context_create(['http'=>['method'=>'POST', 'header'=>implode("\r\n", array_merge(['Content-Type: application/json'], $headers)),
        'content'=>json_encode($data), 'timeout'=>4, 'ignore_errors'=>true, 'follow_location'=>0],
        'ssl'=>['verify_peer'=>true, 'verify_peer_name'=>true]]);
    $raw = @file_get_contents($url, false, $context);
    $status = 0;
    foreach ($http_response_header ?? [] as $line) if (preg_match('#^HTTP/\S+ (\d+)#', $line, $match)) $status = (int)$match[1];
    return [$status, $raw === false ? null : json_decode($raw, true)];
}
function pttRpc(array $config, $method, array $data, $allowMissing = false) {
    $token = pttJwt($config, ['video'=>['roomAdmin'=>true, 'room'=>$data['room']]]);
    [$status, $body] = pttHttpJson(preg_replace('#^ws#', 'http', $config['url']) . '/twirp/livekit.RoomService/' . $method, $data, ['Authorization: Bearer ' . $token]);
    if ($allowMissing && $status === 404) return null;
    if ($status < 200 || $status >= 300) throw new PttRequestError(502, 'No se pudo conectar con el servidor de radio. Reintenta la conexión.');
    return $body;
}
function pttPermission(array $config, $channel, $identity, $enabled, $allowMissing = false) {
    return pttRpc($config, 'UpdateParticipant', ['room'=>pttRoom($channel), 'identity'=>$identity,
        'permission'=>['canSubscribe'=>true, 'canPublish'=>$enabled, 'canPublishData'=>false, 'canPublishSources'=>[2]]], $allowMissing);
}
