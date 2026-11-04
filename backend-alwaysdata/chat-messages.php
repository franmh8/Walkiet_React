<?php
// chat-messages.php - Sincronización de mensajes de chat táctico C5i
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// 1. GET: Obtener mensajes de una conversación (por canal, grupo o destinatario)
if ($method === 'GET') {
    $channel_id = $_GET['channel_id'] ?? $_GET['conversation_id'] ?? null;
    $receiver_id = $_GET['receiver_id'] ?? null;
    $user_id = $_GET['user_id'] ?? null;

    try {
        if (!empty($channel_id)) {
            // Conversación grupal o canal
            $stmt = $pdo->prepare("SELECT vm.*, u.name as sender_name, u.callsign as sender_callsign, u.unit as sender_unit 
                                   FROM voice_messages vm 
                                   LEFT JOIN users u ON vm.sender_id = u.id 
                                   WHERE vm.channel_id = ? 
                                   ORDER BY vm.created_at ASC LIMIT 100");
            $stmt->execute([$channel_id]);
        } elseif (!empty($receiver_id) && !empty($user_id)) {
            // Conversación directa entre dos oficiales
            $stmt = $pdo->prepare("SELECT vm.*, u.name as sender_name, u.callsign as sender_callsign, u.unit as sender_unit 
                                   FROM voice_messages vm 
                                   LEFT JOIN users u ON vm.sender_id = u.id 
                                   WHERE (vm.sender_id = :u1 AND vm.receiver_id = :u2) 
                                      OR (vm.sender_id = :u2 AND vm.receiver_id = :u1) 
                                   ORDER BY vm.created_at ASC LIMIT 100");
            $stmt->execute([':u1' => $user_id, ':u2' => $receiver_id]);
        } else {
            // Todos los mensajes recientes de la red
            $stmt = $pdo->query("SELECT vm.*, u.name as sender_name, u.callsign as sender_callsign, u.unit as sender_unit 
                                 FROM voice_messages vm 
                                 LEFT JOIN users u ON vm.sender_id = u.id 
                                 ORDER BY vm.created_at ASC LIMIT 100");
        }

        $rows = $stmt->fetchAll();
        $messages = array_map(function($r) {
            $parsedText = $r['text_content'] ?? '';
            $mediaType = 'text';
            $mediaUrl = null;
            $fileName = null;

            // Detección de metadata JSON o prefijos multimedia
            if (!empty($parsedText) && str_starts_with($parsedText, '{"mediaType":')) {
                $meta = json_decode($parsedText, true);
                if ($meta) {
                    $mediaType = $meta['mediaType'] ?? 'text';
                    $parsedText = $meta['text'] ?? $parsedText;
                    $mediaUrl = $meta['mediaUrl'] ?? null;
                    $fileName = $meta['fileName'] ?? null;
                }
            } elseif (!empty($r['audio_url']) && $r['audio_url'] !== 'burst' && !str_starts_with($r['audio_url'], 'burst-')) {
                $mediaUrl = $r['audio_url'];
            }

            return [
                'id' => $r['id'],
                'sender_id' => $r['sender_id'],
                'sender_name' => $r['sender_name'] ?? 'Oficial C5i',
                'sender_callsign' => $r['sender_callsign'] ?? 'OPERATIVO',
                'channel_id' => $r['channel_id'],
                'receiver_id' => $r['receiver_id'],
                'text' => $parsedText,
                'mediaType' => $mediaType,
                'mediaUrl' => $mediaUrl,
                'fileName' => $fileName,
                'is_emergency' => (bool)$r['is_emergency'],
                'created_at' => $r['created_at'],
                'timestamp' => date('H:i', strtotime($r['created_at'])),
            ];
        }, $rows);

        echo json_encode([
            'success' => true,
            'messages' => $messages,
            'total' => count($messages),
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error al consultar mensajes: ' . $e->getMessage(),
            'messages' => [],
        ]);
    }
    exit();
}

// 2. POST: Registrar nuevo mensaje multimedia o texto
if ($method === 'POST') {
    $data = getJsonInput();
    $sender_id = $data['sender_id'] ?? 'usr-c5i-01';
    $channel_id = $data['channel_id'] ?? null;
    $receiver_id = $data['receiver_id'] ?? null;
    $text = trim($data['text'] ?? $data['caption'] ?? '');
    $mediaType = $data['mediaType'] ?? 'text';
    $mediaUrl = $data['mediaUrl'] ?? null;
    $fileName = $data['fileName'] ?? null;
    $is_emergency = !empty($data['is_emergency']) ? 1 : 0;
    $id = 'msg-' . time() . '-' . rand(100, 999);

    // Empaquetar payload en text_content si contiene metadatos multimedia
    if ($mediaType !== 'text' || !empty($mediaUrl) || !empty($fileName)) {
        $packed = json_encode([
            'mediaType' => $mediaType,
            'text' => $text,
            'mediaUrl' => $mediaUrl,
            'fileName' => $fileName,
        ]);
    } else {
        $packed = $text;
    }

    $audioUrlToSave = ($mediaType === 'voice' && !empty($mediaUrl)) ? $mediaUrl : 'burst-' . time();

    try {
        $stmt = $pdo->prepare("INSERT INTO voice_messages (id, sender_id, channel_id, receiver_id, audio_url, duration_seconds, text_content, is_emergency, created_at) 
                               VALUES (:id, :sender, :ch, :rec, :audio, 2, :content, :em, NOW())");
        $stmt->execute([
            ':id' => $id,
            ':sender' => $sender_id,
            ':ch' => $channel_id,
            ':rec' => $receiver_id,
            ':audio' => $audioUrlToSave,
            ':content' => $packed,
            ':em' => $is_emergency,
        ]);

        echo json_encode([
            'success' => true,
            'message' => 'Mensaje sincronizado en base de datos C5i',
            'id' => $id,
            'timestamp' => date('H:i'),
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error al guardar mensaje: ' . $e->getMessage(),
        ]);
    }
    exit();
}
