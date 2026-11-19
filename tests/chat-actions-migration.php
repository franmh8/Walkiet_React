<?php
$socket=getenv('CONTACTS_TEST_SOCKET');if(!$socket)throw new RuntimeException('Usa el socket local de pruebas.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$migration=file_get_contents(__DIR__.'/../backend-alwaysdata/migrations/010_chat_message_actions.sql');
foreach(['VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin','BIGINT UNSIGNED']as$type){
 $schema='contacts_test_actions_'.bin2hex(random_bytes(5));$db->exec('CREATE DATABASE `'.$schema.'`');
 try{
  $db->exec('USE `'.$schema.'`');$db->exec("CREATE TABLE users(id $type PRIMARY KEY) ENGINE=InnoDB");
  $db->exec("CREATE TABLE chat_thread_messages(id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,created_at DATETIME(6)) ENGINE=InnoDB");
  foreach(explode(';',$migration)as$sql)if(trim($sql)!=='')$db->exec($sql);
  $db->exec("INSERT INTO users VALUES(1)");$db->exec("INSERT INTO chat_thread_messages VALUES('synthetic-message','2026-11-18 17:33:22.637541'),('synthetic-reply','2026-11-18 17:34:22.637541')");
  $db->exec("INSERT INTO chat_message_annotations(message_id,reply_to_id,edited_at,forwarded,send_hash) VALUES('synthetic-reply','synthetic-message','2026-11-19 17:33:22.637541',1,REPEAT('a',64))");
  $db->exec("INSERT INTO chat_message_hidden(message_id,user_id,hidden_at) VALUES('synthetic-message',1,'2026-11-19 17:34:22.637541')");
  foreach(explode(';',$migration)as$sql)if(trim($sql)!=='')$db->exec($sql);
  if($db->query('SELECT reply_to_id FROM chat_message_annotations')->fetchColumn()!=='synthetic-message'||(int)$db->query('SELECT COUNT(*) FROM chat_message_hidden')->fetchColumn()!==1)throw new RuntimeException('Se perdió cita o privacidad al repetir.');
  if($db->query("SELECT created_at FROM chat_thread_messages WHERE id='synthetic-message'")->fetchColumn()!=='2026-11-18 17:33:22.637541')throw new RuntimeException('Se modificó el historial.');
  $db->exec("DELETE FROM chat_thread_messages WHERE id='synthetic-message'");
  if($db->query('SELECT reply_to_id FROM chat_message_annotations')->fetchColumn()!==null||$db->query('SELECT COUNT(*) FROM chat_message_hidden')->fetchColumn())throw new RuntimeException('Fallo de cascada.');
  $db->exec("DELETE FROM chat_thread_messages WHERE id='synthetic-reply'");if($db->query('SELECT COUNT(*) FROM chat_message_annotations')->fetchColumn())throw new RuntimeException('Metadatos huérfanos.');
  echo 'OK migración 010 con '.$type.": instalación nueva, repetible, IDs/collations, historial intacto y cascadas.\n";
 }finally{$db->exec('DROP DATABASE `'.$schema.'`');}
}
