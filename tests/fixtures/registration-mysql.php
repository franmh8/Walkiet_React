<?php
$socket=getenv('CONTACTS_TEST_SOCKET');
if (!$socket || strpos($socket,'/tmp/')!==0) throw new RuntimeException('Usa un socket local de pruebas en /tmp.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE DATABASE IF NOT EXISTS contacts_test_registration CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db->exec('USE contacts_test_registration');
$schema=file_get_contents(__DIR__.'/../../backend-alwaysdata/database_schema.sql');
$users=substr($schema,strpos($schema,'CREATE TABLE IF NOT EXISTS `users`'));
$db->exec(substr($users,0,strpos($users,';')+1));
$db->exec("CREATE TABLE IF NOT EXISTS user_settings(user_id VARCHAR(64) PRIMARY KEY,theme_mode VARCHAR(20) DEFAULT 'system',push_notifications TINYINT DEFAULT 1)");
$sql=file_get_contents(__DIR__.'/../../backend-alwaysdata/migrations/011_registration_email.sql');
foreach (explode(';',$sql) as $part) if (trim($part)!=='') $db->exec($part);
foreach (['registration_email_challenges','security_rate_limits','user_settings','users'] as $table) $db->exec('DELETE FROM '.$table);
// La migración se puede repetir sin perder usuarios ni códigos pendientes.
$db->exec("INSERT INTO users(id,name,phone_number,correo,password_hash) VALUES('registration-existing','Cuenta existente','7710000800','existing@example.test','unused-test-hash')");
foreach (explode(';',$sql) as $part) if (trim($part)!=='') $db->exec($part);
if ((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn()!==1) throw new RuntimeException('La migración alteró usuarios.');
echo "Fixture contacts_test_registration lista.\n";
