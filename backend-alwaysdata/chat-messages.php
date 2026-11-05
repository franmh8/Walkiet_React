<?php
// chat-messages.php - Sincronización robusta de mensajes tácticos C5i (Alwaysdata MySQL)
// Compatible con PHP 7.x y 8.x, seguro contra colisiones de parámetros PDO y schemas variables
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

// Polyfill para compatibilidad con PHP < 8.0
if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle) {
        return (string)$needle !== '' && strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

// Auto-crear tabla dedicada chat_messages si aún no existe (evita errores 500 por columnas faltantes)
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_messages` (
        `id` VARCHAR(64) NOT NULL,
        `sender_id` VARCHAR(64) NOT NULL,
        `sender_name` VARCHAR(120) DEFAULT NULL,
        `sender_callsign` VARCHAR(64) DEFAULT NULL,
        `channel_id` VARCHAR(64) DEFAULT NULL,
        `receiver_id` VARCHAR(64) DEFAULT NULL,
        `text` TEXT DEFAULT NULL,
        `media_type` VARCHAR(32) DEFAULT 'text',
        `media_url` MEDIUMTEXT DEFAULT NULL,
        `file_name` VARCHAR(255) DEFAULT NULL,
        `is_emergency` TINYINT(1) DEFAULT 0,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_chat_channel` (`channel_id`),
        KEY `idx_chat_users` (`sender_id`, `receiver_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Exception $e) {
    // Si no tiene permisos DDL, continuará operando normalmente
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// 1. GET: Obtener mensajes de una conversación
if ($method === 'GET') {
    $channel_id = $_GET['channel_id'] ?? $_GET['conversation_id'] ?? null;
    $receiver_id = $_GET['receiver_id'] ?? null;
    $user_id = $_GET['user_id'] ?? null;

    try {
        $messages = [];
        
        // Consultar tabla dedicada chat_messages
        if (!empty($channel_id)) {
            $stmt = $pdo->prepare("SELECT * FROM chat_messages WHERE channel_id = ? ORDER BY created_at ASC LIMIT 100");
            $stmt->execute([$channel_id]);
            $messages = $stmt->fetchAll();
        } elseif (!empty($receiver_id) && !empty($user_id)) {
            // Parámetros posicionales (?) evitan el fallo SQLSTATE[HY093] al reutilizar nombres con EMULATE_PREPARES=false
            $stmt = $pdo->prepare("SELECT * FROM chat_messages 
                                   WHERE (sender_id = ? AND receiver_id = ?) 
                                      OR (sender_id = ? AND receiver_id = ?) 
                                   ORDER BY created_at ASC LIMIT 100");
            $stmt->execute([$user_id, $receiver_id, $receiver_id, $user_id]);
            $messages = $stmt->fetchAll();
        } else {
            $stmt = $pdo->query("SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT 100");
            $messages = $stmt->fetchAll();
        }

        // Si la tabla chat_messages está vacía, intentar buscar en voice_messages como fallback
        if (empty($messages)) {
            try {
                if (!empty($channel_id)) {
                    $stmtVm = $pdo->prepare("SELECT vm.*, u.name as sender_name, u.callsign as sender_callsign 
                                             FROM voice_messages vm 
                                             LEFT JOIN users u ON vm.sender_id = u.id 
                                             WHERE vm.channel_id = ? 
                                             ORDER BY vm.created_at ASC LIMIT 100");
                    $stmtVm->execute([$channel_id]);
                    $vmRows = $stmtVm->fetchAll();
                } else {
                    $stmtVm = $pdo->query("SELECT vm.*, u.name as sender_name, u.callsign as sender_callsign 
                                           FROM voice_messages vm 
                                           LEFT JOIN users u ON vm.sender_id = u.id 
                                           ORDER BY vm.created_at ASC LIMIT 50");
                    $vmRows = $stmtVm->fetchAll();
                }

                if (!empty($vmRows)) {
                    foreach ($vmRows as $r) {
                        $pText = $r['text_content'] ?? $r['text'] ?? '';
                        $messages[] = [
                            'id' => $r['id'],
                            'sender_id' => $r['sender_id'],
                            'sender_name' => $r['sender_name'] ?? 'Oficial C5i',
                            'sender_callsign' => $r['sender_callsign'] ?? 'OPERATIVO',
                            'channel_id' => $r['channel_id'] ?? null,
                            'receiver_id' => $r['receiver_id'] ?? null,
                            'text' => $pText,
                            'media_type' => 'text',
                            'media_url' => $r['audio_url'] ?? null,
                            'file_name' => null,
                            'is_emergency' => (int)($r['is_emergency'] ?? 0),
                            'created_at' => $r['created_at'],
                        ];
                    }
                }
            } catch (Exception $e) {}
        }

        $formatted = array_map(function($r) {
            $createdAt = $r['created_at'] ?? date('Y-m-d H:i:s');
            return [
                'id' => $r['id'],
                'sender_id' => $r['sender_id'],
                'sender_name' => !empty($r['sender_name']) ? $r['sender_name'] : 'Oficial C5i',
                'sender_callsign' => !empty($r['sender_callsign']) ? $r['sender_callsign'] : 'OPERATIVO',
                'channel_id' => $r['channel_id'] ?? null,
                'receiver_id' => $r['receiver_id'] ?? null,
                'text' => $r['text'] ?? '',
                'mediaType' => !empty($r['media_type']) ? $r['media_type'] : 'text',
                'mediaUrl' => $r['media_url'] ?? null,
                'fileName' => $r['file_name'] ?? null,
                'is_emergency' => (bool)($r['is_emergency'] ?? 0),
                'created_at' => $createdAt,
                'timestamp' => date('H:i', strtotime($createdAt)),
            ];
        }, $messages);

        echo json_encode([
            'success' => true,
            'messages' => $formatted,
            'total' => count($formatted),
        ]);
    } catch (Exception $e) {
        // Responder 200 con lista vacía en caso de excepción para no romper la UI del cliente
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage(),
            'messages' => [],
            'total' => 0,
        ]);
    }
    exit();
}

// 2. POST: Registrar nuevo mensaje de chat (texto, imagen, cámara, voz, doc, ubicación)
if ($method === 'POST') {
    $data = getJsonInput();
    $sender_id = !empty($data['sender_id']) ? $data['sender_id'] : 'usr-c5i-01';
    $sender_name = $data['sender_name'] ?? 'Oficial';
    $sender_callsign = $data['sender_callsign'] ?? 'C5I-OP';
    $channel_id = !empty($data['channel_id']) ? $data['channel_id'] : null;
    $receiver_id = !empty($data['receiver_id']) ? $data['receiver_id'] : null;
    $text = trim($data['text'] ?? $data['caption'] ?? '');
    $mediaType = $data['mediaType'] ?? 'text';
    $mediaUrl = $data['mediaUrl'] ?? null;
    $fileName = $data['fileName'] ?? null;
    $is_emergency = !empty($data['is_emergency']) ? 1 : 0;
    $id = 'msg-' . time() . '-' . rand(100, 999);

    try {
        // 1. Guardar en tabla chat_messages con parámetros posicionales
        $stmt = $pdo->prepare("INSERT INTO chat_messages 
            (id, sender_id, sender_name, sender_callsign, channel_id, receiver_id, text, media_type, media_url, file_name, is_emergency, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            $id,
            $sender_id,
            $sender_name,
            $sender_callsign,
            $channel_id,
            $receiver_id,
            $text,
            $mediaType,
            $mediaUrl,
            $fileName,
            $is_emergency,
        ]);

        // 2. Guardar también en voice_messages si aplica de forma protegida
        try {
            $stmtVm = $pdo->prepare("INSERT INTO voice_messages (id, sender_id, channel_id, audio_url, duration_seconds, text, is_emergency, created_at) 
                                     VALUES (?, ?, ?, ?, 2, ?, ?, NOW())");
            $stmtVm->execute([
                $id,
                $sender_id,
                $channel_id,
                $mediaUrl ?: 'burst-' . time(),
                $text,
                $is_emergency,
            ]);
        } catch (Exception $e) {}

        echo json_encode([
            'success' => true,
            'message' => 'Mensaje sincronizado en base de datos C5i',
            'id' => $id,
            'timestamp' => date('H:i'),
        ]);
    } catch (Exception $e) {
        // Si ocurre cualquier error, responder JSON con success false sin 500 para evitar que la consola del navegador se alerte
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage(),
            'id' => $id,
            'timestamp' => date('H:i'),
        ]);
    }
    exit();
}
