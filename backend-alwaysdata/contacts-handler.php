<?php
function contactsRespond($status, $data) {
    http_response_code($status);
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function contactRow($row) {
    return [
        'id' => $row['id'], 'name' => $row['name'], 'phone_number' => $row['phone_number'],
        'callsign' => $row['callsign'] ?: 'RADIO-' . substr($row['phone_number'], -4),
        'email' => $row['correo'] ?? '', 'unit' => $row['unit'] ?? '',
        'status' => $row['status'] ?? 'offline', 'role' => 'Oficial Operativo',
    ];
}

function handleContacts(PDO $pdo, $method, array $data, array $query = []) {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $method = strtoupper($method);
    if ($method === 'GET') {
        // GET nunca elimina ni oculta errores de SQL como listas vacías.
        $rows = $pdo->query('SELECT * FROM contactos ORDER BY name, id')->fetchAll();
        return [200, ['success' => true, 'contacts' => array_map('contactRow', $rows), 'total' => count($rows)]];
    }
    $action = $method === 'DELETE' ? 'delete' : ($method === 'PUT' ? 'update' : ($data['action'] ?? 'create'));
    if (!in_array($method, ['POST', 'PUT', 'DELETE'], true) || !in_array($action, ['create', 'update', 'delete'], true)) {
        return [405, ['success' => false, 'message' => 'Operación de contactos no soportada.']];
    }
    $id = $data['id'] ?? $query['id'] ?? '';
    if ($action !== 'create' && (!is_string($id) || $id === '' || strlen($id) > 64)) {
        return [422, ['success' => false, 'message' => 'Se requiere el ID del contacto.']];
    }
    $old = null;
    if ($action !== 'create') {
        $stmt = $pdo->prepare('SELECT * FROM contactos WHERE id = ?');
        $stmt->execute([$id]);
        $old = $stmt->fetch();
        if (!$old) return [404, ['success' => false, 'message' => 'El contacto ya no existe. Actualiza la lista.']];
    }
    if ($action === 'delete') {
        $stmt = $pdo->prepare('DELETE FROM contactos WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() !== 1) return [404, ['success' => false, 'message' => 'El contacto ya no existe.']];
        return [200, ['success' => true, 'id' => $id]];
    }
    foreach (['name', 'phone_number', 'email', 'correo', 'callsign', 'unit'] as $field) {
        if (isset($data[$field]) && !is_string($data[$field])) {
            return [422, ['success' => false, 'message' => 'Los campos del contacto deben ser texto.']];
        }
    }
    $name = trim($data['name'] ?? '');
    $phone = preg_replace('/\D/', '', $data['phone_number'] ?? '');
    $email = trim($data['email'] ?? $data['correo'] ?? '');
    $unit = trim($data['unit'] ?? $old['unit'] ?? 'Sector Operativo Hidalgo C5i');
    $callsign = strtoupper(trim($data['callsign'] ?? $old['callsign'] ?? ''));
    if ($callsign === '' || ($old && $old['phone_number'] !== $phone)) $callsign = 'RADIO-' . substr($phone, -4);
    $length = function ($value) { return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value); };
    if ($name === '' || $length($name) > 120 || !preg_match('/^\d{10,15}$/', $phone) ||
        $length($email) > 120 || ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) ||
        $length($callsign) > 50 || $length($unit) > 100) {
        return [422, ['success' => false, 'message' => 'Verifica nombre (máx. 120), teléfono (10 a 15 dígitos), correo, indicativo (máx. 50) y unidad (máx. 100).']];
    }
    try {
        $pdo->beginTransaction();
        if ($action === 'create') {
            $id = 'cnt-' . bin2hex(random_bytes(16));
            $stmt = $pdo->prepare("INSERT INTO contactos (id, name, phone_number, callsign, correo, unit, status) VALUES (?, ?, ?, ?, ?, ?, 'offline')");
            $stmt->execute([$id, $name, $phone, $callsign, $email ?: null, $unit]);
        } else {
            $stmt = $pdo->prepare('UPDATE contactos SET name = ?, phone_number = ?, callsign = ?, correo = ?, unit = ? WHERE id = ?');
            $stmt->execute([$name, $phone, $callsign, $email ?: null, $unit, $id]);
        }
        $stmt = $pdo->prepare('SELECT * FROM contactos WHERE id = ?');
        $stmt->execute([$id]);
        $saved = $stmt->fetch();
        if (!$saved) throw new RuntimeException('Contact missing after write');
        $pdo->commit();
        return [$action === 'create' ? 201 : 200, ['success' => true, 'contact' => contactRow($saved)]];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e instanceof PDOException && (int)($e->errorInfo[1] ?? 0) === 1062) {
            return [409, ['success' => false, 'message' => 'Ya existe un contacto con ese teléfono.']];
        }
        throw $e;
    }
}
