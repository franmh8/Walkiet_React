<?php
// Payloads locales: no envía notificaciones ni usa credenciales externas.
require __DIR__.'/../backend-alwaysdata/chat-push-dispatch.php';
$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE chat_push_devices (expo_token TEXT,user_id TEXT,enabled INTEGER);
CREATE TABLE chat_thread_members (thread_id TEXT,user_id TEXT);
CREATE TABLE user_settings (user_id TEXT,channel_message_sounds INTEGER);');
$db->exec("INSERT INTO chat_thread_members VALUES ('room','sender'),('room','muted'),('room','audible'),('room','default'),('other','outsider');
INSERT INTO chat_push_devices VALUES ('sender-token','sender',1),('muted-token','muted',1),('audible-token','audible',1),('default-token','default',1),('disabled-token','audible',0),('outsider-token','outsider',1);
INSERT INTO user_settings VALUES ('muted',0),('audible',1);");
function checkPush($condition, $message) { if (!$condition) throw new RuntimeException($message); }
$messages=walkietChatPushMessages($db,'room','sender');
checkPush(count($messages)===3,'Solo destinatarios del chat con dispositivo activo.');
$byUser=[];foreach($messages as $message) $byUser[$message['data']['recipientUserId']]=$message;
checkPush($byUser['muted']['sound']===null && $byUser['muted']['channelId']==='messages-silent','Silencio en iOS y canal Android sin sonido.');
checkPush($byUser['audible']['sound']==='default' && $byUser['default']['sound']==='default','Sonido activado y valor predeterminado.');
$db->exec("UPDATE user_settings SET channel_message_sounds=1 WHERE user_id='muted'");
foreach(walkietChatPushMessages($db,'room','sender') as $message) checkPush($message['sound']==='default','Cambiar el ajuste afecta al siguiente mensaje.');
checkPush(walkietChatPushMessages($db,'empty','sender')===[],'Chat sin destinatarios.');
echo "OK sonidos push: preferencia por destinatario, canal silencioso, cambios inmediatos y filtro de miembros.\n";
