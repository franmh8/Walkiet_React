<?php
require_once __DIR__.'/../backend-alwaysdata/chat-receipts.php';
if(chatMessageStatus(['sender_id'=>1,'recipient_count'=>1,'read_count'=>1,'delivered_count'=>1],'1')!=='read')throw new RuntimeException('Los IDs numéricos deben conservar el remitente.');
$socket=getenv('CONTACTS_TEST_SOCKET');if(!$socket)throw new RuntimeException('Usa el socket local de pruebas.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$migration=file_get_contents(__DIR__.'/../backend-alwaysdata/migrations/008_chat_receipts.sql');
foreach(['VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin','BIGINT UNSIGNED']as$type){
 $schema='contacts_test_receipts_'.bin2hex(random_bytes(5));$db->exec('CREATE DATABASE `'.$schema.'`');
 try{
  $db->exec('USE `'.$schema.'`');$db->exec("CREATE TABLE users(id $type PRIMARY KEY) ENGINE=InnoDB");
  $db->exec("CREATE TABLE chat_thread_messages(id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,created_at DATETIME(6)) ENGINE=InnoDB");
  foreach(explode(';',$migration)as$sql)if(trim($sql)!=='')$db->exec($sql);
  $db->exec("INSERT INTO users VALUES(1)");$db->exec("INSERT INTO chat_thread_messages VALUES('synthetic-message','2026-11-18 17:33:22.637541')");
  $db->exec("INSERT INTO account_read_privacy(user_id,read_receipts) VALUES(1,0)");
  $db->exec("INSERT INTO chat_message_receipts(message_id,user_id,delivered_at,read_at) VALUES('synthetic-message',1,'2026-11-18 16:33:22.637541',NULL)");
  foreach(explode(';',$migration)as$sql)if(trim($sql)!=='')$db->exec($sql);
  if((int)$db->query('SELECT read_receipts FROM account_read_privacy')->fetchColumn()!==0)throw new RuntimeException('Se perdió privacidad.');
  if($db->query('SELECT created_at FROM chat_thread_messages')->fetchColumn()!=='2026-11-18 17:33:22.637541')throw new RuntimeException('Se modificó el historial.');
  if($db->query('SELECT delivered_at FROM chat_message_receipts')->fetchColumn()!=='2026-11-18 16:33:22.637541')throw new RuntimeException('Se perdió entrega.');
  $db->exec('DELETE FROM users WHERE id=1');
  if($db->query('SELECT COUNT(*) FROM chat_message_receipts')->fetchColumn()||$db->query('SELECT COUNT(*) FROM account_read_privacy')->fetchColumn())throw new RuntimeException('Fallo de cascada.');
  echo 'OK migración con '.$type.": conserva preferencias/historial/acuses, repetible y cascada válida.\n";
 }finally{$db->exec('DROP DATABASE `'.$schema.'`');}
}
