<?php
require_once __DIR__ . '/../config.php';

$usersCount = 0;
$channelsCount = 0;
$messagesCount = 0;

try {
    $u = $pdo->query("SELECT COUNT(*) as c FROM users")->fetch();
    $usersCount = intval($u['c']);

    $c = $pdo->query("SELECT COUNT(*) as c FROM channels")->fetch();
    $channelsCount = intval($c['c']);

    $m = $pdo->query("SELECT COUNT(*) as c FROM voice_messages")->fetch();
    $messagesCount = intval($m['c']);
} catch (Exception $e) {}

echo json_encode([
    'status' => 'ONLINE',
    'database_name' => 'if0_42687378_walkt',
    'server_host' => 'sql206.infinityfree.com',
    'engine' => 'MySQL (InfinityFree PDO)',
    'tables' => [
        'users' => $usersCount,
        'channels' => $channelsCount,
        'voice_messages' => $messagesCount,
    ],
    'server_time' => date('c'),
]);
