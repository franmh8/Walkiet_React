<?php
require_once __DIR__ . '/ptt-livekit.php';
function pttMember(PDO $db, $owner, $channel) {
    $stmt = $db->prepare('SELECT c.id, c.name FROM channels c WHERE c.id = ? AND EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = ?)');
    $stmt->execute([$channel, $owner]); $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) throw new PttRequestError(404, 'No perteneces a este grupo o el grupo ya no existe.');
    return $row;
}
function pttQueue(PDO $db, $owner, array $channel, $transmission) {
    $stmt = $db->prepare('SELECT name FROM users WHERE id = ?'); $stmt->execute([$owner]); $name = (string)$stmt->fetchColumn();
    $payload = json_encode(['title'=>'Actividad de radio', 'body'=>$name . ' inició una transmisión en ' . $channel['name'],
        'sound'=>'default', 'channelId'=>'ptt-radio', 'priority'=>'high', 'ttl'=>60,
        'data'=>['type'=>'ptt-live', 'channel_id'=>(string)$channel['id'], 'event_id'=>$transmission]], JSON_UNESCAPED_UNICODE);
    $stmt = $db->prepare("INSERT IGNORE INTO ptt_push_outbox (transmission_id, channel_id, sender_id, token_hash, payload, expires_at, available_at)
        SELECT DISTINCT ?, ?, ?, d.token_hash, ?, ?, ? FROM ptt_devices d
        INNER JOIN channel_members m ON m.user_id = d.user_id AND m.channel_id = ?
        INNER JOIN auth_sessions s ON s.token_hash = d.session_hash AND s.user_id = d.user_id AND s.expires_at > ?
        WHERE d.user_id <> ?");
    $now = gmdate('Y-m-d H:i:s');
    $stmt->execute([$transmission, $channel['id'], $owner, $payload, gmdate('Y-m-d H:i:s', time()+60), $now, $channel['id'], $now, $owner]);
}
function handlePtt(PDO $db, array $data, $owner, $token) {
    if (!$owner) throw new PttRequestError(401, 'Tu sesión venció. Inicia sesión de nuevo para usar la radio.');
    $action = $data['action'] ?? '';
    if (in_array($action, ['register_device', 'unregister_device'], true)) {
        $push = $data['push_token'] ?? '';
        if (!is_string($push) || !preg_match('/^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_-]{10,200}\]$/D', $push)) throw new PttRequestError(400, 'El token de notificaciones no es válido.');
        $hash = hash('sha256', $push);
        if ($action === 'unregister_device') {
            $db->prepare('DELETE FROM ptt_devices WHERE token_hash = ? AND user_id = ? AND session_hash = ?')->execute([$hash, $owner, hash('sha256', $token)]);
        } else {
            $platform = $data['platform'] ?? '';
            if (!in_array($platform, ['android', 'ios'], true)) throw new PttRequestError(400, 'Las notificaciones requieren Android o iPhone.');
            $db->prepare('INSERT INTO ptt_devices (token_hash, push_token, user_id, session_hash, platform, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), session_hash=VALUES(session_hash), platform=VALUES(platform), updated_at=VALUES(updated_at)')
                ->execute([$hash, $push, $owner, hash('sha256', $token), $platform, gmdate('Y-m-d H:i:s')]);
        }
        return ['success'=>true];
    }
    $channelId = $data['channel_id'] ?? '';
    $device = $data['device_id'] ?? '';
    if (!is_string($channelId) || $channelId === '' || strlen($channelId) > 64 || !is_string($device) || !preg_match('/^[a-f0-9]{32}$/D', $device)) throw new PttRequestError(400, 'Selecciona un grupo y un dispositivo válidos.');
    $identity = pttIdentity($owner, $device);
    $config = pttConfig();
    if ($action === 'disconnect') {
        pttRpc($config, 'RemoveParticipant', ['room'=>pttRoom($channelId), 'identity'=>$identity], true);
        $db->prepare('DELETE FROM ptt_connections WHERE channel_id = ? AND identity = ? AND user_id = ?')->execute([$channelId, $identity, $owner]);
        return ['success'=>true];
    }
    $channel = pttMember($db, $owner, $channelId);
    if (in_array($action, ['connect', 'start'], true)) {
        $last = $db->query("SELECT heartbeat_at FROM ptt_runtime WHERE id=1")->fetchColumn();
        if (!$last || strtotime($last . ' UTC') < time()-15) throw new PttRequestError(503, 'El servicio de radio está detenido. Solicita que se inicie ptt-worker.php.');
    }
    if ($action === 'connect') {
        $stmt = $db->prepare('SELECT name FROM users WHERE id = ?'); $stmt->execute([$owner]); $name = $stmt->fetchColumn();
        $db->prepare('INSERT INTO ptt_connections (channel_id, identity, user_id, session_hash, updated_at) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE session_hash=VALUES(session_hash), updated_at=VALUES(updated_at)')
            ->execute([$channelId, $identity, $owner, hash('sha256', $token), gmdate('Y-m-d H:i:s')]);
        return ['success'=>true, 'url'=>$config['url'], 'room'=>pttRoom($channelId), 'identity'=>$identity,
            'token'=>pttJwt($config, ['sub'=>$identity, 'name'=>$name, 'video'=>['roomJoin'=>true, 'room'=>pttRoom($channelId),
                'canSubscribe'=>true, 'canPublish'=>false, 'canPublishData'=>false, 'canPublishSources'=>['microphone']]]), 'max_transmission_seconds'=>45];
    }
    if ($action === 'notify') {
        $transmission = $data['transmission_id'] ?? '';
        if (!is_string($transmission) || !preg_match('/^[a-f0-9]{32}$/D', $transmission)) throw new PttRequestError(400, 'La transmisión no es válida.');
        $stmt = $db->prepare('SELECT 1 FROM ptt_floor WHERE channel_id=? AND identity=? AND holder_user_id=? AND transmission_id=? AND expires_at>?');
        $stmt->execute([$channelId, $identity, $owner, $transmission, gmdate('Y-m-d H:i:s')]);
        if (!$stmt->fetchColumn()) return ['success'=>true, 'push'=>['accepted'=>0]];
        // Confirmar publicación real: pulsar y soltar antes de obtener el turno no debe generar un aviso ficticio.
        $participant = pttRpc($config, 'GetParticipant', ['room'=>pttRoom($channelId), 'identity'=>$identity], true);
        $published = false;
        foreach ($participant['tracks'] ?? [] as $track) if (in_array($track['source'] ?? null, [2, 'MICROPHONE', 'microphone'], true) && empty($track['muted'])) $published = true;
        if (!$published) return ['success'=>true, 'push'=>['accepted'=>0]];
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('SELECT identity, transmission_id, expires_at FROM ptt_floor WHERE channel_id=? FOR UPDATE');
            $stmt->execute([$channelId]); $floor = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($floor && $floor['identity']===$identity && $floor['transmission_id']===$transmission && strtotime($floor['expires_at'].' UTC')>time()) pttQueue($db, $owner, $channel, $transmission);
            $db->commit();
        } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
        return ['success'=>true, 'push'=>pttDispatchPush($db, $config)];
    }
    if (!in_array($action, ['start', 'heartbeat', 'stop'], true)) throw new PttRequestError(400, 'Operación PTT no disponible.');
    $transmission = $data['transmission_id'] ?? '';
    if (!is_string($transmission) || !preg_match('/^[a-f0-9]{32}$/D', $transmission)) throw new PttRequestError(400, 'La transmisión no es válida.');
    $granted = false;
    $db->beginTransaction();
    try {
        $db->prepare('INSERT IGNORE INTO ptt_floor (channel_id) VALUES (?)')->execute([$channelId]);
        $stmt = $db->prepare('SELECT * FROM ptt_floor WHERE channel_id = ? FOR UPDATE'); $stmt->execute([$channelId]); $floor = $stmt->fetch(PDO::FETCH_ASSOC);
        $now = time();
        $current = $floor['identity'] === $identity && $floor['transmission_id'] === $transmission;
        $active = !empty($floor['identity']) && strtotime($floor['expires_at'] . ' UTC') > $now;
        if ($action === 'stop') {
            // Una liberación atrasada no puede silenciar una pulsación posterior.
            if ($current) {
                pttPermission($config, $channelId, $identity, false, true);
                $db->prepare('UPDATE ptt_floor SET holder_user_id=NULL, identity=NULL, transmission_id=NULL, expires_at=NULL WHERE channel_id = ?')->execute([$channelId]);
            }
            $db->commit(); return ['success'=>true];
        }
        if ($action === 'heartbeat') {
            if (!$current || !$active || strtotime($floor['started_at'] . ' UTC') + 45 <= $now) throw new PttRequestError(409, 'La transmisión terminó. Suelta el botón para volver a hablar.');
            $expires = min($now+12, strtotime($floor['started_at'] . ' UTC')+45);
            $db->prepare('UPDATE ptt_floor SET expires_at = ? WHERE channel_id = ?')->execute([gmdate('Y-m-d H:i:s', $expires), $channelId]);
            $db->commit(); return ['success'=>true, 'expires_at'=>$expires];
        }
        $stmt = $db->prepare('SELECT 1 FROM ptt_connections WHERE channel_id = ? AND identity = ? AND session_hash = ?');
        $stmt->execute([$channelId, $identity, hash('sha256', $token)]);
        if (!$stmt->fetchColumn()) throw new PttRequestError(409, 'Conecta la radio antes de hablar.');
        if ($active && !$current) throw new PttRequestError(409, 'El canal está ocupado. Espera a que termine la otra persona.');
        if ($active && $current) { $db->commit(); return ['success'=>true, 'transmission_id'=>$transmission, 'expires_at'=>strtotime($floor['expires_at'].' UTC')]; }
        if (!empty($floor['identity'])) pttPermission($config, $channelId, $floor['identity'], false, true);
        $db->prepare('UPDATE ptt_floor SET holder_user_id=?, identity=?, transmission_id=?, started_at=?, expires_at=? WHERE channel_id=?')
            ->execute([$owner, $identity, $transmission, gmdate('Y-m-d H:i:s', $now), gmdate('Y-m-d H:i:s', $now+12), $channelId]);
        // Registrar el lease antes de habilitar el audio permite compensar un timeout ambiguo.
        $granted = true;
        pttPermission($config, $channelId, $identity, true);
        $db->commit();
        return ['success'=>true, 'transmission_id'=>$transmission, 'expires_at'=>$now+12];
    } catch (Throwable $error) {
        $revoked = !$granted;
        if ($granted) { try { pttPermission($config, $channelId, $identity, false, true); $revoked = true; } catch (Throwable $ignored) {} }
        if ($db->inTransaction()) {
            if ($revoked) $db->rollBack();
            else {
                // Conservar una tarea de revocación si el servidor multimedia no responde.
                $db->prepare('UPDATE ptt_floor SET expires_at=? WHERE channel_id=?')->execute([gmdate('Y-m-d H:i:s'), $channelId]);
                $db->commit();
            }
        }
        throw $error;
    }
}
function pttDispatchPush(PDO $db, array $config) {
    $now = gmdate('Y-m-d H:i:s');
    $db->prepare("UPDATE ptt_push_outbox SET state='expired' WHERE state IN ('pending','sending') AND expires_at <= ?")->execute([$now]);
    $db->prepare("UPDATE ptt_push_outbox SET state='pending' WHERE state='sending' AND available_at < ? AND attempts < 3")->execute([$now]);
    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT o.id, o.payload, d.push_token, d.user_id AS recipient_id FROM ptt_push_outbox o INNER JOIN ptt_devices d ON d.token_hash=o.token_hash
            INNER JOIN auth_sessions s ON s.token_hash=d.session_hash AND s.user_id=d.user_id AND s.expires_at > ?
            WHERE o.state='pending' AND o.available_at<=? AND o.expires_at>? AND o.attempts<3
            AND EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id=o.channel_id AND m.user_id=d.user_id)
            AND EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id=o.channel_id AND m.user_id=o.sender_id)
            AND d.user_id<>o.sender_id ORDER BY o.id LIMIT 100 FOR UPDATE");
        $stmt->execute([$now, $now, $now]); $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) $db->prepare("UPDATE ptt_push_outbox SET state='sending', attempts=attempts+1, available_at=? WHERE id=?")->execute([gmdate('Y-m-d H:i:s', time()+15), $row['id']]);
        $db->commit();
    } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
    if (!$rows) return ['accepted'=>0];
    // Preferencias por destinatario, consultadas al despachar y no al iniciar el emisor.
    $soundByUser = []; $noticesByUser = [];
    $exists = $db->query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_settings'")->fetchColumn();
    if ($exists) {
        $recipients = array_values(array_unique(array_column($rows,'recipient_id')));
        $stmt = $db->prepare('SELECT user_id, channel_message_sounds, push_notifications FROM user_settings WHERE user_id IN ('.implode(',',array_fill(0,count($recipients),'?')).')');
        $stmt->execute($recipients);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $preference) { $soundByUser[(string)$preference['user_id']] = (bool)$preference['channel_message_sounds']; $noticesByUser[(string)$preference['user_id']] = (bool)$preference['push_notifications']; }
    }
    $rows = array_values(array_filter($rows, function($row) use ($db, $noticesByUser) {
        if (isset($noticesByUser[(string)$row['recipient_id']]) && !$noticesByUser[(string)$row['recipient_id']]) { $db->prepare("UPDATE ptt_push_outbox SET state='disabled' WHERE id=?")->execute([$row['id']]); return false; }
        return true;
    }));
    if (!$rows) return ['accepted'=>0];
    $payloads = array_map(function($row) use ($soundByUser) {
        $payload = array_merge(json_decode($row['payload'], true), ['to'=>$row['push_token']]);
        if (isset($soundByUser[(string)$row['recipient_id']]) && !$soundByUser[(string)$row['recipient_id']]) { unset($payload['sound']); $payload['channelId']='ptt-radio-silent'; }
        return $payload;
    }, $rows);
    $url = 'https://exp.host/--/api/v2/push/send';
    if (getenv('WALKIET_PTT_TESTING') === '1' && preg_match('#^http://127\.0\.0\.1:\d+$#D', getenv('WALKIET_PTT_PUSH_TEST_URL') ?: '')) $url = getenv('WALKIET_PTT_PUSH_TEST_URL') . '/push';
    $headers = !empty($config['expo_access_token']) ? ['Authorization: Bearer ' . $config['expo_access_token']] : [];
    [$status, $response] = pttHttpJson($url, $payloads, $headers); $accepted = 0;
    foreach ($rows as $index=>$row) {
        $ticket = $response['data'][$index] ?? null;
        if ($status === 200 && ($ticket['status'] ?? '') === 'ok' && !empty($ticket['id'])) {
            $db->prepare("UPDATE ptt_push_outbox SET state='accepted', ticket_id=? WHERE id=?")->execute([$ticket['id'], $row['id']]); $accepted++;
        } elseif (($ticket['details']['error'] ?? '') === 'DeviceNotRegistered') {
            $db->prepare('DELETE FROM ptt_devices WHERE token_hash=?')->execute([hash('sha256', $row['push_token'])]);
            $db->prepare("UPDATE ptt_push_outbox SET state='invalid' WHERE id=?")->execute([$row['id']]);
        } else $db->prepare("UPDATE ptt_push_outbox SET state='pending', available_at=? WHERE id=?")->execute([gmdate('Y-m-d H:i:s', time()+5), $row['id']]);
    }
    if ($status !== 200) error_log('PTT push: HTTP ' . $status . ', avisos pendientes de reintento.');
    return ['accepted'=>$accepted, 'pending'=>count($rows)-$accepted]; // No significa recibido por el teléfono.
}
function pttSweep(PDO $db, array $config) {
    // El servicio debe ejecutarse cada segundo: corta micrófonos con lease vencido
    // y revoca oyentes que cerraron sesión o salieron del grupo.
    $stmt = $db->prepare('SELECT channel_id FROM ptt_floor WHERE identity IS NOT NULL AND expires_at <= ? LIMIT 50');
    $stmt->execute([gmdate('Y-m-d H:i:s')]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $channel) {
        $db->beginTransaction();
        try {
            $stmt = $db->prepare('SELECT * FROM ptt_floor WHERE channel_id=? FOR UPDATE'); $stmt->execute([$channel]); $floor=$stmt->fetch(PDO::FETCH_ASSOC);
            if ($floor['identity'] && strtotime($floor['expires_at'].' UTC') <= time()) {
                pttPermission($config, $channel, $floor['identity'], false, true);
                $db->prepare('UPDATE ptt_floor SET holder_user_id=NULL, identity=NULL, transmission_id=NULL, expires_at=NULL WHERE channel_id=?')->execute([$channel]);
            }
            $db->commit();
        } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
    }
    $stmt=$db->prepare('SELECT p.* FROM ptt_connections p WHERE NOT EXISTS (SELECT 1 FROM auth_sessions s WHERE s.token_hash=p.session_hash AND s.user_id=p.user_id AND s.expires_at>?) OR NOT EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id=p.channel_id AND m.user_id=p.user_id) LIMIT 50');
    $stmt->execute([gmdate('Y-m-d H:i:s')]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        pttRpc($config, 'RemoveParticipant', ['room'=>pttRoom($row['channel_id']), 'identity'=>$row['identity']], true);
        $db->prepare('DELETE FROM ptt_connections WHERE channel_id=? AND identity=? AND session_hash=?')->execute([$row['channel_id'], $row['identity'], $row['session_hash']]);
        // Solo después de revocar ese participante invalidado, liberar su propio turno.
        $db->prepare('UPDATE ptt_floor SET holder_user_id=NULL, identity=NULL, transmission_id=NULL, expires_at=NULL WHERE channel_id=? AND identity=? AND holder_user_id=?')->execute([$row['channel_id'], $row['identity'], $row['user_id']]);
    }
}

function pttPrune(PDO $db) {
    $db->prepare('DELETE FROM ptt_push_outbox WHERE expires_at < ? LIMIT 1000')->execute([gmdate('Y-m-d H:i:s', time()-86400)]);
    $db->prepare('DELETE FROM ptt_devices WHERE NOT EXISTS (SELECT 1 FROM auth_sessions s WHERE s.token_hash=ptt_devices.session_hash AND s.user_id=ptt_devices.user_id AND s.expires_at>?) LIMIT 500')->execute([gmdate('Y-m-d H:i:s')]);
}
