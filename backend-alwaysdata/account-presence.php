<?php
// users.status es un valor antiguo, no una prueba de conexión. Solo se consideran
// pulsos recientes de una app en primer plano con sesión todavía válida.
const ACCOUNT_PRESENCE_TTL = 45;
function accountPresence(PDO $db, array $data, $owner, $token) {
    if (authenticateContactOwner($db,$token)!==$owner) throw new AccountRequestError(401,'Inicia sesión para consultar la actividad.');
    $ids=$data['ids'] ?? [];
    if (!is_array($ids) || array_values($ids)!==$ids || count($ids)>50) throw new AccountRequestError(400,'Consulta hasta 50 contactos a la vez.');
    foreach ($ids as $id) if (!is_string($id) || $id==='' || strlen($id)>128 || preg_match('/[\x00-\x1f\x7f]/',$id)) throw new AccountRequestError(400,'Revisa los contactos solicitados.');
    $ids=array_values(array_unique($ids)); $now=time(); $stamp=gmdate('Y-m-d H:i:s',$now);
    if (array_key_exists('active',$data)) {
        $client=$data['clientId'] ?? null;
        if (!is_bool($data['active']) || !is_string($client) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',$client)) throw new AccountRequestError(400,'Revisa la conexión de actividad.');
        $hash=hash('sha256',$token);
        if ($data['active']) {
            $db->prepare('INSERT INTO account_presence(token_hash,client_id,user_id,is_active,last_active_at) VALUES(?,?,?,1,?) ON DUPLICATE KEY UPDATE is_active=1,last_active_at=VALUES(last_active_at)')->execute([$hash,$client,$owner,$stamp]);
        } else {
            // Un segundo cierre no inventa una última conexión más reciente.
            $db->prepare('UPDATE account_presence SET is_active=0,last_active_at=? WHERE token_hash=? AND client_id=? AND user_id=? AND is_active=1')->execute([$stamp,$hash,$client,$owner]);
        }
    }
    $result=[];
    if ($ids) {
        $marks=implode(',',array_fill(0,count($ids),'?'));
        // La privacidad se aplica en el servidor a cada respuesta, nunca en la UI.
        $stmt=$db->prepare('SELECT u.id,COALESCE(v.show_last_seen,1) AS show_last_seen FROM users u LEFT JOIN account_privacy v ON v.user_id=u.id WHERE u.id IN ('.$marks.') AND (u.id=? OR EXISTS(SELECT 1 FROM contactos c WHERE c.owner_user_id=? AND c.phone_number=BINARY u.phone_number) OR EXISTS(SELECT 1 FROM channel_members mine JOIN channel_members peer ON peer.channel_id=mine.channel_id WHERE mine.user_id=? AND peer.user_id=BINARY u.id))');
        $stmt->execute(array_merge($ids,[$owner,$owner,$owner])); $allowed=[];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $allowed[(string)$row['id']]=(bool)$row['show_last_seen'];
        if ($allowed) {
            $marks=implode(',',array_fill(0,count($allowed),'?'));
            $stmt=$db->prepare('SELECT p.user_id,MAX(p.last_active_at) AS last_at,MAX(CASE WHEN p.is_active=1 AND s.expires_at>? THEN p.last_active_at ELSE NULL END) AS active_at FROM account_presence p LEFT JOIN auth_sessions s ON s.token_hash=p.token_hash AND s.user_id=p.user_id WHERE p.user_id IN ('.$marks.') GROUP BY p.user_id');
            $stmt->execute(array_merge([$stamp],array_keys($allowed)));
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) $result[(string)$row['user_id']]=$row;
        }
        $peers=[];
        foreach ($ids as $id) {
            $row=$result[$id] ?? []; $last=$row['last_at'] ?? null; $active=$row['active_at'] ?? null;
            $until=$active ? strtotime($active.' UTC')+ACCOUNT_PRESENCE_TTL : null;
            $online=$until!==null && $until>$now;
            $peers[]=['id'=>$id,'online'=>$online,'onlineUntil'=>$online?$until:null,'lastSeen'=>!empty($allowed[$id]) && $last ? str_replace(' ','T',$last).'Z' : null];
        }
    } else $peers=[];
    return ['success'=>true,'now'=>$now,'peers'=>$peers];
}
