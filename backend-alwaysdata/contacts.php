<?php
// contacts.php - Sincronización dual: tabla 'contactos' y tabla 'users' en Alwaysdata MySQL
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = getJsonInput();

// Asegurar que exista la tabla contactos para que se visualice en phpMyAdmin
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `contactos` (
        `id` VARCHAR(64) NOT NULL,
        `name` VARCHAR(120) NOT NULL,
        `phone_number` VARCHAR(20) NOT NULL,
        `callsign` VARCHAR(50) DEFAULT NULL,
        `correo` VARCHAR(120) DEFAULT NULL,
        `unit` VARCHAR(100) DEFAULT 'Sector Operativo Hidalgo C5i',
        `status` VARCHAR(20) DEFAULT 'online',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
} catch (Exception $e) {}

// 1. ELIMINAR CONTACTO (DELETE o POST con action='delete')
$isDelete = ($method === 'DELETE') || (isset($data['action']) && $data['action'] === 'delete') || (isset($_GET['action']) && $_GET['action'] === 'delete');
if ($isDelete) {
    $delId = $data['id'] ?? $_GET['id'] ?? null;
    $delPhone = preg_replace('/\D/', '', $data['phone_number'] ?? $data['phone'] ?? $_GET['phone'] ?? '');

    try {
        if ($delId) {
            $pdo->prepare("DELETE FROM contactos WHERE id = ?")->execute([$delId]);
            $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$delId]);
        }
        if ($delPhone) {
            $pdo->prepare("DELETE FROM contactos WHERE phone_number = ?")->execute([$delPhone]);
            $pdo->prepare("DELETE FROM users WHERE phone_number = ?")->execute([$delPhone]);
        }
        echo json_encode(['success' => true, 'message' => 'Contacto eliminado de contactos y users']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit();
}

// 2. CONSULTAR CONTACTOS (GET)
if ($method === 'GET') {
    try {
        // Cargar contactos registrados y oficiales unificados
        $stmt = $pdo->query("SELECT id, name, callsign, unit, phone_number, correo, status, 'Oficial Operativo' as role FROM contactos 
                             UNION 
                             SELECT id, name, callsign, unit, phone_number, correo, status, role FROM users 
                             ORDER BY name ASC");
        $rows = $stmt->fetchAll();

        // Evitar duplicados por teléfono o ID
        $seen = [];
        $contacts = [];
        foreach ($rows as $u) {
            $key = !empty($u['phone_number']) ? $u['phone_number'] : $u['id'];
            if (isset($seen[$key])) continue;
            $seen[$key] = true;

            $digits = preg_replace('/\D/', '', $u['phone_number'] ?? '');
            $last4 = strlen($digits) >= 4 ? substr($digits, -4) : (strlen($digits) > 0 ? str_pad($digits, 4, '0', STR_PAD_LEFT) : '0000');
            $callsign = !empty($u['callsign']) ? $u['callsign'] : ('RADIO-' . $last4);

            $contacts[] = [
                'id' => $u['id'],
                'name' => $u['name'],
                'callsign' => $callsign,
                'unit' => !empty($u['unit']) ? $u['unit'] : 'Sector Operativo Hidalgo C5i',
                'phone_number' => $u['phone_number'] ?? '',
                'email' => $u['correo'] ?? '',
                'status' => $u['status'] ?? 'online',
                'role' => $u['role'] ?? 'Oficial Operativo',
            ];
        }

        echo json_encode(['success' => true, 'contacts' => $contacts, 'total' => count($contacts)]);
    } catch (Exception $e) {
        echo json_encode(['success' => true, 'contacts' => [], 'total' => 0]);
    }
    exit();
}

// 3. REGISTRAR O ACTUALIZAR CONTACTO (POST / PUT)
if ($method === 'POST' || $method === 'PUT') {
    $contactId = $data['id'] ?? $_GET['id'] ?? null;
    $oldPhone = preg_replace('/\D/', '', $data['old_phone'] ?? $data['old_phone_number'] ?? '');
    $oldId = $data['old_id'] ?? null;
    
    $name = trim($data['name'] ?? trim(($data['first_name'] ?? '') . ' ' . ($data['last_name'] ?? '')));
    $phone = preg_replace('/\D/', '', $data['phone_number'] ?? $data['phone'] ?? '');
    $email = trim($data['email'] ?? $data['correo'] ?? '');
    $unit = trim($data['unit'] ?? 'Sector Operativo Hidalgo C5i');
    $role = trim($data['role'] ?? 'Oficial Operativo');

    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'El nombre es requerido']);
        exit();
    }
    if (empty($phone)) {
        $phone = '771' . rand(1000000, 9999999);
    }

    // Calcular indicativo con los últimos 4 dígitos del número celular actual
    $digits = preg_replace('/\D/', '', $phone);
    $last4 = strlen($digits) >= 4 ? substr($digits, -4) : (strlen($digits) > 0 ? str_pad($digits, 4, '0', STR_PAD_LEFT) : '0000');
    $autoCallsign = 'RADIO-' . $last4;
    $callsign = strtoupper(trim($data['callsign'] ?? ''));

    // Si el usuario cambió de número o no definió indicativo, actualizar al nuevo número
    if (empty($callsign) || !empty($oldPhone) && ($oldPhone !== $phone)) {
        $callsign = $autoCallsign;
    }

    try {
        // Buscar si ya existe en 'contactos' o 'users'
        $existing = null;
        if ($contactId && strpos($contactId, 'off-') !== 0) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$contactId]);
            $existing = $stmt->fetch();
        }
        if (!$existing && $oldPhone) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE phone_number = ? LIMIT 1");
            $stmt->execute([$oldPhone]);
            $existing = $stmt->fetch();
        }
        if (!$existing && $phone) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE phone_number = ? LIMIT 1");
            $stmt->execute([$phone]);
            $existing = $stmt->fetch();
        }

        $targetId = $existing ? $existing['id'] : (($contactId && strpos($contactId, 'off-') !== 0) ? $contactId : ('usr-cnt-' . time() . '-' . rand(100, 999)));

        // Guardar o actualizar en tabla 'contactos'
        $stmtC = $pdo->prepare("INSERT INTO contactos (id, name, phone_number, callsign, correo, unit, status) 
                                VALUES (?, ?, ?, ?, ?, ?, 'online') 
                                ON DUPLICATE KEY UPDATE name=VALUES(name), phone_number=VALUES(phone_number), callsign=VALUES(callsign), correo=VALUES(correo), unit=VALUES(unit), status='online'");
        $stmtC->execute([$targetId, $name, $phone, $callsign, $email ?: null, $unit]);

        // Guardar o actualizar en tabla 'users' para permitir PTT y llamadas de radio
        $stmtU = $pdo->prepare("INSERT INTO users (id, phone_number, name, correo, password_hash, callsign, unit, status, role, created_at, updated_at) 
                                VALUES (?, ?, ?, ?, '123', ?, ?, 'online', ?, NOW(), NOW()) 
                                ON DUPLICATE KEY UPDATE name=VALUES(name), phone_number=VALUES(phone_number), callsign=VALUES(callsign), correo=VALUES(correo), unit=VALUES(unit), status='online', updated_at=NOW()");
        $stmtU->execute([$targetId, $phone, $name, $email ?: null, $callsign, $unit, $role]);

        echo json_encode([
            'success' => true,
            'message' => 'Contacto sincronizado en tabla contactos y users',
            'contact' => [
                'id' => $targetId,
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
        echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
    }
    exit();
}
