<?php
$socket=getenv('CONTACTS_TEST_SOCKET');if(!$socket)throw new RuntimeException('Socket local requerido.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$sql=file_get_contents(__DIR__.'/../backend-alwaysdata/migrations/006_email_security.sql');
foreach([['VARCHAR(64)','utf8mb4_unicode_ci','u-a'],['CHAR(36)','utf8mb4_uca1400_ai_ci','u-b'],['BIGINT UNSIGNED',null,21],['INT UNSIGNED',null,22]] as $case){
  [$type,$collation,$id]=$case;$name='contacts_test_security_migration_'.bin2hex(random_bytes(5));
  try{
    $db->exec('CREATE DATABASE '.$name.' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');$db->exec('USE '.$name);
    $db->exec('CREATE TABLE users(id '.$type.($collation?' CHARACTER SET utf8mb4 COLLATE '.$collation:'').' PRIMARY KEY) ENGINE=InnoDB');
    $db->prepare('INSERT INTO users(id) VALUES(?)')->execute([$id]);
    $apply=function()use($db,$sql){foreach(explode(';',$sql)as$statement)if(trim($statement)!=='')$db->exec($statement);};$apply();
    if((int)$db->query('SELECT COUNT(*) FROM security_challenges')->fetchColumn()!==0)throw new RuntimeException('Se copiaron usuarios.');
    $q=$db->prepare('SELECT COLUMN_TYPE,COLLATION_NAME,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');
    $q->execute([$name,'users','id']);$source=$q->fetch(PDO::FETCH_ASSOC);$q->execute([$name,'security_challenges','user_id']);$target=$q->fetch(PDO::FETCH_ASSOC);
    $compatibleType=$source['COLUMN_TYPE']===$target['COLUMN_TYPE'] || preg_replace('/^char\(/','varchar(',$source['COLUMN_TYPE'])===$target['COLUMN_TYPE'];
    if(!$compatibleType||$source['COLLATION_NAME']!==$target['COLLATION_NAME']||$target['IS_NULLABLE']!=='YES')throw new RuntimeException('Tipo/collation/nullabilidad incompatibles: '.json_encode([$source,$target]));
    $db->prepare('INSERT INTO security_challenges(id,user_id,code_hash) VALUES(?,?,?)')->execute([str_repeat('a',64),$id,str_repeat('b',64)]);
    $db->exec("INSERT INTO security_challenges(id,user_id) VALUES('dummy',NULL)");$apply();
    if((int)$db->query('SELECT COUNT(*) FROM security_challenges')->fetchColumn()!==2)throw new RuntimeException('Se perdieron retos.');
    $db->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
    if((int)$db->query('SELECT COUNT(*) FROM security_challenges')->fetchColumn()!==1)throw new RuntimeException('FK no eliminó solo los retos propios.');
  }finally{$db->exec('DROP DATABASE IF EXISTS '.$name);}
}
echo "OK migración 006: texto/número UNSIGNED, collations heredadas, user_id nullable, FK, sin copiar usuarios y repetición sin pérdida.\n";
