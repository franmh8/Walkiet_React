<?php
// Diagnóstico público acotado: los detalles SQL y credenciales solo van al log.
function contactsErrorResponse(Throwable $error) {
    $code = 'CONTACTS_SERVER_ERROR';
    $message = 'No se pudo acceder al directorio de contactos. Revisa el registro PHP de Alwaysdata.';
    $status = 500;
    if ($error instanceof PDOException) {
        $sqlState = $error->errorInfo[0] ?? (string)$error->getCode();
        $driverCode = (int)($error->errorInfo[1] ?? 0);
        if ($sqlState === '42S02') {
            $code = 'CONTACTS_TABLE_MISSING';
            $message = 'Falta una tabla de la agenda o las sesiones. Ejecuta migrations/002_private_contacts.sql en la BD de conexion.php.';
            $status = 503;
        } elseif ($sqlState === '42S22') {
            $code = 'CONTACTS_SCHEMA_MISMATCH';
            $message = 'La agenda requiere la migración 002_private_contacts.sql. Revisa las columnas y el registro PHP.';
            $status = 503;
        } elseif (in_array($driverCode, [1044, 1045, 1142, 1143], true)) {
            $code = 'CONTACTS_DATABASE_PERMISSIONS';
            $message = 'La cuenta de conexion.php no tiene acceso suficiente a la BD de contactos. Revisa sus permisos en Alwaysdata.';
            $status = 503;
        } elseif (in_array($driverCode, [2002, 2003, 2006, 2013], true)) {
            $code = 'CONTACTS_DATABASE_UNAVAILABLE';
            $message = 'No se pudo conectar con MySQL. Revisa el servidor configurado en conexion.php.';
            $status = 503;
        }
    }
    return [$status, ['success' => false, 'code' => $code, 'message' => $message]];
}

