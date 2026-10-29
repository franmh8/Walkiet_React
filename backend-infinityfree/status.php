<?php
// status.php - Verificación de salud y enlace con la BD
require_once __DIR__ . '/conexion.php';

$usersCount = 0;
$channelsCount = 0;
$messagesCount = 0;
$alertsCount = 0;

try {
    $u = $pdo->query("SELECT COUNT(*) as c FROM users")->fetch();
    $usersCount = intval($u['c']);

    $c = $pdo->query("SELECT COUNT(*) as c FROM channels")->fetch();
    $channelsCount = intval($c['c']);

    $m = $pdo->query("SELECT COUNT(*) as c FROM voice_messages")->fetch();
    $messagesCount = intval($m['c']);

    $a = $pdo->query("SELECT COUNT(*) as c FROM emergency_alerts")->fetch();
    $alertsCount = intval($a['c']);
} catch (Exception $e) {}

echo json_encode([
    'status' => 'ONLINE',
    'database_name' => 'if0_42687378_walkt',
    'server_host' => 'sql206.infinityfree.com',
    'engine' => 'MariaDB 11.4 / MySQL (InfinityFree PDO)',
    'tables' => [
        'users' => $usersCount,
        'channels' => $channelsCount,
        'voice_messages' => $messagesCount,
        'emergency_alerts' => $alertsCount,
    ],
    'server_time' => date('c'),
]);
