<?php
// channels.php - Listado y gestión de canales tácticos C5i (Alwaysdata)
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Helper: Obtener un ID de usuario válido de la tabla users para satisfacer la FK fk_channels_created_by
function getValidUserId($pdo, $preferredId = null) {
    if (!empty($preferredId)) {
        try {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$preferredId]);
            $row = $stmt->fetch();
            if ($row && !empty($row['id'])) {
                return $row['id'];
            }
        } catch (Exception $e) {}
    }

    try {
        $stmt = $pdo->query("SELECT id FROM users ORDER BY created_at ASC LIMIT 1");
        $row = $stmt->fetch();
        if ($row && !empty($row['id'])) {
            return $row['id'];
        }
    } catch (Exception $e) {}

    // Si la tabla users estuviera vacía, sembrar un usuario oficial por defecto
    $defaultId = 'usr-c5i-01';
    try {
        $ins = $pdo->prepare("INSERT INTO users (id, phone_number, name, password_hash, callsign, unit, status) 
                              VALUES (:id, '7711234567', 'Comandante C5i', '123', 'CENTRAL-01', 'Mando Central', 'online')");
        $ins->execute([':id' => $defaultId]);
        return $defaultId;
    } catch (Exception $e) {}

    return null;
}

// 1. POST: Crear un nuevo canal táctico
if ($method === 'POST') {
    $data = getJsonInput();
    $name = trim($data['name'] ?? '');
    $category = trim($data['category'] ?? 'Táctico');
    $isPrivate = !empty($data['is_private']) ? 1 : 0;
    $pin = trim($data['pin'] ?? $data['access_code'] ?? '1090');
    $frequency = trim($data['frequency'] ?? '154.800 MHz');
    $id = 'chan-' . time() . '-' . rand(100, 999);

    if (empty($name)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nombre del canal requerido']);
        exit();
    }

    // Obtener un ID de usuario válido para satisfacer la clave foránea (fk_channels_created_by)
    $createdBy = getValidUserId($pdo, $data['created_by'] ?? null);

    try {
        $stmt = $pdo->prepare("INSERT INTO channels (id, name, is_private, access_code, category, created_by) 
                               VALUES (:id, :name, :is_priv, :pin, :cat, :created_by)");
        $stmt->execute([
            ':id' => $id,
            ':name' => $name,
            ':is_priv' => $isPrivate,
            ':pin' => $pin,
            ':cat' => $category,
            ':created_by' => $createdBy,
        ]);

        // Registrar al creador como miembro en channel_members si la tabla existe
        if (!empty($createdBy)) {
            try {
                $cmStmt = $pdo->prepare("INSERT INTO channel_members (id, channel_id, user_id, joined_at) 
                                         VALUES (:cm_id, :ch_id, :u_id, NOW())");
                $cmStmt->execute([
                    ':cm_id' => 'cm-' . time() . '-' . rand(100, 999),
                    ':ch_id' => $id,
                    ':u_id' => $createdBy,
                ]);
            } catch (Exception $e) {}
        }

        echo json_encode([
            'success' => true,
            'message' => 'Canal creado exitosamente en la base de datos C5i',
            'channel' => [
                'id' => $id,
                'name' => $name,
                'category' => $category,
                'is_private' => $isPrivate,
                'pin' => $pin,
                'frequency' => $frequency,
                'created_by' => $createdBy,
                'member_count' => 1
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit();
}

// 2. DELETE: Eliminar un canal táctico
if ($method === 'DELETE') {
    $channelId = $_GET['id'] ?? null;
    if (!$channelId) {
        $data = getJsonInput();
        $channelId = $data['id'] ?? null;
    }
    if ($channelId) {
        try {
            // Eliminar miembros asociados primero si existe la tabla
            try {
                $delMembers = $pdo->prepare("DELETE FROM channel_members WHERE channel_id = :id");
                $delMembers->execute([':id' => $channelId]);
            } catch (Exception $e) {}

            $stmt = $pdo->prepare("DELETE FROM channels WHERE id = :id");
            $stmt->execute([':id' => $channelId]);
            echo json_encode(['success' => true, 'message' => 'Canal eliminado de la base de datos C5i']);
            exit();
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            exit();
        }
    }
}

// 3. GET: Listar canales tácticos (con auto-siembra inicial si la tabla está vacía)
try {
    $stmt = $pdo->query("SELECT id, name, is_private, access_code, category, created_by, created_at FROM channels ORDER BY created_at ASC");
    $channels = $stmt->fetchAll();

    if (empty($channels)) {
        $validUser = getValidUserId($pdo);
        $seeds = [
            ['id' => 'chan-01', 'name' => 'OPERACIONES ESPECIALES TÁCTICAS', 'is_private' => 1, 'access_code' => '1090', 'category' => 'Táctico'],
            ['id' => 'chan-02', 'name' => 'DESPACHO EMERGENCIAS 911', 'is_private' => 0, 'access_code' => '9110', 'category' => 'Emergencia'],
            ['id' => 'chan-03', 'name' => 'CENTRAL DE MONITOREO C5I', 'is_private' => 1, 'access_code' => '5001', 'category' => 'Inteligencia'],
            ['id' => 'chan-04', 'name' => 'VIALIDAD Y TRÁNSITO PACHUCA', 'is_private' => 0, 'access_code' => '4400', 'category' => 'Vialidad'],
        ];

        foreach ($seeds as $s) {
            try {
                $ins = $pdo->prepare("INSERT INTO channels (id, name, is_private, access_code, category, created_by) 
                                      VALUES (:id, :name, :is_priv, :pin, :cat, :created_by)");
                $ins->execute([
                    ':id' => $s['id'],
                    ':name' => $s['name'],
                    ':is_priv' => $s['is_private'],
                    ':pin' => $s['access_code'],
                    ':cat' => $s['category'],
                    ':created_by' => $validUser,
                ]);
            } catch (Exception $e) {}
        }

        $stmt = $pdo->query("SELECT id, name, is_private, access_code, category, created_by, created_at FROM channels ORDER BY created_at ASC");
        $channels = $stmt->fetchAll();
    }

    $formatted = array_map(function($ch, $idx) {
        return [
            'id' => $ch['id'],
            'name' => $ch['name'],
            'category' => $ch['category'] ?? 'Táctico',
            'is_private' => intval($ch['is_private']),
            'pin' => $ch['access_code'] ?? '1090',
            'frequency' => '15' . (4 + ($idx % 5)) . '.' . ((($idx * 175) % 800) ?: '800') . ' MHz',
            'member_count' => 8 + ($idx * 4),
        ];
    }, $channels, array_keys($channels));

    echo json_encode([
        'success' => true,
        'channels' => $formatted,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener canales: ' . $e->getMessage(),
    ]);
}
