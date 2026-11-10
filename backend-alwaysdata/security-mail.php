<?php
// Credenciales únicamente en el servidor. Gmail API no acepta una API key como permiso de envío.
function securityConfig() {
    $path=getenv('WALKIET_SECURITY_CONFIG');
    if (!$path) {
        foreach ([dirname(__DIR__).'/private/security-config.php',dirname(__DIR__).'/security-config.php'] as $candidate) if (is_file($candidate)) { $path=$candidate; break; }
    }
    $config=$path && is_file($path) ? require $path : [];
    foreach (['code_secret','gmail_client_id','gmail_client_secret','gmail_refresh_token','gmail_sender'] as $key) {
        if (!is_string($config[$key] ?? null) || trim($config[$key])==='') throw new SecurityRequestError(503,'El servicio de verificación por correo aún no está configurado.');
    }
    if (strlen($config['code_secret'])<32 || !filter_var($config['gmail_sender'],FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/',$config['gmail_sender'])) throw new SecurityRequestError(503,'Revisa la configuración privada del correo.');
    return $config;
}
function securityHttp($url, $body, array $headers) {
    if (function_exists('curl_init')) {
        $curl=curl_init($url);
        curl_setopt_array($curl,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>10,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
        $response=curl_exec($curl); $status=curl_getinfo($curl,CURLINFO_HTTP_CODE); curl_close($curl);
    } else {
        $context=stream_context_create(['http'=>['method'=>'POST','content'=>$body,'header'=>implode("\r\n",$headers),'timeout'=>10,'ignore_errors'=>true,'follow_location'=>0],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
        $response=@file_get_contents($url,false,$context); $status=0;
        foreach ($http_response_header ?? [] as $header) if (preg_match('#^HTTP/\S+ (\d+)#',$header,$match)) $status=(int)$match[1];
    }
    $json=is_string($response) ? json_decode($response,true) : null;
    // No registrar cuerpo, destinatario, códigos ni tokens de Google.
    if ($status<200 || $status>=300 || !is_array($json)) throw new RuntimeException('mail_provider_http_'.$status);
    return $json;
}
function securitySendMail(array $config, $email, $code, $purpose) {
    $tokenUrl='https://oauth2.googleapis.com/token';
    $sendUrl='https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
    // Proveedor HTTP controlado únicamente para BD sintética y proceso de pruebas local.
    if (getenv('WALKIET_SECURITY_TESTING')==='1' && strpos(getenv('CONTACTS_TEST_DSN') ?: '', 'dbname=contacts_test_')!==false) {
        $tokenUrl='http://127.0.0.1:8110/token'; $sendUrl='http://127.0.0.1:8110/send';
    }
    $oauth=securityHttp($tokenUrl,http_build_query(['client_id'=>$config['gmail_client_id'],'client_secret'=>$config['gmail_client_secret'],'refresh_token'=>$config['gmail_refresh_token'],'grant_type'=>'refresh_token']),['Content-Type: application/x-www-form-urlencoded']);
    if (!is_string($oauth['access_token'] ?? null) || preg_match('/[\r\n]/',$oauth['access_token'])) throw new RuntimeException('mail_oauth_failed');
    $subject=$purpose==='email_change' ? 'Verifica tu nuevo correo - Walkiet' : 'Recupera tu acceso - Walkiet';
    $text="Tu código de verificación es: $code\n\nCaduca en 10 minutos y solo puede usarse una vez. No lo compartas.\nSi no solicitaste este cambio, ignora este mensaje.";
    $mime='From: '.$config['gmail_sender']."\r\nTo: ".$email."\r\nSubject: ".$subject."\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($text),76,"\r\n");
    $raw=rtrim(strtr(base64_encode($mime),'+/','-_'),'=');
    $sent=securityHttp($sendUrl,json_encode(['raw'=>$raw]),['Content-Type: application/json','Authorization: Bearer '.$oauth['access_token']]);
    if (empty($sent['id'])) throw new RuntimeException('mail_send_unconfirmed');
}
