<?php
// Ruta antigua. Ya no acepta metadatos ficticios como si fueran grabaciones.
require_once __DIR__ . '/cors.php';
http_response_code(410);
echo json_encode(['success'=>false, 'code'=>'PTT_LIVE_REQUIRED', 'message'=>'Actualiza la app: la radio en vivo utiliza ptt.php. No se grabó ni transmitió audio desde esta ruta.'], JSON_UNESCAPED_UNICODE);
