<?php
require __DIR__.'/../backend-alwaysdata/ptt-handler.php';
require __DIR__.'/../backend-alwaysdata/auth-session.php';
$socket=getenv('CONTACTS_TEST_SOCKET');
if (!$socket || getenv('WALKIET_PTT_TESTING')!=='1') throw new RuntimeException('Usa la instancia local de pruebas con WALKIET_PTT_TESTING=1.');
$db=new PDO('mysql:unix_socket='.$socket.';dbname=contacts_test_ptt;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
function check($condition,$message) { if (!$condition) throw new RuntimeException($message); }
function rejects($callback,$status) { try {$callback();}catch(PttRequestError $e){check($e->status===$status,'HTTP incorrecto: '.$e->status.' '.$e->getMessage());return;}throw new RuntimeException('Debió rechazarse con HTTP '.$status); }
$a=issueAuthSession($db,'ptt-a')['token'];$b=issueAuthSession($db,'ptt-b')['token'];
$channel=['id'=>'ptt-test-channel','name'=>'GRUPO RADIO DE PRUEBAS'];$device=str_repeat('f',32);
$base=['channel_id'=>$channel['id'],'device_id'=>$device];
rejects(fn()=>handlePtt($db,['action'=>'connect']+$base,null,null),401);
rejects(fn()=>handlePtt($db,['action'=>'connect']+$base,'ptt-c',$a),404);
rejects(fn()=>handlePtt($db,['action'=>'stop','transmission_id'=>str_repeat('f',32)]+$base,'ptt-c',$a),404);
rejects(fn()=>handlePtt($db,['action'=>'register_device','push_token'=>'invalid','platform'=>'ios'],'ptt-b',$b),400);
$config=pttConfig();
$credentials=handlePtt($db,['action'=>'connect']+$base,'ptt-a',$a);
$claims=json_decode(base64_decode(strtr(explode('.',$credentials['token'])[1],'-_','+/')),true);
check($claims['video']['canPublish']===false && $claims['video']['room']===pttRoom($channel['id']),'Token de escucha con permisos indebidos');
// No hay participante multimedia para esta identidad: la concesión falla y no queda un turno reservado.
rejects(fn()=>handlePtt($db,['action'=>'start','transmission_id'=>str_repeat('c',32)]+$base,'ptt-a',$a),502);
check(!$db->query("SELECT identity FROM ptt_floor WHERE channel_id='ptt-test-channel'")->fetchColumn(),'Un fallo de concesión dejó un turno activo');
// Una liberación vieja nunca altera el turno actual de un miembro autorizado.
$identity=pttIdentity('ptt-a',$device);$live=str_repeat('d',32);
$db->prepare('INSERT INTO ptt_floor(channel_id,holder_user_id,identity,transmission_id,started_at,expires_at) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE holder_user_id=VALUES(holder_user_id),identity=VALUES(identity),transmission_id=VALUES(transmission_id),started_at=VALUES(started_at),expires_at=VALUES(expires_at)')->execute([$channel['id'],'ptt-a',$identity,$live,gmdate('Y-m-d H:i:s'),gmdate('Y-m-d H:i:s',time()+12)]);
handlePtt($db,['action'=>'stop','transmission_id'=>str_repeat('e',32)]+$base,'ptt-a',$a);
check($db->query("SELECT transmission_id FROM ptt_floor WHERE channel_id='ptt-test-channel'")->fetchColumn()===$live,'Una liberación vieja quitó otro turno');
$db->exec("UPDATE ptt_floor SET expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE channel_id='ptt-test-channel'");
pttSweep($db,$config);
check(!$db->query("SELECT identity FROM ptt_floor WHERE channel_id='ptt-test-channel'")->fetchColumn(),'No se liberó el turno vencido');
// Registro ligado a sesión: ni emisor ni usuarios ajenos, ni sesiones revocadas reciben avisos.
$push='ExpoPushToken[ptt_contract_recipient_12345]';
handlePtt($db,['action'=>'register_device','push_token'=>$push,'platform'=>'ios'],'ptt-b',$b);
$event=bin2hex(random_bytes(16));pttQueue($db,'ptt-a',$channel,$event);
$stmt=$db->prepare('SELECT token_hash FROM ptt_push_outbox WHERE transmission_id=? AND token_hash=?');
$stmt->execute([$event,hash('sha256',$push)]);check((bool)$stmt->fetchColumn(),'Faltó el dispositivo del miembro B');
revokeAuthSession($db,$b);
$event=bin2hex(random_bytes(16));pttQueue($db,'ptt-a',$channel,$event);$stmt->execute([$event,hash('sha256',$push)]);check(!$stmt->fetchColumn(),'Se notificó una sesión revocada');
revokeAuthSession($db,$a);pttSweep($db,$config);
$stmt=$db->prepare('SELECT 1 FROM ptt_connections WHERE channel_id=? AND identity=?');$stmt->execute([$channel['id'],$identity]);check(!$stmt->fetchColumn(),'No se eliminó la conexión de una sesión revocada');
echo "OK PHP: aislamiento, token de escucha, rollback de concesión, liberación idempotente, lease vencido, destinatarios por sesión y revocación de conexiones.\n";
