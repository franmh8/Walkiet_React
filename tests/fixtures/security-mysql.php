<?php
$socket=getenv('CONTACTS_TEST_SOCKET'); if (!$socket) throw new RuntimeException('Se requiere el socket local de pruebas.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE DATABASE IF NOT EXISTS contacts_test_security CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db->exec('USE contacts_test_security');
foreach (['users','auth_sessions','contactos','channels','channel_members','user_settings','account_avatars'] as $table) $db->exec('CREATE TABLE IF NOT EXISTS '.$table.' LIKE contacts_test_account.'.$table);
$db->exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL, ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0');
$sql=file_get_contents(__DIR__.'/../../backend-alwaysdata/migrations/006_email_security.sql');
foreach(explode(';',$sql) as $statement) if(trim($statement)!=='') $db->exec($statement);
foreach(['security_challenges','security_rate_limits','account_avatars','user_settings','channel_members','channels','auth_sessions','contactos','users'] as $table) $db->exec('DELETE FROM '.$table);
foreach([['security-a','7710000401','Seguridad A'],['security-b','7710000402','Seguridad B'],['security-c','7710000403','Seguridad C']] as $user) {
    $db->prepare('INSERT INTO users(id,phone_number,name,password_hash,correo,role) VALUES(?,?,?,?,?,?)')->execute([$user[0],$user[1],$user[2],password_hash('security-test-password',PASSWORD_BCRYPT,['cost'=>4]),$user[0].'@example.test','Pruebas']);
}
// Repetir no borra filas. El caso señuelo necesita user_id nullable con el tipo original.
foreach(explode(';',$sql) as $statement) if(trim($statement)!=='') $db->exec($statement);
echo "Fixture contacts_test_security preparada: tres cuentas sintéticas.\n";
