<?php
require_once __DIR__.'/../backend-alwaysdata/chat-time.php';
$socket=getenv('CONTACTS_TEST_SOCKET');if(!$socket)throw new RuntimeException('Usa el socket local.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach(['TIMESTAMP(6)','DATETIME(6)']as$type){
 $schema='contacts_test_chat_time_'.bin2hex(random_bytes(6));$db->exec('CREATE DATABASE `'.$schema.'`');
 try{
  $db->exec('USE `'.$schema.'`');$db->exec('CREATE TABLE chat_thread_messages(created_at '.$type.')');
  $db->exec("SET time_zone='+01:00'");$db->exec("INSERT INTO chat_thread_messages VALUES('2026-11-18 17:33:22.637541')");
  $zone=chatStorageTimeZone($db,$timestampColumn);$row=$db->query('SELECT created_at,UNIX_TIMESTAMP(created_at) AS epoch FROM chat_thread_messages')->fetch(PDO::FETCH_ASSOC);$raw=$row['created_at'];$date=chatTimeFields($raw,$zone,$timestampColumn?$row['epoch']:null);
  if($date['sent_at']!=='2026-11-18T16:33:22.637541Z')throw new RuntimeException('Conversión incorrecta de '.$type);
  if($type==='DATETIME(6)'&&$raw!=='2026-11-18 17:33:22.637541')throw new RuntimeException('Se modificó el DATETIME histórico.');
  if(chatTimeFields('2026-07-18 18:33:00.000000','Europe/Paris')['sent_at']!=='2026-07-18T16:33:00.000000Z')throw new RuntimeException('Fallo de verano.');
  echo 'OK '.$type.": UTC, microsegundos, hora de verano y conservación de datos.\n";
 }finally{$db->exec('DROP DATABASE `'.$schema.'`');}
}
