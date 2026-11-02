<?php
// status.php - Verificación de salud y enlace con Alwaysdata MySQL
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
    'database' => 'Alwaysdata MySQL',
    'database_name' => 'walkiet_c5i',
    'server_host' => 'mysql-walkiet.alwaysdata.net',
    'users_count' => $usersCount,
    'tables' => [
        'users' => $usersCount,
        'channels' => $channelsCount,
        'voice_messages' => $messagesCount,
        'emergency_alerts' => $alertsCount,
    ],
    'server_time' => date('Y-m-d H:i:s'),
]);
