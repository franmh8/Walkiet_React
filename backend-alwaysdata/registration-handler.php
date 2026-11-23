<?php
require_once __DIR__.'/security-handler.php';
require_once __DIR__.'/security-mail.php';

function registrationIdentity(array $data) {
    $email=$data['email'] ?? $data['correo'] ?? '';
    $phone=$data['phone_number'] ?? $data['phone'] ?? '';
    if (!is_string($email) || !is_string($phone)) throw new SecurityRequestError(422,'Revisa tu correo y teléfono.');
    $email=strtolower(trim($email)); $phone=preg_replace('/[\s()+-]/','',trim($phone));
    if (strlen($email)>120 || !filter_var($email,FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{10}$/D',$phone)) throw new SecurityRequestError(422,'Ingresa un correo válido y un teléfono de 10 dígitos.');
    return [$email,$phone];
}

function registrationCheckDuplicate(PDO $db,$email,$phone) {
    $q=$db->prepare('SELECT id FROM users WHERE correo=? OR phone_number=? LIMIT 1'); $q->execute([$email,$phone]);
    if ($q->fetchColumn()) throw new SecurityRequestError(409,'El correo o teléfono ya está registrado. Inicia sesión o recupera tu acceso.');
}

function handleRegistration(PDO $db,array $data,$ip,array $config) {
    $action=$data['action'] ?? '';
    if (!in_array($action,['request','complete'],true)) throw new SecurityRequestError(400,'Operación de registro no disponible.');
    [$email,$phone]=registrationIdentity($data);
    if ($action==='request') {
        securityRate($db,$config,[['registration-send-ip:'.$ip,20,3600],['registration-send-email:'.$email,5,3600],['registration-cooldown:'.$email,1,60]]);
        registrationCheckDuplicate($db,$email,$phone);
        $id=bin2hex(random_bytes(32)); $code=(string)random_int(100000,999999); $now=time();
        // Una fila por correo serializa reenvíos y altas; el reenvío reemplaza al código anterior.
        $db->prepare("INSERT INTO registration_email_challenges(email,id,phone_number,code_hash,status,attempts,created_at,expires_at) VALUES(?,?,?,?,'pending',0,?,?) ON DUPLICATE KEY UPDATE id=VALUES(id),phone_number=VALUES(phone_number),code_hash=VALUES(code_hash),status='pending',attempts=0,created_at=VALUES(created_at),expires_at=VALUES(expires_at)")
            ->execute([$email,$id,$phone,securityHash($config,$id.':'.$code),gmdate('Y-m-d H:i:s',$now),gmdate('Y-m-d H:i:s',$now+SECURITY_CODE_TTL_SECONDS)]);
        try {
            securitySendMail($config,$email,$code,'registration');
            $db->prepare("UPDATE registration_email_challenges SET status='sent' WHERE id=? AND status='pending'")->execute([$id]);
        } catch (Throwable $error) {
            $db->prepare("UPDATE registration_email_challenges SET status='failed' WHERE id=?")->execute([$id]);
            error_log('Registration Mail: delivery_failed');
            throw new SecurityRequestError(503,'No se pudo enviar el correo. Intenta de nuevo más tarde.');
        }
        return ['success'=>true,'challenge_id'=>$id,'resend_after'=>60,'expires_in'=>SECURITY_CODE_TTL_SECONDS,'message'=>'Enviamos un código a tu correo. Revisa también spam.'];
    }

    $id=$data['challenge_id'] ?? ''; $code=$data['code'] ?? '';
    $name=$data['name'] ?? ''; $password=$data['password'] ?? '';
    if (!is_string($id) || !preg_match('/^[a-f0-9]{64}$/D',$id) || !is_string($code) || !preg_match('/^\d{6}$/D',$code)) throw new SecurityRequestError(400,'Ingresa el código de 6 dígitos que enviamos a tu correo.');
    if (!is_string($name) || !preg_match("/^[\p{L}\p{M}\s.'-]{3,120}$/u",trim($name)) || !is_string($password) || strlen($password)<6 || strlen($password)>72 || $password!==trim($password)) throw new SecurityRequestError(422,'Revisa tu nombre y contraseña (6 a 72 caracteres, sin espacios en los extremos).');
    securityRate($db,$config,[['registration-verify-ip:'.$ip,60,3600]]);
    $db->beginTransaction();
    try {
        $q=$db->prepare('SELECT * FROM registration_email_challenges WHERE email=? FOR UPDATE'); $q->execute([$email]); $challenge=$q->fetch(PDO::FETCH_ASSOC);
        if (!$challenge || !hash_equals($challenge['id'],$id) || $challenge['phone_number']!==$phone || $challenge['status']!=='sent' || $challenge['expires_at']<=gmdate('Y-m-d H:i:s') || (int)$challenge['attempts']>=5) throw new SecurityRequestError(400,'El código no es válido, ya se usó o caducó. Solicita otro correo.');
        if (!hash_equals($challenge['code_hash'],securityHash($config,$id.':'.$code))) {
            $db->prepare('UPDATE registration_email_challenges SET attempts=attempts+1 WHERE id=?')->execute([$id]);
            $db->commit(); throw new SecurityRequestError(400,'Código incorrecto. Revisa el correo e intenta nuevamente.');
        }
        registrationCheckDuplicate($db,$email,$phone);
        $userId='u-'.substr(bin2hex(random_bytes(16)),0,13); $callsign='RADIO-'.substr($phone,-4); $name=trim($name);
        // Solo campos compartidos por el esquema publicado y el original; los demás usan sus defaults.
        $db->prepare("INSERT INTO users(id,phone_number,name,correo,callsign,unit,role,password_hash,status) VALUES(?,?,?,?,?,?,'Oficial Operativo',?,'offline')")
            ->execute([$userId,$phone,$name,$email,$callsign,'Sector Operativo Hidalgo',password_hash($password,PASSWORD_BCRYPT)]);
        $db->prepare('INSERT INTO user_settings(user_id) VALUES(?)')->execute([$userId]);
        $db->prepare("UPDATE registration_email_challenges SET status='used' WHERE id=?")->execute([$id]);
        $db->commit();
        return ['success'=>true,'message'=>'Correo verificado. Tu cuenta está lista para iniciar sesión.','user'=>['id'=>$userId,'name'=>$name,'phone_number'=>$phone,'correo'=>$email,'callsign'=>$callsign,'badge'=>$callsign,'unit'=>'Sector Operativo Hidalgo','role'=>'Oficial Operativo','status'=>'offline']];
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        if ($error instanceof PDOException && (int)($error->errorInfo[1] ?? 0)===1062) throw new SecurityRequestError(409,'El correo o teléfono ya está registrado.');
        throw $error;
    }
}