function contactsRespond($status, $data) {
    http_response_code($status);
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function contactRows(PDO $pdo, array $rows) {
    if (!$rows) return [];
    $phones = array_values(array_unique(array_column($rows, 'phone_number')));
    $stmt = $pdo->prepare('SELECT id, phone_number, status FROM users WHERE phone_number IN (' . implode(',', array_fill(0, count($phones), '?')) . ')');
    $stmt->execute($phones);
    $accounts = [];
    foreach ($stmt->fetchAll() as $account) $accounts[$account['phone_number']] = $account;
    return array_map(function ($row) use ($accounts) {
        $account = $accounts[$row['phone_number']] ?? null;
        return [
            'id' => $row['id'], 'name' => $row['name'], 'phone_number' => $row['phone_number'],
            'callsign' => $row['callsign'] ?: 'RADIO-' . substr($row['phone_number'], -4),
            'email' => $row['correo'] ?? '', 'unit' => $row['unit'] ?? '',
            'status' => $account && in_array($account['status'], ['online', 'transmitting'], true) ? 'online' : 'offline',
            'registered_user_id' => $account ? (string)$account['id'] : null,
            'role' => 'Contacto personal',
        ];
    }, $rows);
}

// $ownerId se obtiene de la sesión validada; nunca del body ni del query string.
function handleContacts(PDO $pdo, $method, array $data, array $query = [], $ownerId = null) {
    if (!is_string($ownerId) || $ownerId === '') return [401, ['success' => false, 'code' => 'AUTH_REQUIRED', 'message' => 'Inicia sesión de nuevo para consultar tu agenda privada.']];
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $columns = 'c.id, c.name, c.phone_number, c.callsign, c.correo, c.unit';
    $method = strtoupper($method);
    if ($method === 'GET') {
        $limitText = $query['limit'] ?? '50';
        $search = $query['q'] ?? '';
        $cursor = $query['cursor'] ?? '';
        if (!is_scalar($limitText) || !preg_match('/^\d{1,3}$/', (string)$limitText) || (int)$limitText < 1 || (int)$limitText > 100 ||
            !is_string($search) || strlen($search) > 480 || !is_string($cursor) || strlen($cursor) > 2048) {
            return [422, ['success' => false, 'message' => 'Consulta inválida. Usa páginas de 1 a 100 contactos.']];
        }
        $limit = (int)$limitText;
        $sql = 'SELECT ' . $columns . ' FROM contactos c WHERE c.owner_user_id = ?';
        $params = [$ownerId];
        if ($cursor !== '') {
            $after = json_decode($cursor, true);
            if (!is_array($after) || !is_string($after['name'] ?? null) || !is_string($after['id'] ?? null) || strlen($after['name']) > 480 || strlen($after['id']) > 64) {
                return [422, ['success' => false, 'message' => 'Cursor de contactos inválido. Actualiza la agenda.']];
            }
            $sql .= ' AND (c.name > ? OR (c.name = ? AND c.id > ?))';
            array_push($params, $after['name'], $after['name'], $after['id']);
        }
        $search = trim($search);
        if ($search !== '') {
            $pattern = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search) . '%';
            $queries = [];
            foreach (['name', 'phone_number', 'correo', 'callsign'] as $field) {
                $queries[] = "SELECT id FROM contactos WHERE owner_user_id = ? AND $field LIKE ? ESCAPE '!'";
                array_push($params, $ownerId, $pattern);
            }
            $sql .= ' AND c.id IN (' . implode(' UNION ', $queries) . ')';
        }
        $sql .= ' ORDER BY c.name, c.id LIMIT ' . ($limit + 1);
        $stmt = $pdo->prepare($sql); $stmt->execute($params); $rows = $stmt->fetchAll();
        $more = count($rows) > $limit;
        if ($more) array_pop($rows);
        $last = $rows ? $rows[count($rows) - 1] : null;
        return [200, ['success' => true, 'contacts' => contactRows($pdo, $rows), 'has_more' => $more,
            'next_cursor' => $more ? json_encode(['name' => $last['name'], 'id' => $last['id']], JSON_UNESCAPED_UNICODE) : null]];
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
        $stmt = $pdo->prepare('SELECT ' . $columns . ' FROM contactos c WHERE c.id = ? AND c.owner_user_id = ?');
        $stmt->execute([$id, $ownerId]); $old = $stmt->fetch();
        if (!$old) return [404, ['success' => false, 'message' => 'El contacto no existe en tu agenda. Actualiza la lista.']];
    }
    if ($action === 'delete') {
        $stmt = $pdo->prepare('DELETE FROM contactos WHERE id = ? AND owner_user_id = ?'); $stmt->execute([$id, $ownerId]);
        if ($stmt->rowCount() !== 1) return [404, ['success' => false, 'message' => 'El contacto no existe en tu agenda.']];
        return [200, ['success' => true, 'id' => $id]];
    }
    foreach (['name', 'phone_number', 'email', 'correo', 'callsign', 'unit'] as $field) {
        if (isset($data[$field]) && !is_string($data[$field])) return [422, ['success' => false, 'message' => 'Los campos del contacto deben ser texto.']];
    }
    $name = trim($data['name'] ?? ''); $phone = preg_replace('/\D/', '', $data['phone_number'] ?? '');
    $email = trim($data['email'] ?? $data['correo'] ?? '');
    $unit = trim($data['unit'] ?? $old['unit'] ?? 'Sector Operativo Hidalgo C5i');
    $callsign = strtoupper(trim($data['callsign'] ?? $old['callsign'] ?? ''));
    if ($callsign === '' || ($old && $old['phone_number'] !== $phone)) $callsign = 'RADIO-' . substr($phone, -4);
    $length = function ($value) { return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value); };
    if ($name === '' || $length($name) > 120 || !preg_match('/^\d{10,15}$/', $phone) || $length($email) > 120 ||
        ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) || $length($callsign) > 50 || $length($unit) > 100) {
        return [422, ['success' => false, 'message' => 'Verifica nombre, teléfono (10 a 15 dígitos), correo, indicativo y unidad.']];
    }
    try {
        $pdo->beginTransaction();
        if ($action === 'create') {
            $id = 'cnt-' . bin2hex(random_bytes(16));
            $stmt = $pdo->prepare('INSERT INTO contactos (id, owner_user_id, name, phone_number, callsign, correo, unit) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$id, $ownerId, $name, $phone, $callsign, $email ?: null, $unit]);
        } else {
            $stmt = $pdo->prepare('UPDATE contactos SET name = ?, phone_number = ?, callsign = ?, correo = ?, unit = ? WHERE id = ? AND owner_user_id = ?');
            $stmt->execute([$name, $phone, $callsign, $email ?: null, $unit, $id, $ownerId]);
        }
        $stmt = $pdo->prepare('SELECT ' . $columns . ' FROM contactos c WHERE c.id = ? AND c.owner_user_id = ?');
        $stmt->execute([$id, $ownerId]); $saved = $stmt->fetch();
        if (!$saved) throw new RuntimeException('Contact missing after write');
        $result = contactRows($pdo, [$saved])[0];
        $pdo->commit();
        return [$action === 'create' ? 201 : 200, ['success' => true, 'contact' => $result]];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e instanceof PDOException && in_array((int)($e->errorInfo[1] ?? 0), [1062, 19], true)) return [409, ['success' => false, 'message' => 'Ya guardaste un contacto con ese teléfono en tu agenda.']];
        throw $e;
    }
}
