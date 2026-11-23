<?php
require_once __DIR__.'/cors.php';
require_once __DIR__.'/registration-handler.php';
header('Cache-Control: no-store');
try {
    if (($_SERVER['REQUEST_METHOD'] ?? '')!=='POST') throw new SecurityRequestError(405,'Usa POST.');
    $data=json_decode(file_get_contents('php://input'),true);
    if (!is_array($data)) throw new SecurityRequestError(400,'Se requiere un objeto JSON.');
    if (isset($registrationAction)) $data['action']=$registrationAction;
    require_once __DIR__.'/conexion.php';
    $result=handleRegistration($pdo,$data,$_SERVER['REMOTE_ADDR'] ?? 'unknown',securityConfig());
    echo json_encode($result,JSON_UNESCAPED_UNICODE);
} catch (SecurityRequestError $error) {
    http_response_code($error->status); if ($error->status===429) header('Retry-After: 60');
    echo json_encode(['success'=>false,'message'=>$error->getMessage()],JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('Registration API: operation_failed '.get_class($error));
    http_response_code(503);
    echo json_encode(['success'=>false,'message'=>'No se pudo completar el registro. Revisa el servicio de correo y la migración 011.']);
}
