<?php
// La identidad proviene de auth_sessions. No se crean cuentas ni canales de ejemplo.
class ChannelsRequestError extends RuntimeException {
    public $status;
    public function __construct($status, $message) { parent::__construct($message); $this->status = $status; }
}
function channelRows(PDO $pdo, $owner, $id = null) {
    $sql = "SELECT c.id, c.name, c.access_code, c.is_private, c.created_by,
        (SELECT COUNT(DISTINCT m.user_id) FROM channel_members m WHERE m.channel_id = c.id) AS member_count
        FROM channels c WHERE EXISTS (SELECT 1 FROM channel_members mine WHERE mine.channel_id = c.id AND mine.user_id = ?)";
    $args = [$owner];
    if ($id !== null) { $sql .= ' AND c.id = ?'; $args[] = $id; }
    $stmt = $pdo->prepare($sql . ' ORDER BY c.created_at DESC, c.id');
    $stmt->execute($args);
    return array_map(function ($row) use ($owner) {
        return ['id' => (string)$row['id'], 'name' => $row['name'], 'category' => 'Táctico',
            'is_private' => (int)$row['is_private'], 'pin' => $row['access_code'],
            'created_by' => (string)$row['created_by'], 'is_owner' => (string)$row['created_by'] === $owner,
            'member_count' => (int)$row['member_count']];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC));
}
function handleChannels(PDO $pdo, $method, array $data, array $query, $owner) {
    if (!$owner) throw new ChannelsRequestError(401, 'Tu sesión venció. Inicia sesión de nuevo para consultar tus grupos.');
    $action = $method === 'GET' ? ($query['action'] ?? 'list') : ($data['action'] ?? ($method === 'DELETE' ? 'delete' : 'create'));
    $id = $data['id'] ?? $query['id'] ?? null;
    if ($action === 'list' && $method === 'GET') return ['success' => true, 'channels' => channelRows($pdo, $owner)];
    if ($action === 'members' && $method === 'GET') {
        $channels = channelRows($pdo, $owner, $id ?: '');
        if (!$channels) throw new ChannelsRequestError(404, 'No perteneces a este grupo.');
        $stmt = $pdo->prepare('SELECT DISTINCT u.id, u.name, u.callsign, u.unit FROM channel_members m INNER JOIN users u ON u.id = m.user_id WHERE m.channel_id = ? ORDER BY u.name, u.id LIMIT 100');
        $stmt->execute([$id]);
        return ['success' => true, 'members' => $stmt->fetchAll(PDO::FETCH_ASSOC), 'member_count' => $channels[0]['member_count']];
    }
    if (!in_array($method, ['POST', 'DELETE'], true) || !in_array($action, ['create', 'join', 'leave', 'delete'], true)) {
        throw new ChannelsRequestError(405, 'Operación de grupo no disponible.');
    }
    $pinLock = null;
    $pdo->beginTransaction();
    try {
        $accountLock=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $accountLock->execute([$owner]);
        if (!$accountLock->fetchColumn()) throw new ChannelsRequestError(401, 'La cuenta ya no está disponible.');
        if ($action === 'create') {
            $name = trim((string)($data['name'] ?? ''));
            if ($name === '' || strlen($name) > 100 * 4 || preg_match_all('/./us', $name) > 100) throw new ChannelsRequestError(400, 'Ingresa un nombre de hasta 100 caracteres.');
            $requested = trim((string)($data['pin'] ?? ''));
            if ($requested !== '' && !preg_match('/^\d{4}$/D', $requested)) throw new ChannelsRequestError(400, 'El PIN debe contener 4 dígitos.');
            for ($attempt = 0; $attempt < 20; $attempt++) {
                $pin = $requested !== '' ? $requested : (string)random_int(1000, 9999);
                $lock = 'walkiet-channel-pin:' . $pin;
                $stmt = $pdo->prepare('SELECT GET_LOCK(?, 5)'); $stmt->execute([$lock]);
                if ((int)$stmt->fetchColumn() !== 1) throw new ChannelsRequestError(409, 'El PIN se está usando. Intenta de nuevo.');
                $pinLock = $lock;
                // Lectura actual bajo bloqueo: también evita la fotografía antigua de REPEATABLE READ.
                $stmt = $pdo->prepare('SELECT id FROM channels WHERE access_code = ? LIMIT 1 FOR UPDATE'); $stmt->execute([$pin]);
                if (!$stmt->fetchColumn()) break;
                $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$pinLock]); $pinLock = null;
                if ($requested !== '') throw new ChannelsRequestError(409, 'Ese PIN ya pertenece a otro grupo. Elige uno diferente.');
            }
            if ($pinLock === null) throw new ChannelsRequestError(409, 'No se pudo generar un PIN disponible.');
            $id = 'chan-' . bin2hex(random_bytes(16));
            $pdo->prepare("INSERT INTO channels (id, name, is_private, access_code, category, created_by) VALUES (?, ?, 0, ?, 'tactico', ?)")->execute([$id, $name, $pin, $owner]);
            $pdo->prepare('INSERT INTO channel_members (id, channel_id, user_id) VALUES (?, ?, ?)')->execute(['cm-' . bin2hex(random_bytes(16)), $id, $owner]);
        } elseif ($action === 'join') {
            $pin = trim((string)($data['pin'] ?? ''));
            if (!preg_match('/^\d{4}$/D', $pin)) throw new ChannelsRequestError(400, 'Ingresa un PIN válido de 4 dígitos.');
            $sql = 'SELECT id FROM channels WHERE access_code = ?'; $args = [$pin];
            if ($id) { $sql .= ' AND id = ?'; $args[] = $id; }
            $stmt = $pdo->prepare($sql . ' ORDER BY id LIMIT 2 FOR UPDATE'); $stmt->execute($args); $matches = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (!$matches) throw new ChannelsRequestError(404, 'No existe un grupo con ese PIN.');
            if (count($matches) !== 1) throw new ChannelsRequestError(409, 'Hay varios grupos con ese PIN. Utiliza el QR del grupo.');
            $id = $matches[0];
            $stmt = $pdo->prepare('SELECT id FROM channel_members WHERE channel_id = ? AND user_id = ? LIMIT 1'); $stmt->execute([$id, $owner]);
            if (!$stmt->fetchColumn()) $pdo->prepare('INSERT INTO channel_members (id, channel_id, user_id) VALUES (?, ?, ?)')->execute(['cm-' . bin2hex(random_bytes(16)), $id, $owner]);
        } else {
            $stmt = $pdo->prepare('SELECT created_by FROM channels WHERE id = ? FOR UPDATE'); $stmt->execute([$id]); $creator = $stmt->fetchColumn();
            if ($creator === false) throw new ChannelsRequestError(404, 'El grupo ya no existe.');
            if ($action === 'delete' && (string)$creator !== $owner) throw new ChannelsRequestError(403, 'Solo el creador puede eliminar el grupo.');
            if ($action === 'leave') {
                $pdo->prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?')->execute([$id, $owner]);
            } else {
                $pdo->prepare('DELETE FROM channel_members WHERE channel_id = ?')->execute([$id]);
                $pdo->prepare('DELETE FROM channels WHERE id = ?')->execute([$id]);
            }
        }
        $pdo->commit();
        return in_array($action, ['create', 'join'], true)
            ? ['success' => true, 'channel' => channelRows($pdo, $owner, $id)[0]]
            : ['success' => true, 'id' => $id];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    } finally {
        if ($pinLock !== null) $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$pinLock]);
    }
}
