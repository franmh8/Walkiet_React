<?php
class AccountRequestError extends RuntimeException {
    public $status;
    public function __construct($status, $message) { parent::__construct($message); $this->status = $status; }
}
function accountTableExists(PDO $db, $table) {
    $stmt=$db->prepare('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');
    $stmt->execute([$table]); return (bool)$stmt->fetchColumn();
}
function accountSnapshot(PDO $db, $owner) {
    $stmt=$db->prepare('SELECT * FROM users WHERE id=?'); $stmt->execute([$owner]); $user=$stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) throw new AccountRequestError(401, 'La cuenta ya no está disponible. Inicia sesión de nuevo.');
    $stmt=$db->prepare('SELECT * FROM user_settings WHERE user_id=?'); $stmt->execute([$owner]); $prefs=$stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $stmt=$db->prepare('SELECT image_data FROM account_avatars WHERE user_id=?'); $stmt->execute([$owner]);
    $avatar=$stmt->fetchColumn() ?: null;
    if (!$avatar && preg_match('#^https://#i', $user['avatar_url'] ?? '')) $avatar=$user['avatar_url'];
    return ['success'=>true, 'user'=>[
        'id'=>(string)$user['id'], 'name'=>$user['name'], 'phone_number'=>$user['phone_number'],
        'correo'=>$user['correo'] ?? null, 'unit'=>$user['unit'] ?? '', 'role'=>$user['role'] ?? '',
        'callsign'=>$user['callsign'] ?? '', 'avatar_url'=>$avatar,
    ], 'settings'=>[
        'theme'=>$prefs['theme_mode'] ?? 'system', 'pttMode'=>$prefs['ptt_mode'] ?? 'hold',
        'messageSounds'=>!isset($prefs['channel_message_sounds']) || (bool)$prefs['channel_message_sounds'],
        'rogerBeep'=>!isset($prefs['roger_beep']) || (bool)$prefs['roger_beep'],
        'backgroundNotifications'=>!empty($prefs['push_notifications']),
    ]];
}
function accountText($value, $label, $max, $allowEmpty=false) {
    if (!is_string($value)) throw new AccountRequestError(400, 'Revisa '.$label.'.');
    $value=trim($value);
    if ((!$allowEmpty && $value==='') || preg_match('//u',$value)!==1 || preg_match('/[\x00-\x1f\x7f]/', $value) || preg_match_all('/./us', $value)>$max || strlen($value)>$max*4) throw new AccountRequestError(400, $label.' debe contener '.($allowEmpty ? 'hasta ' : 'entre 1 y ').$max.' caracteres.');
    return $value;
}
function handleAccount(PDO $db, array $data, $owner) {
    if (!$owner) throw new AccountRequestError(401, 'Tu sesión venció. Inicia sesión de nuevo.');
    $action=$data['action'] ?? 'get';
    if ($action==='get') return accountSnapshot($db, $owner);
    if (!in_array($action,['update','settings','avatar','delete'],true)) throw new AccountRequestError(400, 'Operación de cuenta no disponible.');
    // Ninguna identidad, rol, teléfono, hash o columna SQL procede del cliente.
    $db->beginTransaction();
    try {
        $stmt=$db->prepare('SELECT * FROM users WHERE id=? FOR UPDATE'); $stmt->execute([$owner]); $user=$stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) throw new AccountRequestError(401, 'La cuenta ya no está disponible.');
        if ($action==='delete') {
            if (($data['confirmation'] ?? '')!=='ELIMINAR' || !verifyAccountPassword($data['password'] ?? null, $user)) throw new AccountRequestError(403, 'Confirma ELIMINAR y verifica tu contraseña actual.');
            $stmt=$db->prepare('SELECT id FROM channels WHERE created_by=? LIMIT 1 FOR UPDATE'); $stmt->execute([$owner]);
            if ($stmt->fetchColumn()) throw new AccountRequestError(409, 'Antes de eliminar tu cuenta debes eliminar los grupos que administras. Los grupos de otras personas se conservan.');
            // Mantener ptt_connections para que el worker expulse las conexiones revocadas.
            if (accountTableExists($db,'ptt_devices')) {
                $db->prepare('DELETE FROM ptt_push_outbox WHERE token_hash IN (SELECT token_hash FROM ptt_devices WHERE user_id=?)')->execute([$owner]);
                $db->prepare('DELETE FROM ptt_devices WHERE user_id=?')->execute([$owner]);
                $db->prepare('DELETE FROM ptt_push_outbox WHERE sender_id=?')->execute([$owner]);
            }
            if (accountTableExists($db,'contacts')) $db->prepare('DELETE FROM contacts WHERE user_id=? OR contact_user_id=?')->execute([$owner,$owner]);
            $db->prepare('DELETE FROM channel_members WHERE user_id=?')->execute([$owner]);
            $db->prepare('DELETE FROM contactos WHERE owner_user_id=?')->execute([$owner]);
            $db->prepare('DELETE FROM auth_sessions WHERE user_id=?')->execute([$owner]);
            $db->prepare('DELETE FROM user_settings WHERE user_id=?')->execute([$owner]);
            $db->prepare('DELETE FROM account_avatars WHERE user_id=?')->execute([$owner]);
            if (accountTableExists($db,'sms_otps')) $db->prepare('DELETE FROM sms_otps WHERE phone_number=?')->execute([$user['phone_number']]);
            $db->prepare('DELETE FROM users WHERE id=?')->execute([$owner]);
            $db->commit(); return ['success'=>true, 'deleted'=>true];
        }
        if ($action==='update') {
            $patch=$data['fields'] ?? null;
            if (!is_array($patch) || !$patch || array_diff(array_keys($patch), ['name','unit','correo'])) throw new AccountRequestError(400, 'Solo puedes editar nombre, unidad y correo.');
            $sets=[]; $args=[];
            foreach ($patch as $field=>$value) {
                $value=accountText($value, ['name'=>'El nombre','unit'=>'La unidad','correo'=>'El correo'][$field], $field==='unit'?100:120, $field!=='name');
                if ($field==='correo' && $value!=='') {
                    if (!filter_var($value,FILTER_VALIDATE_EMAIL)) throw new AccountRequestError(400, 'Ingresa un correo válido.');
                    $value=strtolower($value);
                    $stmt=$db->prepare('SELECT id FROM users WHERE correo=? AND id<>? LIMIT 1 FOR UPDATE'); $stmt->execute([$value,$owner]);
                    if ($stmt->fetchColumn()) throw new AccountRequestError(409, 'Ese correo ya está registrado en otra cuenta.');
                }
                $sets[]=$field.'=?'; $args[]=$field==='correo' && $value==='' ? null : $value;
            }
            $args[]=$owner;
            $db->prepare('UPDATE users SET '.implode(',',$sets).' WHERE id=?')->execute($args);
        } else {
            if ($action==='avatar') {
                $db->prepare('INSERT IGNORE INTO account_avatars (user_id) VALUES (?)')->execute([$owner]);
                $image=$data['image'] ?? null;
                if ($image!==null) {
                    if (!is_string($image) || strlen($image)>180000 || !preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$#D',$image,$match)) throw new AccountRequestError(400,'Selecciona una imagen JPEG, PNG o WebP de hasta 128 KB.');
                    $bytes=base64_decode($match[2],true); $info=$bytes!==false ? @getimagesizefromstring($bytes) : false;
                    if (!$info || strlen($bytes)>131072 || $info[0]>512 || $info[1]>512 || $info[0]<1 || $info[1]<1 || ($info['mime'] ?? '')!=='image/'.$match[1]) throw new AccountRequestError(400,'La imagen debe ser válida, de hasta 512 × 512 píxeles y 128 KB.');
                }
                $db->prepare('UPDATE account_avatars SET image_data=? WHERE user_id=?')->execute([$image,$owner]);
                if ($image===null && array_key_exists('avatar_url',$user)) $db->prepare('UPDATE users SET avatar_url=NULL WHERE id=?')->execute([$owner]);
            } else {
                $db->prepare('INSERT IGNORE INTO user_settings (user_id,push_notifications) VALUES (?,0)')->execute([$owner]);
                $patch=$data['settings'] ?? null;
                $map=['theme'=>'theme_mode','pttMode'=>'ptt_mode','messageSounds'=>'channel_message_sounds','rogerBeep'=>'roger_beep','backgroundNotifications'=>'push_notifications'];
                if (!is_array($patch) || !$patch || array_diff(array_keys($patch),array_keys($map))) throw new AccountRequestError(400,'Revisa las preferencias enviadas.');
                $sets=[]; $args=[];
                foreach ($patch as $key=>$value) {
                    if ($key==='theme' && !in_array($value,['light','dark','system'],true) || $key==='pttMode' && !in_array($value,['hold','toggle'],true) || in_array($key,['messageSounds','rogerBeep','backgroundNotifications'],true) && !is_bool($value)) throw new AccountRequestError(400,'Valor de preferencia no válido.');
                    $sets[]=$map[$key].'=?'; $args[]=is_bool($value)?(int)$value:$value;
                }
                $args[]=$owner; $db->prepare('UPDATE user_settings SET '.implode(',',$sets).' WHERE user_id=?')->execute($args);
                if (isset($patch['backgroundNotifications']) && !$patch['backgroundNotifications'] && accountTableExists($db,'ptt_devices')) $db->prepare('DELETE FROM ptt_devices WHERE user_id=?')->execute([$owner]);
            }
        }
        $result=accountSnapshot($db,$owner);
        $db->commit(); return $result;
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        if ($error instanceof PDOException && ($error->errorInfo[1] ?? null)===1451) throw new AccountRequestError(409,'Hay registros vinculados a la cuenta. Solicita al administrador que los revise antes de eliminarla. Tu cuenta se conserva.');
        throw $error;
    }
}
