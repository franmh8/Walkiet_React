<?php
$socket=getenv('CONTACTS_TEST_SOCKET'); if (!$socket) throw new RuntimeException('Se requiere el socket de pruebas local.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE DATABASE IF NOT EXISTS contacts_test_account CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db->exec('USE contacts_test_account');
foreach (['users','auth_sessions','contactos'] as $table) $db->exec('CREATE TABLE IF NOT EXISTS '.$table.' LIKE contacts_test_groups_php.'.$table);
$db->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NULL, ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) NULL");
$db->exec("CREATE TABLE IF NOT EXISTS channels(id VARCHAR(64) PRIMARY KEY,name VARCHAR(100),access_code VARCHAR(20),category VARCHAR(20) DEFAULT 'tactico',is_private TINYINT DEFAULT 0,created_by VARCHAR(64),created_at DATETIME DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$db->exec('CREATE TABLE IF NOT EXISTS channel_members(id VARCHAR(64) PRIMARY KEY,channel_id VARCHAR(64),user_id VARCHAR(64),joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY cm_user(channel_id,user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
// Tabla previa con los nombres/campos del esquema original y su default de push=1.
$db->exec("CREATE TABLE IF NOT EXISTS user_settings(user_id VARCHAR(64) PRIMARY KEY,theme_mode ENUM('light','dark','system') DEFAULT 'system',push_notifications TINYINT DEFAULT 1,channel_message_sounds TINYINT DEFAULT 1,ptt_mode ENUM('hold','toggle') DEFAULT 'hold',roger_beep TINYINT DEFAULT 1,vibration_on_ptt TINYINT DEFAULT 1,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$sql=file_get_contents(__DIR__.'/../../backend-alwaysdata/migrations/005_account_profile.sql');
foreach(explode(';',$sql) as $statement) if(trim($statement)!=='') $db->exec($statement);
foreach(['account_avatars','user_settings','channel_members','channels','auth_sessions','contactos','users'] as $table) $db->exec('DELETE FROM '.$table);
foreach([['account-a','7710000301','Prueba Perfil A'],['account-b','7710000302','Prueba Perfil B'],['account-c','7710000303','Prueba Perfil C']] as $user) $db->prepare('INSERT INTO users(id,phone_number,name,password_hash,correo,unit,role,callsign,status) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$user[0],$user[1],$user[2],password_hash('profile-test-password',PASSWORD_BCRYPT,['cost'=>4]),$user[0].'@example.test','Unidad de pruebas','Oficial de Radio',strtoupper($user[0]),'online']);
$db->exec("INSERT INTO channels(id,name,access_code,created_by) VALUES('account-group','GRUPO DE PRUEBA DE PERFIL','8383','account-a')");
$db->exec("INSERT INTO channel_members(id,channel_id,user_id) VALUES('acm-a','account-group','account-a'),('acm-b','account-group','account-b')");
$db->exec("INSERT INTO user_settings(user_id,theme_mode,ptt_mode,push_notifications) VALUES('account-a','light','hold',0)");
// Repetir 005 conserva los ajustes existentes.
foreach(explode(';',$sql) as $statement) if(trim($statement)!=='') $db->exec($statement);
if($db->query("SELECT theme_mode FROM user_settings WHERE user_id='account-a'")->fetchColumn()!=='light') throw new RuntimeException('Se perdió un ajuste anterior.');
echo "Fixture contacts_test_account preparada con tres cuentas sintéticas y ajustes existentes conservados.\n";
