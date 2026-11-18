<?php
$socket=getenv('CONTACTS_TEST_SOCKET');if(!$socket)throw new RuntimeException('Usa el socket local de pruebas.');
$db=new PDO('mysql:unix_socket='.$socket.';dbname=contacts_test_account;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec("CREATE TABLE IF NOT EXISTS chat_threads(id VARCHAR(64) PRIMARY KEY,kind ENUM('direct','group'),name VARCHAR(120),direct_key CHAR(64) UNIQUE,creator_id VARCHAR(64),created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB");
$db->exec('CREATE TABLE IF NOT EXISTS chat_thread_members(thread_id VARCHAR(64),user_id VARCHAR(64),PRIMARY KEY(thread_id,user_id)) ENGINE=InnoDB');
$db->exec('CREATE TABLE IF NOT EXISTS chat_thread_messages(id VARCHAR(64) PRIMARY KEY,thread_id VARCHAR(64),sender_id VARCHAR(64),content TEXT,media_type VARCHAR(20),media_url MEDIUMTEXT,file_name VARCHAR(255),created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),KEY chat_order(thread_id,created_at,id)) ENGINE=InnoDB');
foreach(['chat_thread_messages','chat_thread_members','chat_threads']as$table)$db->exec('DELETE FROM '.$table);
$db->exec("INSERT INTO chat_threads(id,kind,creator_id)VALUES('timeline-thread','direct','account-a')");
$db->exec("INSERT INTO chat_thread_members(thread_id,user_id)VALUES('timeline-thread','account-a'),('timeline-thread','account-b')");
$add=$db->prepare('INSERT INTO chat_thread_messages(id,thread_id,sender_id,content,media_type,created_at)VALUES(?,?,?,?,?,?)');
foreach([['yesterday-a','account-b','Mensaje de ayer','2026-11-17 22:11:55.877757'],['yesterday-b','account-a','Respuesta de ayer','2026-11-17 23:30:31.760313'],['today-a','account-b','Hola de hoy','2026-11-18 17:30:08.515433'],['today-b','account-a','Mensaje a las 10:33','2026-11-18 17:33:22.637541']]as[$id,$sender,$text,$date])$add->execute([$id,'timeline-thread',$sender,$text,'text',$date]);
for($i=0;$i<36;$i++)$add->execute(['history-'.$i,'timeline-thread',$i%2?'account-a':'account-b','Mensaje histórico de prueba '.str_repeat('contenido ',12).$i,'text','2026-11-17 22:12:'.sprintf('%02d',$i).'.000000']);
echo "Fixture de chat local: tablas compatibles, dos participantes, mensajes de ayer y hoy.\n";
