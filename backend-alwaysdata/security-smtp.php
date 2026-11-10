<?php
require_once __DIR__.'/lib/PHPMailer/src/Exception.php';
require_once __DIR__.'/lib/PHPMailer/src/SMTP.php';
require_once __DIR__.'/lib/PHPMailer/src/PHPMailer.php';

function securitySendSmtp(array $config,$email,$subject,$text) {
    $mail=new \PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host='smtp.gmail.com';
    $mail->Port=$config['gmail_smtp_port'] ?? 587;
    $mail->SMTPSecure=$mail->Port===465 ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->SMTPAuth=true; $mail->AuthType='LOGIN'; $mail->SMTPDebug=0;
    $mail->Username=$config['gmail_sender']; $mail->Password=$config['gmail_app_password'];
    $mail->Timeout=8; $mail->getSMTPInstance()->Timelimit=8;
    $mail->SMTPOptions=['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false]];
    // Únicamente en el servidor de pruebas sintético: SMTP local con certificado de prueba.
    // Se mantiene TLS y la validación del certificado; no se aceptan hosts/CA desde la petición.
    if (getenv('WALKIET_SECURITY_TESTING')==='1' && strpos(getenv('CONTACTS_TEST_DSN') ?: '', 'dbname=contacts_test_')!==false) {
        $mail->Host='127.0.0.1'; $mail->Port=8114;
        $mail->SMTPSecure=\PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $ca=getenv('WALKIET_SMTP_TEST_CA');
        if (!$ca || !is_file($ca)) throw new RuntimeException('mail_smtp_tls_failed');
        $mail->SMTPOptions['ssl']['cafile']=$ca;
        $mail->SMTPOptions['ssl']['peer_name']='localhost';
    }
    try {
        $mail->CharSet='UTF-8'; $mail->Encoding='base64';
        $mail->setFrom($config['gmail_sender'],'Walkiet');
        $mail->addAddress($email); $mail->Subject=$subject; $mail->Body=$text; $mail->isHTML(false);
        $mail->send();
    } catch (Throwable $error) {
        $smtp=$mail->getSMTPInstance()->getError();
        $code=(int)($smtp['smtp_code'] ?? 0);
        if (in_array($code,[530,534,535],true) || stripos($mail->ErrorInfo,'authenticate')!==false) throw new RuntimeException('mail_smtp_auth_failed');
        if (stripos($mail->ErrorInfo,'TLS')!==false || stripos($mail->ErrorInfo,'certificate')!==false) throw new RuntimeException('mail_smtp_tls_failed');
        throw new RuntimeException('mail_smtp_delivery_failed');
    } finally { $mail->smtpClose(); }
}
