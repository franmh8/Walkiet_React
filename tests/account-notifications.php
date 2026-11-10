<?php
require __DIR__.'/../backend-alwaysdata/auth-session.php';
require __DIR__.'/../backend-alwaysdata/account-handler.php';
require __DIR__.'/../backend-alwaysdata/ptt-handler.php';
$socket=getenv('CONTACTS_TEST_SOCKET');
if (!$socket || getenv('WALKIET_PTT_TESTING')!=='1' || getenv('WALKIET_PTT_PUSH_TEST_URL')!=='http://127.0.0.1:8102') throw new RuntimeException('Usa la instancia local y el proveedor push sintético.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$schema='contacts_test_profile_push_'.bin2hex(random_bytes(6));$db->exec('CREATE DATABASE `'.$schema.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
function checkProfilePush($condition,$message){if(!$condition)throw new RuntimeException($message);}
try {
    $db->exec('USE `'.$schema.'`');
    foreach(['users','auth_sessions','channels','channel_members','user_settings']as$table)$db->exec('CREATE TABLE '.$table.' LIKE contacts_test_account.'.$table);
    // Simular users actualizado y user_settings heredado con otra collation.
    foreach([['users','id'],['auth_sessions','user_id'],['channel_members','user_id']]as$column)$db->exec('ALTER TABLE '.$column[0].' MODIFY '.$column[1].' VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci NOT NULL');
    foreach(['004_live_ptt.sql','005_account_profile.sql']as$file)foreach(explode(';',file_get_contents(__DIR__.'/../backend-alwaysdata/migrations/'.$file))as$statement)if(trim($statement)!=='')$db->exec($statement);
    foreach([['sender','7710000401'],['recipient','7710000402']]as$user)$db->prepare('INSERT INTO users(id,name,phone_number,password_hash)VALUES(?,?,?,?)')->execute([$user[0],$user[0],$user[1],password_hash('synthetic-password',PASSWORD_BCRYPT,['cost'=>4])]);
    $db->exec("INSERT INTO channels(id,name,created_by)VALUES('push-group','Grupo de avisos','sender')");
    $db->exec("INSERT INTO channel_members(id,channel_id,user_id)VALUES('push-a','push-group','sender'),('push-b','push-group','recipient')");
    $token=issueAuthSession($db,'recipient')['token'];
    $push='ExpoPushToken[profile_preference_synthetic_12345]';
    handlePtt($db,['action'=>'register_device','push_token'=>$push,'platform'=>'android'],'recipient',$token);
    handleAccount($db,['action'=>'settings','settings'=>['messageSounds'=>false,'backgroundNotifications'=>true]],'recipient');
    $event=bin2hex(random_bytes(16));pttQueue($db,'sender',['id'=>'push-group','name'=>'Grupo de avisos'],$event);
    $result=pttDispatchPush($db,['expo_access_token'=>'']);checkProfilePush($result['accepted']===1,'No se aceptó el aviso silencioso.');
    $events=json_decode(file_get_contents('http://127.0.0.1:8102/events'),true);
    $matching=array_values(array_filter($events,function($row)use($event){return($row['data']['event_id']??'')===$event;}));
    checkProfilePush(count($matching)===1 && !isset($matching[0]['sound']) && $matching[0]['channelId']==='ptt-radio-silent','El aviso no respetó el sonido desactivado.');
    handleAccount($db,['action'=>'settings','settings'=>['messageSounds'=>true]],'recipient');
    $event=bin2hex(random_bytes(16));pttQueue($db,'sender',['id'=>'push-group','name'=>'Grupo de avisos'],$event);pttDispatchPush($db,['expo_access_token'=>'']);
    $events=json_decode(file_get_contents('http://127.0.0.1:8102/events'),true);$matching=array_values(array_filter($events,function($row)use($event){return($row['data']['event_id']??'')===$event;}));
    checkProfilePush(count($matching)===1 && ($matching[0]['sound']??'')==='default','El aviso no recuperó el sonido activado.');
    handleAccount($db,['action'=>'settings','settings'=>['backgroundNotifications'=>false]],'recipient');
    checkProfilePush((int)$db->query('SELECT COUNT(*)FROM ptt_devices')->fetchColumn()===0,'Desactivar avisos debe retirar el dispositivo.');
    // Una petición de registro atrasada no debe anular la preferencia global desactivada.
    handlePtt($db,['action'=>'register_device','push_token'=>$push,'platform'=>'android'],'recipient',$token);
    $event=bin2hex(random_bytes(16));pttQueue($db,'sender',['id'=>'push-group','name'=>'Grupo de avisos'],$event);
    $result=pttDispatchPush($db,['expo_access_token'=>'']);checkProfilePush($result['accepted']===0,'Se despachó un aviso con la preferencia apagada.');
    $events=json_decode(file_get_contents('http://127.0.0.1:8102/events'),true);
    checkProfilePush(!array_filter($events,function($row)use($event){return($row['data']['event_id']??'')===$event;}),'El proveedor recibió un aviso desactivado.');
    echo "OK avisos: preferencias reales por destinatario, canal silencioso/sonoro, collations heredadas y baja de dispositivos.\n";
}finally{$db->exec('DROP DATABASE `'.$schema.'`');}
