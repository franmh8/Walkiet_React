<?php
// contacts.php - Sincronización completa de contactos y oficiales C5i (Alwaysdata MySQL)
// Compatible con PHP 7.x y 8.x, seguro contra schemas variables y parámetros PDO
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = getJsonInput();

// 1. ELIMINAR CONTACTO: Soporta tanto DELETE como POST con action='delete'
$isDeleteAction = ($method === 'DELETE') || (isset($data['action']) && $data['action'] === 'delete') || (isset($_GET['action']) && $_GET['action'] === 'delete');

if ($isDeleteAction) {
    $deleteId = $data['id'] ?? $_GET['id'] ?? null;
    $deletePhone = preg_replace('/\D/', '', $data['phone_number'] ?? $data['phone'] ?? $_GET['phone'] ?? '');

    if ($deleteId || $deletePhone) {
        try {
            $deletedRows = 0;
            if ($deleteId) {
                $del = $pdo->prepare("DELETE FROM users WHERE id = ?");
                $del->execute([$deleteId]);
                $deletedRows += $del->rowCount();
            }
            if ($deletePhone) {
                $del2 = $pdo->prepare("DELETE FROM users WHERE phone_number = ?");
                $del2->execute([$deletePhone]);
                $deletedRows += $del2->rowCount();
            }

            echo json_encode([
                'success' => true,
                'message' => 'Contacto eliminado exitosamente de la base de datos C5i',
                'deleted_id' => $deleteId,
                'deleted_phone' => $deletePhone,
                'affected_rows' => $deletedRows,
            ]);
            exit();
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error al eliminar contacto de BD: ' . $e->getMessage(),
            ]);
            exit();
        }
    }

    echo json_encode(['success' => true, 'message' => 'Sin identificador para eliminar']);
    exit();
}

// 2. GET: Obtener lista de contactos y oficiales registrados
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

// 3. POST / PUT: Registrar o Actualizar contacto u oficial en la BD
if ($method === 'POST' || $method === 'PUT') {
    $contactId = $data['id'] ?? $_GET['id'] ?? null;
    $oldId = $data['old_id'] ?? null;
    $oldPhone = preg_replace('/\D/', '', $data['old_phone'] ?? $data['old_phone_number'] ?? '');
    $isEdit = !empty($data['is_edit']) || ($data['action'] ?? '') === 'update' || !empty($oldPhone) || ($method === 'PUT');

    $firstName = trim($data['first_name'] ?? '');
    $lastName = trim($data['last_name'] ?? '');
    $name = trim($data['name'] ?? trim($firstName . ' ' . $lastName));
    $callsign = strtoupper(trim($data['callsign'] ?? ''));
    $phone = preg_replace('/\D/', '', $data['phone_number'] ?? $data['phone'] ?? '');
    $email = trim($data['email'] ?? $data['correo'] ?? '');
    $unit = trim($data['unit'] ?? 'Sector Operativo Hidalgo C5i');
    $role = trim($data['role'] ?? 'Oficial Operativo');

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'El nombre del contacto u oficial es requerido']);
        exit();
    }

    if (empty($phone)) {
        $phone = '771' . rand(1000000, 9999999);
    }

    // Calcular indicativo con los últimos 4 dígitos del teléfono si no se proporcionó
    if (empty($callsign)) {
        $digits = preg_replace('/\D/', '', $phone);
        $last4 = strlen($digits) >= 4 ? substr($digits, -4) : (strlen($digits) > 0 ? str_pad($digits, 4, '0', STR_PAD_LEFT) : rand(1000, 9999));
        $callsign = 'RADIO-' . $last4;
    }

    try {
        $existing = null;

        // 1. Buscar por ID directo si es un ID válido de BD (no temporal de cliente 'off-')
        if ($contactId && strpos($contactId, 'off-') !== 0) {
            $checkId = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE id = ? LIMIT 1");
            $checkId->execute([$contactId]);
            $existing = $checkId->fetch();
        }

        // 2. Buscar por old_id si se pasó
        if (!$existing && $oldId && strpos($oldId, 'off-') !== 0) {
            $checkOldId = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE id = ? LIMIT 1");
            $checkOldId->execute([$oldId]);
            $existing = $checkOldId->fetch();
        }

        // 3. Buscar por old_phone si se pasó en modo edición
        if (!$existing && $oldPhone) {
            $checkOldPhone = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE phone_number = ? LIMIT 1");
            $checkOldPhone->execute([$oldPhone]);
            $existing = $checkOldPhone->fetch();
        }

        // 4. Buscar por el teléfono actual
        if (!$existing && $phone) {
            $checkPhone = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE phone_number = ? LIMIT 1");
            $checkPhone->execute([$phone]);
            $existing = $checkPhone->fetch();
        }

        // 5. Si es edición y aún no se encontró, buscar por nombre exacto
        if (!$existing && $isEdit && $name) {
            $checkName = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE name = ? LIMIT 1");
            $checkName->execute([$name]);
            $existing = $checkName->fetch();
        }

        if ($existing) {
            // Actualizar datos del oficial / contacto existente (NO crear duplicado)
            $upd = $pdo->prepare("UPDATE users SET name = ?, phone_number = ?, correo = ?, callsign = ?, unit = ?, status = 'online', updated_at = NOW() WHERE id = ?");
            $upd->execute([$name, $phone, $email ?: null, $callsign, $unit, $existing['id']]);
            $savedId = $existing['id'];
            $msg = 'Contacto actualizado en la base de datos C5i';
        } else {
            // Insertar nuevo oficial / contacto con ID único persistente
            $newId = ($contactId && strpos($contactId, 'off-') !== 0) ? $contactId : ('usr-cnt-' . time() . '-' . rand(100, 999));
            $ins = $pdo->prepare("INSERT INTO users (id, phone_number, name, correo, password_hash, callsign, unit, status, role, created_at, updated_at) 
                                  VALUES (?, ?, ?, ?, '123', ?, ?, 'online', ?, NOW(), NOW())");
            $ins->execute([$newId, $phone, $name, $email ?: null, $callsign, $unit, $role]);
            $savedId = $newId;
            $msg = 'Contacto registrado y sincronizado en la base de datos C5i';
        }

        echo json_encode([
            'success' => true,
            'message' => $msg,
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
                'id' => $contactId ?: ('usr-cnt-' . time()),
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
