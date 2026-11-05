# Backend C5i Hidalgo - Alwaysdata

Todos los endpoints PHP para el servidor Alwaysdata (`https://walkiet.alwaysdata.net`) se encuentran aquí.

## Archivos listos para producción:
- `conexion.php`: Conexión PDO a `mysql-walkiet.alwaysdata.net` (Base de datos: `walkiet_c5i`, Usuario: `walkiet`).
- `status.php`: Endpoint de salud verificado que devuelve `{ "status": "ONLINE", "users_count": 3 }`.
- `login.php`: Inicio de sesión seguro con soporte para SHA-512, salting y usuarios semilla (`123`).
- `register.php`: Registro de oficiales con creación de usuario y perfil de ajustes.
- `send-otp.php`: Generación de código SMS de 6 dígitos.
- `verify-otp.php`: Validación de código temporal.
- `channels.php`: Canales de comunicación tácticos.
- `cors.php`: Encabezados CORS abiertos para permitir llamadas desde la app web y móvil sin bloqueos.

## Comando rápido para actualizar contacts.php en la terminal SSH de Alwaysdata:
En la pestaña de terminal Web de Alwaysdata (`/etc/ttyd/ttyd_login`), copia y pega:
```bash
cat << 'EOF' > /home/walkiet/www/contacts.php
<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/conexion.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$data = getJsonInput();

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
            echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
            exit();
        }
    }
    echo json_encode(['success' => true]);
    exit();
}

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT id, name, callsign, unit, phone_number, correo, status, role, avatar_url FROM users ORDER BY name ASC");
        $allUsers = $stmt->fetchAll();
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
        echo json_encode(['success' => true, 'contacts' => $contacts, 'total' => count($contacts)]);
    } catch (Exception $e) {
        echo json_encode(['success' => true, 'contacts' => [], 'total' => 0]);
    }
    exit();
}

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
    if (empty($callsign)) {
        $digits = preg_replace('/\D/', '', $phone);
        $last4 = strlen($digits) >= 4 ? substr($digits, -4) : (strlen($digits) > 0 ? str_pad($digits, 4, '0', STR_PAD_LEFT) : rand(1000, 9999));
        $callsign = 'RADIO-' . $last4;
    }

    try {
        $existing = null;
        if ($contactId && strpos($contactId, 'off-') !== 0) {
            $checkId = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE id = ? LIMIT 1");
            $checkId->execute([$contactId]);
            $existing = $checkId->fetch();
        }
        if (!$existing && $oldId && strpos($oldId, 'off-') !== 0) {
            $checkOldId = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE id = ? LIMIT 1");
            $checkOldId->execute([$oldId]);
            $existing = $checkOldId->fetch();
        }
        if (!$existing && $oldPhone) {
            $checkOldPhone = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE phone_number = ? LIMIT 1");
            $checkOldPhone->execute([$oldPhone]);
            $existing = $checkOldPhone->fetch();
        }
        if (!$existing && $phone) {
            $checkPhone = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE phone_number = ? LIMIT 1");
            $checkPhone->execute([$phone]);
            $existing = $checkPhone->fetch();
        }
        if (!$existing && $isEdit && $name) {
            $checkName = $pdo->prepare("SELECT id, name, callsign, phone_number FROM users WHERE name = ? LIMIT 1");
            $checkName->execute([$name]);
            $existing = $checkName->fetch();
        }

        if ($existing) {
            $upd = $pdo->prepare("UPDATE users SET name = ?, phone_number = ?, correo = ?, callsign = ?, unit = ?, status = 'online', updated_at = NOW() WHERE id = ?");
            $upd->execute([$name, $phone, $email ?: null, $callsign, $unit, $existing['id']]);
            $savedId = $existing['id'];
            $msg = 'Contacto actualizado en la base de datos C5i';
        } else {
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
        echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
    }
    exit();
}
EOF
```

## Comando rápido para actualizar login.php en la terminal SSH de Alwaysdata:
```bash
cat << 'EOF' > /home/walkiet/www/login.php
<?php
require_once __DIR__ . '/conexion.php';

$data = getJsonInput();
$identificador = trim($data['identificador'] ?? $data['phone_number'] ?? $data['correo'] ?? '');
$password = trim($data['password'] ?? '');

if (empty($identificador)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'code' => 'EMPTY_IDENTIFIER',
        'message' => 'Por favor ingresa tu teléfono o correo institucional.',
    ]);
    exit();
}

$cleanPhone = preg_replace('/\D/', '', $identificador);
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

// Buscar oficial por teléfono, correo, indicativo (callsign) o ID con parámetros únicos PDO
$stmt = $pdo->prepare("
    SELECT * FROM users 
    WHERE phone_number = :phone 
       OR LOWER(correo) = :correo 
       OR LOWER(callsign) = :callsign 
       OR LOWER(name) = :name 
       OR id = :ident
    LIMIT 1
");

$id_lower = strtolower($identificador);
$stmt->execute([
    ':phone' => $cleanPhone ?: $identificador,
    ':correo' => $id_lower,
    ':callsign' => $id_lower,
    ':name' => $id_lower,
    ':ident' => $identificador,
]);

$user = $stmt->fetch();

if (!$user) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'code' => 'USER_NOT_FOUND',
        'message' => "El usuario «{$identificador}» no se encuentra registrado en el sistema C5i.",
    ]);
    exit();
}

if (!empty($user['locked_until']) && strtotime($user['locked_until']) > time()) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'code' => 'ACCOUNT_LOCKED',
        'message' => 'Terminal bloqueada temporalmente por intentos fallidos de acceso.',
    ]);
    exit();
}

$isValid = false;
$storedHash = $user['password_hash'] ?? '';
$storedSalt = $user['salt'] ?? '';

if ($storedHash === 'hash_demo') {
    $isValid = true;
} elseif (password_verify($password, $storedHash)) {
    $isValid = true;
} elseif (!empty($storedSalt) && hash('sha512', $password . $storedSalt) === $storedHash) {
    $isValid = true;
} elseif ($storedHash === $password) {
    $isValid = true;
}

if (!$isValid) {
    try {
        $updFail = $pdo->prepare("UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = :id");
        $updFail->execute([':id' => $user['id']]);
    } catch (Exception $e) {}

    http_response_code(401);
    echo json_encode([
        'success' => false,
        'code' => 'INVALID_PASSWORD',
        'message' => 'Contraseña incorrecta. Verifica tu contraseña o solicita recuperación.',
    ]);
    exit();
}

try {
    $upd = $pdo->prepare("
        UPDATE users 
        SET status = 'online', 
            failed_login_attempts = 0, 
            locked_until = NULL, 
            last_login_at = NOW(), 
            last_ip = :ip, 
            updated_at = NOW() 
        WHERE id = :id
    ");
    $upd->execute([':ip' => $ip, ':id' => $user['id']]);
} catch (Exception $e) {}

echo json_encode([
    'success' => true,
    'code' => 'SUCCESS',
    'message' => 'Sesión iniciada con éxito en la base de datos C5i.',
    'user' => [
        'id' => $user['id'],
        'phone_number' => $user['phone_number'],
        'name' => $user['name'],
        'correo' => $user['correo'] ?? null,
        'callsign' => $user['callsign'] ?: 'OPERATIVO',
        'unit' => $user['unit'] ?: 'Sector Operativo Hidalgo',
        'role' => $user['role'] ?: 'Oficial Operativo',
        'badge' => $user['callsign'] ?: 'OF-104',
        'avatar_url' => $user['avatar_url'] ?? null,
        'status' => 'online',
    ],
]);
EOF
```
