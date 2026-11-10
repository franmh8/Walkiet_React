<?php
class SecurityRequestError extends RuntimeException {
    public $status;
    public function __construct($status,$message) { parent::__construct($message); $this->status=$status; }
}
function securityHash(array $config,$value) { return hash_hmac('sha256',$value,$config['code_secret']); }
function securityRate(PDO $db,array $config,array $limits) {
    $db->beginTransaction();
    try {
        foreach ($limits as [$key,$maximum,$seconds]) {
            $bucket=securityHash($config,$key); $now=gmdate('Y-m-d H:i:s'); $expiry=gmdate('Y-m-d H:i:s',time()+$seconds);
            $db->prepare('INSERT IGNORE INTO security_rate_limits(bucket,hits,expires_at) VALUES(?,0,?)')->execute([$bucket,$expiry]);
            $q=$db->prepare('SELECT hits,expires_at FROM security_rate_limits WHERE bucket=? FOR UPDATE'); $q->execute([$bucket]); $row=$q->fetch(PDO::FETCH_ASSOC);
            $hits=$row['expires_at']<=$now ? 0 : (int)$row['hits'];
            if ($hits>=$maximum) throw new SecurityRequestError(429,'Espera antes de volver a intentarlo.');
            $db->prepare('UPDATE security_rate_limits SET hits=?,expires_at=? WHERE bucket=?')->execute([$hits+1,$hits===0?$expiry:$row['expires_at'],$bucket]);
        }
        $db->commit();
    } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
}
function securityIdentifier($value) {
    if (!is_string($value) || strlen($value)>120) throw new SecurityRequestError(400,'Ingresa tu teléfono o correo.');
    $value=strtolower(trim($value));
    if (filter_var($value,FILTER_VALIDATE_EMAIL)) return $value;
    $phone=preg_replace('/[\s()+-]/','',$value);
    if (preg_match('/^\d{10,15}$/D',$phone)) return $phone;
    throw new SecurityRequestError(400,'Ingresa un teléfono o correo válido.');
}
function handleSecurity(PDO $db,array $data,$session,$ip,array $config,$afterQueued=null) {
    $action=$data['action'] ?? '';
    if (!in_array($action,['email_request','email_verify','recovery_request','recovery_verify','recovery_reset'],true)) throw new SecurityRequestError(400,'Operación de verificación no disponible.');
    $emailFlow=strpos($action,'email_')===0;
    $owner=$emailFlow ? authenticateContactOwner($db,$session) : null;
    if ($emailFlow && !$owner) throw new SecurityRequestError(401,'Tu sesión venció. Inicia sesión de nuevo.');
    $purpose=$emailFlow?'email_change':'password_reset';
    if (substr($action,-8)==='_request') {
        $identifier=securityIdentifier($emailFlow ? ($data['email'] ?? null) : ($data['identifier'] ?? null));
        if ($emailFlow && !filter_var($identifier,FILTER_VALIDATE_EMAIL)) throw new SecurityRequestError(400,'Ingresa un correo válido.');
        securityRate($db,$config,[['send-ip:'.$ip,20,3600],['send-target:'.$identifier,5,3600],['cooldown:'.$purpose.':'.($owner ?: $identifier),1,60]]);
        $db->beginTransaction();
        try {
            $q=$db->prepare($emailFlow?'SELECT * FROM users WHERE id=? FOR UPDATE':'SELECT * FROM users WHERE '.(strpos($identifier,'@')!==false?'correo':'phone_number').'=? LIMIT 1 FOR UPDATE');
            $q->execute([$emailFlow?$owner:$identifier]); $user=$q->fetch(PDO::FETCH_ASSOC) ?: null;
            if ($emailFlow) {
                if (!$user || !verifyAccountPassword($data['password'] ?? null,$user)) throw new SecurityRequestError(403,'Verifica tu contraseña actual.');
                if (strtolower($user['correo'] ?? '')===$identifier) throw new SecurityRequestError(400,'Ese ya es tu correo actual.');
                $duplicate=$db->prepare('SELECT id FROM users WHERE correo=? AND id<>? LIMIT 1'); $duplicate->execute([$identifier,$owner]);
                if ($duplicate->fetchColumn()) throw new SecurityRequestError(409,'Ese correo ya está registrado.');
            }
            $target=$emailFlow?$identifier:($user['correo'] ?? null);
            if (!$target || !filter_var($target,FILTER_VALIDATE_EMAIL)) { $user=null; $target=null; }
            $id=bin2hex(random_bytes(32)); $code=(string)random_int(100000,999999);
            if ($user) $db->prepare("UPDATE security_challenges SET status='used',proof_hash=NULL WHERE user_id=? AND purpose=? AND status IN ('pending','sent','verified')")->execute([$user['id'],$purpose]);
            $db->prepare('INSERT INTO security_challenges(id,user_id,purpose,session_hash,target_email,credential_hash,code_hash,expires_at) VALUES(?,?,?,?,?,?,?,?)')->execute([$id,$user['id'] ?? null,$purpose,$emailFlow?hash('sha256',$session):null,$target,$user?hash('sha256',$user['password_hash']):null,securityHash($config,$id.':'.$code),gmdate('Y-m-d H:i:s',time()+600)]);
            $db->commit();
        } catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
        $response=['success'=>true,'challenge_id'=>$id,'resend_after'=>60,'message'=>$emailFlow?'Enviamos un código al nuevo correo.':'Si existe una cuenta con correo asociado, recibirá un código. Revisa también spam.'];
        // En FPM, responder igual antes de contactar Gmail evita revelar cuentas por su latencia.
        if (!$emailFlow && $afterQueued) $afterQueued($response);
        try {
            if ($target) securitySendMail($config,$target,$code,$purpose);
            $db->prepare("UPDATE security_challenges SET status='sent' WHERE id=? AND status='pending'")->execute([$id]);
        } catch (Throwable $error) {
            $db->prepare("UPDATE security_challenges SET status='failed' WHERE id=?")->execute([$id]);
            $reason=$error->getMessage();
            error_log('Security Mail: '.(preg_match('/^mail_(provider_http_\d+|oauth_failed|send_unconfirmed|smtp_auth_failed|smtp_tls_failed|smtp_delivery_failed)$/D',$reason)?$reason:'delivery_failed'));
            if ($emailFlow) throw new SecurityRequestError(503,'No se pudo enviar el correo. Tu dirección actual se conserva. Intenta más tarde.');
        }
        return $response;
    }
    securityRate($db,$config,[['verify-ip:'.$ip,60,3600]]);
    $id=$data['challenge_id'] ?? '';
    if (!is_string($id) || !preg_match('/^[a-f0-9]{64}$/D',$id)) throw new SecurityRequestError(400,'El código no es válido o caducó.');
    // Siempre bloquear usuario antes del reto: mismo orden que perfil/eliminación.
    $lookup=$db->prepare('SELECT user_id FROM security_challenges WHERE id=?'); $lookup->execute([$id]); $userId=$lookup->fetchColumn();
    $db->beginTransaction();
    try {
        $user=null;
        if ($userId!==false && $userId!==null) { $q=$db->prepare('SELECT * FROM users WHERE id=? FOR UPDATE'); $q->execute([$userId]); $user=$q->fetch(PDO::FETCH_ASSOC); }
        $q=$db->prepare('SELECT * FROM security_challenges WHERE id=? FOR UPDATE'); $q->execute([$id]); $challenge=$q->fetch(PDO::FETCH_ASSOC);
        $valid=$challenge && $user && $challenge['purpose']===$purpose && $challenge['expires_at']>gmdate('Y-m-d H:i:s') && hash_equals($challenge['credential_hash'],hash('sha256',$user['password_hash']));
        if ($emailFlow) $valid=$valid && (string)$challenge['user_id']===(string)$owner && hash_equals($challenge['session_hash'],hash('sha256',$session));
        else $valid=$valid && strtolower($challenge['target_email'])===strtolower($user['correo'] ?? '');
        if ($action==='recovery_reset') {
            $proof=$data['reset_token'] ?? '';
            if (!$valid || $challenge['status']!=='verified' || !$challenge['proof_hash'] || $challenge['proof_expires_at']<=gmdate('Y-m-d H:i:s') || !is_string($proof) || !hash_equals($challenge['proof_hash'],hash('sha256',$proof))) throw new SecurityRequestError(400,'La autorización caducó o ya se usó. Solicita un nuevo código.');
            $password=$data['new_password'] ?? null;
            if (!is_string($password) || strlen($password)>72 || preg_match('//u',$password)!==1 || preg_match_all('/./us',$password)<8 || $password!==trim($password)) throw new SecurityRequestError(422,'Usa al menos 8 caracteres, hasta 72 bytes y sin espacios al inicio o al final.');
            $sets=['password_hash=?'];
            if (array_key_exists('locked_until',$user)) $sets[]='locked_until=NULL';
            if (array_key_exists('failed_login_attempts',$user)) $sets[]='failed_login_attempts=0';
            $db->prepare('UPDATE users SET '.implode(',',$sets).' WHERE id=?')->execute([password_hash($password,PASSWORD_BCRYPT),$user['id']]);
            $db->prepare('DELETE FROM auth_sessions WHERE user_id=?')->execute([$user['id']]);
            $db->prepare("UPDATE security_challenges SET status='used',proof_hash=NULL WHERE user_id=?")->execute([$user['id']]);
            $db->commit(); return ['success'=>true,'message'=>'Contraseña actualizada. Inicia sesión de nuevo.'];
        }
        $code=$data['code'] ?? '';
        if (!$valid || $challenge['status']!=='sent' || (int)$challenge['attempts']>=5) throw new SecurityRequestError(400,'El código no es válido, ya se usó o caducó.');
        if (!is_string($code) || !preg_match('/^\d{6}$/D',$code) || !hash_equals($challenge['code_hash'],securityHash($config,$id.':'.$code))) {
            $db->prepare('UPDATE security_challenges SET attempts=attempts+1 WHERE id=?')->execute([$id]);
            $db->commit(); throw new SecurityRequestError(400,'El código no es válido o caducó.');
        }
        if ($emailFlow) {
            $q=$db->prepare('SELECT id FROM users WHERE correo=? AND id<>? LIMIT 1 FOR UPDATE'); $q->execute([$challenge['target_email'],$owner]);
            if ($q->fetchColumn()) throw new SecurityRequestError(409,'Ese correo ya está registrado. Solicita otro cambio.');
            $db->prepare('UPDATE users SET correo=? WHERE id=?')->execute([$challenge['target_email'],$owner]);
            // Un código solicitado para la dirección anterior ya no puede recuperar la cuenta.
            $db->prepare("UPDATE security_challenges SET status='used',proof_hash=NULL WHERE user_id=? AND purpose='password_reset'")->execute([$owner]);
            $db->prepare("UPDATE security_challenges SET status='used' WHERE id=?")->execute([$id]);
            $db->commit(); return ['success'=>true,'message'=>'Correo verificado y actualizado.'];
        }
        $proof=bin2hex(random_bytes(32));
        $proofExpiry=gmdate('Y-m-d H:i:s',time()+300);
        $db->prepare("UPDATE security_challenges SET status='verified',proof_hash=?,proof_expires_at=?,expires_at=? WHERE id=?")->execute([hash('sha256',$proof),$proofExpiry,$proofExpiry,$id]);
        $db->commit(); return ['success'=>true,'reset_token'=>$proof,'message'=>'Código verificado. Elige tu nueva contraseña.'];
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        if ($error instanceof PDOException && (int)($error->errorInfo[1] ?? 0)===1062) throw new SecurityRequestError(409,'Ese correo ya está registrado.');
        throw $error;
    }
}
