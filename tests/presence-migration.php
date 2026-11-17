<?php
$socket=getenv('CONTACTS_TEST_SOCKET'); if (!$socket) throw new RuntimeException('Usa el socket local de pruebas.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$sql=file_get_contents(__DIR__.'/../backend-alwaysdata/migrations/007_chat_presence.sql');
foreach (['VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci','BIGINT UNSIGNED'] as $type) {
 $schema='contacts_test_presence_migration_'.bin2hex(random_bytes(6));
 $db->exec('CREATE DATABASE `'.$schema.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
 try {
  $db->exec('USE `'.$schema.'`');$db->exec('CREATE TABLE users(id '.$type.' PRIMARY KEY) ENGINE=InnoDB');$db->exec('INSERT INTO users(id) VALUES(1)');
  $apply=function()use($db,$sql){foreach(explode(';',$sql)as$statement)if(trim($statement)!=='')$db->exec($statement);};$apply();
  foreach(['account_privacy','account_presence']as$table){
   if((int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn()!==0)throw new RuntimeException('La migración no debe importar usuarios.');
   $stmt=$db->prepare('SELECT COLUMN_TYPE,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');
   $stmt->execute([$schema,'users','id']);$source=$stmt->fetch();$stmt->execute([$schema,$table,'user_id']);if($source!==$stmt->fetch())throw new RuntimeException('Tipo/collation incompatible.');
  }
  $db->exec('INSERT INTO account_privacy(user_id,show_last_seen)VALUES(1,0)');
  $db->exec("INSERT INTO account_presence(user_id,token_hash,client_id,is_active,last_active_at)VALUES(1,REPEAT('a',64),'10000000-0000-4000-8000-000000000001',1,'2026-01-01 00:00:00')");
  $apply();if((int)$db->query('SELECT show_last_seen FROM account_privacy')->fetchColumn()!==0||(int)$db->query('SELECT COUNT(*) FROM account_presence')->fetchColumn()!==1)throw new RuntimeException('Repetir la migración cambió datos.');
  $db->exec('DELETE FROM users WHERE id=1');foreach(['account_privacy','account_presence']as$table)if((int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn()!==0)throw new RuntimeException('Falló la cascada.');
  echo 'OK migración presencia: '.$type."; repetible, sin importar usuarios, conserva privacidad y actividad, FK/cascada.\n";
 }finally{$db->exec('DROP DATABASE `'.$schema.'`');}
}
