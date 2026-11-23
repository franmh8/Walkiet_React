<?php
require_once __DIR__ . '/../cors.php';
header('Cache-Control: no-store');
http_response_code(410);
echo json_encode(['success'=>false,'message'=>'Actualiza la app y verifica tu correo para completar el registro.']);
