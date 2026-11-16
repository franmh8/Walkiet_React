<?php
require_once __DIR__.'/cors.php';
require_once __DIR__.'/auth-session.php';
require_once __DIR__.'/account-handler.php';
header('Cache-Control: no-store');
try {
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? '',['GET','POST'],true)) throw new AccountRequestError(405,'Usa GET o POST para gestionar la cuenta.');
    require_once __DIR__.'/conexion.php';
    $data=($_SERVER['REQUEST_METHOD'] ?? '')==='GET' ? ['action'=>'get'] : json_decode(file_get_contents('php://input'),true);
    if (!is_array($data)) throw new AccountRequestError(400,'Se requiere un objeto JSON.');
    if (($data['action'] ?? '')==='health') {
        $pdo->query('SELECT 1')->fetchColumn();
        echo json_encode(['success'=>true,'service'=>'walkiet-account','database'=>true]); exit;
    }
    $owner=authenticateContactOwner($pdo,contactsBearerToken($_SERVER));
    echo json_encode(handleAccount($pdo,$data,$owner),JSON_UNESCAPED_UNICODE);
} catch (AccountRequestError $error) {
    http_response_code($error->status); echo json_encode(['success'=>false,'message'=>$error->getMessage()],JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('Account API: '.$error->getMessage()); http_response_code(503);
    echo json_encode(['success'=>false,'message'=>'No se pudo acceder a tu perfil. Verifica el servidor y la migración 005_account_profile.sql.']);
}
