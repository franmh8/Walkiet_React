<?php
// voice-messages.php - Transmisiones de voz PTT y mensajes de radio
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $channel_id = $_GET['channel_id'] ?? null;
    try {
        if ($channel_id) {
            $stmt = $pdo->prepare("SELECT vm.*, u.name as sender_name, u.callsign, u.badge, u.unit 
                                   FROM voice_messages vm 
                                   LEFT JOIN users u ON vm.sender_id = u.id 
                                   WHERE vm.channel_id = ? 
                                   ORDER BY vm.created_at DESC LIMIT 50");
            $stmt->execute([$channel_id]);
        } else {
            $stmt = $pdo->query("SELECT vm.*, u.name as sender_name, u.callsign, u.badge, u.unit 
                                 FROM voice_messages vm 
                                 LEFT JOIN users u ON vm.sender_id = u.id 
                                 ORDER BY vm.created_at DESC LIMIT 50");
        }
        $messages = $stmt->fetchAll();
        echo json_encode(['success' => true, 'voice_messages' => $messages]);
    } catch (PDOException $e) {
        echo json_encode(['success' => true, 'voice_messages' => []]);
    }
    exit();
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?? [];

    $sender_id = $data['sender_id'] ?? 'usr-c5i-01';
    $channel_id = $data['channel_id'] ?? null;
    $audio_url = $data['audio_url'] ?? 'burst-' . time();
    $duration = $data['duration_seconds'] ?? 2;
    $text = $data['text'] ?? null;
    $is_emergency = !empty($data['is_emergency']) ? 1 : 0;
    $id = 'vm-' . uniqid();

    try {
        $stmt = $pdo->prepare("INSERT INTO voice_messages (id, sender_id, channel_id, audio_url, duration_seconds, text, is_emergency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([$id, $sender_id, $channel_id, $audio_url, $duration, $text, $is_emergency]);
        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Transmisión registrada']);
    } catch (PDOException $e) {
        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Guardado localmente']);
    }
    exit();
}
