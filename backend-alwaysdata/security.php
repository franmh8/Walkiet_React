<?php
require_once __DIR__.'/cors.php';
require_once __DIR__.'/auth-session.php';
require_once __DIR__.'/security-handler.php';
require_once __DIR__.'/security-mail.php';
header('Cache-Control: no-store');
$flushed=false;
try {
    if (($_SERVER['REQUEST_METHOD'] ?? '')!=='POST') throw new SecurityRequestError(405,'Usa POST.');
    $data=json_decode(file_get_contents('php://input'),true);
    if (!is_array($data)) throw new SecurityRequestError(400,'Se requiere un objeto JSON.');
    require_once __DIR__.'/conexion.php';
    $config=securityConfig();
    $queued=function($response)use(&$flushed) {
        if (function_exists('fastcgi_finish_request')) {
            ignore_user_abort(true); $flushed=true;
            echo json_encode($response,JSON_UNESCAPED_UNICODE); fastcgi_finish_request();
        }
    };
    $result=handleSecurity($pdo,$data,contactsBearerToken($_SERVER),$_SERVER['REMOTE_ADDR'] ?? 'unknown',$config,$queued);
    if (!$flushed) echo json_encode($result,JSON_UNESCAPED_UNICODE);
} catch (SecurityRequestError $error) {
    if (!$flushed) {
        http_response_code($error->status); if ($error->status===429) header('Retry-After: 60');
        echo json_encode(['success'=>false,'message'=>$error->getMessage()],JSON_UNESCAPED_UNICODE);
    }
} catch (Throwable $error) {
    // Solo código técnico: una excepción SQL puede incluir correo u otros datos.
    error_log('Security API: operation_failed '.get_class($error));
    if (!$flushed) {
        http_response_code(503);
        echo json_encode(['success'=>false,'message'=>'No se pudo completar la verificación. Revisa el servicio de correo y la migración 006.']);
    }
}
