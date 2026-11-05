<?php
// contacts.php - Sincronización de contactos y oficiales C5i (Alwaysdata MySQL)
// Compatible con PHP 7.x y 8.x, seguro contra schemas variables y parámetros PDO
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// 1. GET: Obtener lista de contactos y oficiales registrados
if ($method === 'GET') {
    $userId = $_GET['user_id'] ?? null;
    try {
        // Consultar usuarios y oficiales desde la tabla users
        $stmt = $pdo->query("SELECT id, name, callsign, unit, phone_number, correo, status, role, avatar_url, created_at 
                             FROM users 
                             ORDER BY name ASC");
        $allUsers = $stmt->fetchAll();

        // Mapear como contactos tácticos
        $contacts = array_map(function($u) {
            return [
                'id' => $u['id'],
                'name' => $u['name'],
                'callsign' => !empty($u['callsign']) ? $u['callsign'] : 'RADIO-' . rand(100, 999),
                'unit' => !empty($u['unit']) ? $u['unit'] : 'Sector Operativo Hidalgo',
                'phone_number' => !empty($u['phone_number']) ? $u['phone_number'] : '',
                'email' => !empty($u['correo']) ? $u['correo'] : '',
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
    } catch (Exception $e) {
        echo json_encode([
            'success' => true,
            'message' => 'Modo local activo: ' . $e->getMessage(),
            'contacts' => [],
            'total' => 0,
        ]);
    }
    exit();
}

// 2. POST: Registrar nuevo contacto u oficial en la BD
if ($method === 'POST') {
    $data = getJsonInput();
    $firstName = trim($data['first_name'] ?? '');
    $lastName = trim($data['last_name'] ?? '');
    $name = trim($data['name'] ?? trim($firstName . ' ' . $lastName));
    $callsign = strtoupper(trim($data['callsign'] ?? ''));
    $phone = preg_replace('/\D/', '', $data['phone_number'] ?? $data['phone'] ?? '');
    $email = trim($data['email'] ?? $data['correo'] ?? '');
    $unit = trim($data['unit'] ?? 'Sector Operativo Pachuca C5i');
    $role = trim($data['role'] ?? 'Oficial Operativo');

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'El nombre del contacto u oficial es requerido']);
        exit();
    }

    if (empty($callsign)) {
        $callsign = 'RADIO-' . rand(100, 999);
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
            $upd = $pdo->prepare("UPDATE users SET name = ?, correo = ?, callsign = ?, unit = ?, status = 'online' WHERE id = ?");
            $upd->execute([$name, $email ?: null, $callsign, $unit, $existing['id']]);
            $savedId = $existing['id'];
        } else {
            // Insertar nuevo oficial / contacto con parámetros posicionales
            $ins = $pdo->prepare("INSERT INTO users (id, phone_number, name, correo, password_hash, callsign, unit, status, role, created_at, updated_at) 
                                  VALUES (?, ?, ?, ?, '123', ?, ?, 'online', ?, NOW(), NOW())");
            $ins->execute([$id, $phone, $name, $email ?: null, $callsign, $unit, $role]);
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
                'email' => $email,
                'status' => 'online',
                'role' => $role,
            ],
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error al guardar contacto en BD: ' . $e->getMessage(),
            'contact' => [
                'id' => $id,
                'name' => $name,
                'callsign' => $callsign,
                'unit' => $unit,
                'phone_number' => $phone,
                'email' => $email,
                'status' => 'online',
                'role' => $role,
            ],
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
