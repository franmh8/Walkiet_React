<?php
// Servicio CLI privado; no ejecutar desde HTTP. Un solo proceso por BD es suficiente.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/ptt-handler.php';
require_once __DIR__ . '/conexion.php';
$config = pttConfig();
$lastPrune = 0;
do {
    try { $pdo->prepare('INSERT INTO ptt_runtime (id, heartbeat_at) VALUES (1, ?) ON DUPLICATE KEY UPDATE heartbeat_at=VALUES(heartbeat_at)')->execute([gmdate('Y-m-d H:i:s')]); pttSweep($pdo, $config); pttDispatchPush($pdo, $config); if (time()-$lastPrune >= 60) { pttPrune($pdo); $lastPrune = time(); } }
    catch (Throwable $error) { error_log('PTT worker: ' . $error->getMessage()); }
    if (in_array('--once', $argv, true)) break;
    usleep(1000000);
} while (true);
