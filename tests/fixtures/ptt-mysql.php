<?php
// Solo el socket local y una BD sintética exclusiva de PTT.
$socket = getenv('CONTACTS_TEST_SOCKET');
if (!$socket) throw new RuntimeException('Configura CONTACTS_TEST_SOCKET de la instancia local de pruebas.');
$db = new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE DATABASE IF NOT EXISTS contacts_test_ptt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db->exec('USE contacts_test_ptt');
foreach (['users','auth_sessions','contactos','channels','channel_members'] as $table) $db->exec('CREATE TABLE IF NOT EXISTS '.$table.' LIKE contacts_test_groups_php.'.$table);
$sql=file_get_contents(__DIR__.'/../../backend-alwaysdata/migrations/004_live_ptt.sql');
foreach (explode(';', $sql) as $statement) if (trim($statement)!=='') $db->exec($statement);
foreach (['ptt_push_outbox','ptt_devices','ptt_connections','ptt_floor','ptt_runtime','channel_members','channels','auth_sessions','contactos','users'] as $table) $db->exec('DELETE FROM '.$table);
foreach ([['ptt-a','7710000201','Radio A'],['ptt-b','7710000202','Radio B'],['ptt-c','7710000203','Radio C']] as $user) {
    $db->prepare('INSERT INTO users (id, phone_number, name, password_hash) VALUES (?, ?, ?, ?)')->execute(array_merge($user, [password_hash('ptt-test-password', PASSWORD_BCRYPT, ['cost'=>4])]));
}
$db->exec("INSERT INTO channels(id,name,access_code,created_by,category) VALUES ('ptt-test-channel','GRUPO RADIO DE PRUEBAS','7373','ptt-a','tactico')");
$db->exec("INSERT INTO channel_members(id,channel_id,user_id) VALUES ('ptt-cm-a','ptt-test-channel','ptt-a'), ('ptt-cm-b','ptt-test-channel','ptt-b')");
echo "Fixture contacts_test_ptt lista: A/B miembros, C ajeno.\n";
