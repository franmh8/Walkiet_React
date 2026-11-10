<?php
// Solo una instancia local. Cada caso crea y elimina su propia BD sintética aleatoria.
$socket = getenv('CONTACTS_TEST_SOCKET');
if (!$socket || !is_file(__DIR__.'/../backend-alwaysdata/migrations/004_live_ptt.sql')) throw new RuntimeException('Configura CONTACTS_TEST_SOCKET para la instancia local de pruebas.');
$db = new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$sql = file_get_contents(__DIR__.'/../backend-alwaysdata/migrations/004_live_ptt.sql');
function verifyPttMigration($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function pttColumn(PDO $db, $schema, $table, $column) {
    $stmt = $db->prepare('SELECT COLUMN_TYPE, COLLATION_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');
    $stmt->execute([$schema, $table, $column]); return $stmt->fetch();
}
$cases = [
    ['VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci', 'CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', 'user-one', 'channel-one'],
    ['CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', 'VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci', 'user-two', 'channel-two'],
    ['BIGINT UNSIGNED', 'INT UNSIGNED', '1', '2'],
];
foreach ($cases as $index=>$case) {
    $schema = 'contacts_test_ptt_migration_'.bin2hex(random_bytes(6));
    $db->exec('CREATE DATABASE `'.$schema.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    try {
        $db->exec('USE `'.$schema.'`');
        $db->exec('CREATE TABLE users (id '.$case[0].' NOT NULL PRIMARY KEY) ENGINE=InnoDB');
        $db->exec('CREATE TABLE channels (id '.$case[1].' NOT NULL PRIMARY KEY) ENGINE=InnoDB');
        $db->prepare('INSERT INTO users (id) VALUES (?)')->execute([$case[2]]);
        $db->prepare('INSERT INTO channels (id) VALUES (?)')->execute([$case[3]]);
        $apply = function() use ($db, $sql) { foreach (explode(';', $sql) as $statement) if (trim($statement) !== '') $db->exec($statement); };
        $apply();
        $tables = ['ptt_floor','ptt_connections','ptt_devices','ptt_push_outbox','ptt_runtime'];
        foreach ($tables as $table) verifyPttMigration((int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn() === 0, 'La migración copió datos de origen a '.$table);
        foreach ([['ptt_floor','channel_id','channels'],['ptt_floor','holder_user_id','users'],['ptt_connections','channel_id','channels'],['ptt_connections','user_id','users'],['ptt_devices','user_id','users'],['ptt_push_outbox','channel_id','channels'],['ptt_push_outbox','sender_id','users']] as $mapping) {
            $source = pttColumn($db, $schema, $mapping[2], 'id');
            $target = pttColumn($db, $schema, $mapping[0], $mapping[1]);
            verifyPttMigration($source['COLUMN_TYPE'] === $target['COLUMN_TYPE'] && $source['COLLATION_NAME'] === $target['COLLATION_NAME'], 'Tipo/collation diferente en '.$mapping[0].'.'.$mapping[1]);
            verifyPttMigration($target['IS_NULLABLE'] === ($mapping[1] === 'holder_user_id' ? 'YES' : 'NO'), 'NULL incorrecto en '.$mapping[0].'.'.$mapping[1]);
        }
        $db->prepare('INSERT INTO ptt_floor (channel_id) VALUES (?)')->execute([$case[3]]);
        $db->prepare('UPDATE ptt_floor SET holder_user_id=? WHERE channel_id=?')->execute([$case[2],$case[3]]);
        $identity = 'synthetic-device'; $hash = str_repeat('a',64); $event = str_repeat('b',32);
        $db->prepare('INSERT INTO ptt_connections(channel_id,identity,user_id,session_hash,updated_at) VALUES(?,?,?,?,UTC_TIMESTAMP())')->execute([$case[3],$identity,$case[2],$hash]);
        $db->prepare('INSERT INTO ptt_devices(token_hash,push_token,user_id,session_hash,platform,updated_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP())')->execute([$hash,'ExpoPushToken[synthetic_migration_only]',$case[2],$hash,'android']);
        $db->prepare('INSERT INTO ptt_push_outbox(transmission_id,channel_id,sender_id,token_hash,payload,expires_at,available_at) VALUES(?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())')->execute([$event,$case[3],$case[2],$hash,'{}']);
        $db->exec('INSERT INTO ptt_runtime(id,heartbeat_at) VALUES(1,UTC_TIMESTAMP())');
        verifyPttMigration((int)$db->query('SELECT COUNT(*) FROM ptt_connections p INNER JOIN users u ON p.user_id=u.id INNER JOIN channels c ON p.channel_id=c.id')->fetchColumn() === 1, 'Falló JOIN de los IDs de origen');
        $apply();
        foreach (array_merge($tables,['users','channels']) as $table) verifyPttMigration((int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn() === 1, 'La repetición modificó filas de '.$table);
        verifyPttMigration($db->query('SELECT state FROM ptt_push_outbox')->fetchColumn() === 'pending', 'Se perdió el valor por defecto de outbox');
        verifyPttMigration((int)$db->query('SELECT id FROM ptt_push_outbox')->fetchColumn() === 1, 'Se perdió AUTO_INCREMENT de outbox');
        $db->prepare('UPDATE ptt_floor SET holder_user_id=NULL WHERE channel_id=?')->execute([$case[3]]);
        echo 'OK migración caso '.($index+1).": instalación vacía, tipos/collations, NULL del turno, JOIN, defaults y repetición conservando filas.\n";
    } finally {
        // Solo la BD aleatoria que acaba de crear este proceso.
        $db->exec('DROP DATABASE `'.$schema.'`');
    }
}
