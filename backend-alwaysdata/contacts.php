<?php
// contacts.php - Sincronización de contactos y oficiales C5i (Alwaysdata MySQL)
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// 1. GET: Obtener lista de contactos y oficiales registrados
if ($method === 'GET') {
    $userId = $_GET['user_id'] ?? null;
    try {
        // Consultar usuarios y oficiales desde la tabla users
        $stmt = $pdo->query("SELECT id, name, callsign, unit, phone_number, status, role, avatar_url, created_at 
                             FROM users 
                             ORDER BY name ASC");
        $allUsers = $stmt->fetchAll();

        // Mapear como contactos tácticos
        $contacts = array_map(function($u) {
            return [
                'id' => $u['id'],
                'name' => $u['name'],
                'callsign' => !empty($u['callsign']) ? $u['callsign'] : 'OFICIAL',
                'unit' => !empty($u['unit']) ? $u['unit'] : 'Sector Operativo Hidalgo',
                'phone_number' => !empty($u['phone_number']) ? $u['phone_number'] : '',
                'status' => !empty($u['status']) ? $u['status'] : 'online',
                'role' => !empty($u['role']) ? $u['role'] : 'Oficial Operativo',
                'avatar_url' => $u['avatar_url'] ?? null,
            ];
        }, $allUsers);

        echo json_encode([
            'success' => true,
            'contacts' => $contacts,
            'total' => count($contacts),
            'server_time' => date('c'),
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error al consultar contactos: ' . $e->getMessage(),
            'contacts' => [],
        ]);
    }
    exit();
}

// 2. POST: Registrar nuevo contacto u oficial en la BD
if ($method === 'POST') {
    $data = getJsonInput();
    $name = trim($data['name'] ?? '');
    $callsign = strtoupper(trim($data['callsign'] ?? ''));
    $phone = preg_replace('/\D/', '', $data['phone_number'] ?? $data['phone'] ?? '');
    $unit = trim($data['unit'] ?? 'Sector Operativo Pachuca C5i');
    $role = trim($data['role'] ?? 'Oficial Operativo');

    if (empty($name)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'El nombre del contacto u oficial es requerido']);
        exit();
    }

    if (empty($callsign)) {
        $callsign = 'PATRULLA-' . rand(100, 999);
    }

    if (empty($phone)) {
        $phone = '771' . rand(1000000, 9999999);
    }

    $id = 'usr-cnt-' . time() . '-' . rand(100, 999);

    try {
        // Verificar si ya existe por teléfono
        $check = $pdo->prepare("SELECT id, name, callsign FROM users WHERE phone_number = ? LIMIT 1");
        $check->execute([$phone]);
        $existing = $check->fetch();

        if ($existing) {
            // Actualizar datos
            $upd = $pdo->prepare("UPDATE users SET name = :name, callsign = :cs, unit = :unit, status = 'online' WHERE id = :id");
            $upd->execute([
                ':name' => $name,
                ':cs' => $callsign,
                ':unit' => $unit,
                ':id' => $existing['id'],
            ]);
            $savedId = $existing['id'];
        } else {
            // Insertar nuevo oficial
            $ins = $pdo->prepare("INSERT INTO users (id, phone_number, name, password_hash, callsign, unit, status, role, created_at, updated_at) 
                                  VALUES (:id, :phone, :name, '123', :cs, :unit, 'online', :role, NOW(), NOW())");
            $ins->execute([
                ':id' => $id,
                ':phone' => $phone,
                ':name' => $name,
                ':cs' => $callsign,
                ':unit' => $unit,
                ':role' => $role,
            ]);
            $savedId = $id;
        }

        echo json_encode([
            'success' => true,
            'message' => 'Contacto registrado y sincronizado en la base de datos C5i',
            'contact' => [
                'id' => $savedId,
                'name' => $name,
                'callsign' => $callsign,
                'unit' => $unit,
                'phone_number' => $phone,
                'status' => 'online',
                'role' => $role,
            ],
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Error al guardar contacto en BD: ' . $e->getMessage(),
        ]);
    }
    exit();
}

// 3. DELETE: Eliminar contacto
if ($method === 'DELETE') {
    $data = getJsonInput();
    $id = $data['id'] ?? $_GET['id'] ?? null;
    if ($id) {
        try {
            $del = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $del->execute([$id]);
            echo json_encode(['success' => true, 'message' => 'Contacto eliminado']);
            exit();
        } catch (Exception $e) {}
    }
    echo json_encode(['success' => true]);
    exit();
}
