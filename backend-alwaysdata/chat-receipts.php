<?php
// Las entregas son acuses del dispositivo, nunca una inferencia de presencia.
function chatMessageRows(PDO $db, $where, array $args, $limit = 100, $descending = true, $summary = false, array $knownMedia = []) {
    $direction = $descending ? 'DESC' : 'ASC';
    $fields=$summary ? 'm.id,m.sender_id,m.thread_id,m.created_at' : 'm.*';
    if (!$summary && $knownMedia) {
        $marks=implode(',',array_fill(0,count($knownMedia),'?'));
        // El cliente conserva los archivos inmutables de estos mensajes.
        // No volver a transferir megabytes para actualizar solo las palomitas.
        $fields="m.id,m.thread_id,m.sender_id,m.content,m.media_type,m.file_name,m.created_at,
          CASE WHEN m.id IN ($marks) THEN NULL ELSE m.media_url END AS media_url,
          (m.id IN ($marks) AND m.media_url IS NOT NULL) AS media_unchanged";
        $args=array_merge($knownMedia,$knownMedia,$args);
    }
    $stmt = $db->prepare("SELECT $fields,u.name AS sender_name,u.callsign AS sender_callsign,
        (SELECT COUNT(*) FROM chat_thread_members cm WHERE cm.thread_id=m.thread_id AND cm.user_id<>m.sender_id) AS recipient_count,
        (SELECT COUNT(*) FROM chat_message_receipts r JOIN chat_thread_members cm ON cm.thread_id=m.thread_id AND cm.user_id=r.user_id
          WHERE r.message_id=m.id AND r.user_id<>m.sender_id) AS delivered_count,
        (SELECT COUNT(*) FROM chat_message_receipts r JOIN chat_thread_members cm ON cm.thread_id=m.thread_id AND cm.user_id=r.user_id
          LEFT JOIN account_read_privacy p ON p.user_id=r.user_id
          WHERE r.message_id=m.id AND r.user_id<>m.sender_id AND r.read_at IS NOT NULL AND COALESCE(p.read_receipts,1)=1) AS read_count,
        UNIX_TIMESTAMP(m.created_at) AS sent_epoch
        FROM chat_thread_messages m LEFT JOIN users u ON u.id=m.sender_id
        WHERE $where ORDER BY m.created_at $direction,m.id $direction LIMIT $limit");
    $stmt->execute($args);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    return $descending ? array_reverse($rows) : $rows;
}
function chatMessageStatus(array $row, $owner) {
    if ((string)$row['sender_id']!==$owner) return null;
    $count=(int)$row['recipient_count'];
    return $count>0 && (int)$row['read_count']>=$count ? 'read' :
        ($count>0 && (int)$row['delivered_count']>=$count ? 'delivered' : 'sent');
}
function chatMessageDto(array $row, $zone, $timestampColumn, $owner) {
    return array_merge([
        'id'=>(string)$row['id'], 'thread_id'=>(string)$row['thread_id'], 'sender_id'=>(string)$row['sender_id'],
        'sender_name'=>$row['sender_name'] ?: 'Oficial', 'sender_callsign'=>$row['sender_callsign'] ?: '',
        'text'=>$row['content'], 'mediaType'=>$row['media_type'], 'mediaUrl'=>$row['media_url'],
        'fileName'=>$row['file_name'], 'created_at'=>$row['created_at'],
        'media_unchanged'=>!empty($row['media_unchanged']),
        // Solo el remitente obtiene la confirmación de sus propios mensajes.
        'status'=>chatMessageStatus($row,$owner),
    ],chatTimeFields($row['created_at'],$zone,$timestampColumn ? $row['sent_epoch'] : null));
}
function chatAcknowledge(PDO $db, array $data, $owner) {
    $thread = $data['thread_id'] ?? '';
    $ids = $data['message_ids'] ?? null;
    $read = $data['read'] ?? false;
    if (!chatString($thread,64) || $thread==='' || !is_bool($read) || !is_array($ids) ||
        array_values($ids)!==$ids || count($ids)<1 || count($ids)>100) {
        chatRespond(422,['success'=>false,'message'=>'Confirmación de mensajes inválida.']);
    }
    foreach ($ids as $id) if (!chatString($id,64) || $id==='') chatRespond(422,['success'=>false,'message'=>'Mensaje inválido.']);
    if (!chatIsMember($db,$thread,$owner)) chatRespond(403,['success'=>false,'message'=>'No tienes acceso a esta conversación.']);
    $ids = array_values(array_unique($ids));
    $db->beginTransaction();
    // El mismo bloqueo que ajustes: apagar la privacidad y confirmar lecturas
    // se serializan; la opción se aplica aunque el cliente envíe read=true.
    $stmt=$db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $stmt->execute([$owner]);
    $stmt=$db->prepare('SELECT read_receipts FROM account_read_privacy WHERE user_id=?'); $stmt->execute([$owner]);
    $setting=$stmt->fetchColumn(); $read=$read && ($setting===false || (bool)$setting);
    $marks=implode(',',array_fill(0,count($ids),'?'));
    $stmt=$db->prepare("SELECT id FROM chat_thread_messages WHERE thread_id=? AND sender_id<>? AND id IN ($marks)");
    $stmt->execute(array_merge([$thread,$owner],$ids)); $valid=$stmt->fetchAll(PDO::FETCH_COLUMN);
    if (count($valid)!==count($ids)) {
        $db->rollBack(); chatRespond(422,['success'=>false,'message'=>'Solo puedes confirmar mensajes recibidos en este chat.']);
    }
    $stamp=(new DateTimeImmutable('now',new DateTimeZone('UTC')))->format('Y-m-d H:i:s.u');
    $stmt=$db->prepare('INSERT INTO chat_message_receipts(message_id,user_id,delivered_at,read_at) VALUES(?,?,?,?)
        ON DUPLICATE KEY UPDATE read_at=COALESCE(read_at,VALUES(read_at))');
    foreach ($ids as $id) $stmt->execute([$id,$owner,$stamp,$read ? $stamp : null]);
    $db->commit();
    return ['success'=>true,'read_recorded'=>$read];
}
