<?php
// Chat persistente del equipo. Fechas completas y zona explícita, sin alterar
// registros existentes. Primero se autentica al participante.
require_once __DIR__.'/cors.php';
require_once __DIR__.'/conexion.php';
require_once __DIR__.'/auth-session.php';
require_once __DIR__.'/chat-time.php';
header('Cache-Control: no-store');
function chatRespond($status,array $body) { http_response_code($status); echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE); exit(); }
function chatString($value,$max=120) { return is_string($value)&&strlen($value)<=($max*4)&&(function_exists('mb_strlen')?mb_strlen($value)<=$max:strlen($value)<=($max*4)); }
function chatIsMember(PDO $pdo,$thread,$owner) { $stmt=$pdo->prepare('SELECT 1 FROM chat_thread_members WHERE thread_id=? AND user_id=? LIMIT 1');$stmt->execute([$thread,$owner]);return (bool)$stmt->fetchColumn(); }
function chatThreads(PDO $pdo,$owner,$zone,$timestampColumn) {
 $stmt=$pdo->prepare("SELECT t.id,t.kind,t.name AS group_name,peer.id AS target_user_id,peer.name AS peer_name,peer.callsign,peer.unit,peer.status,
  (SELECT COUNT(*) FROM chat_thread_members cm WHERE cm.thread_id=t.id) AS participants,
  (SELECT m.content FROM chat_thread_messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message,
  (SELECT m.created_at FROM chat_thread_messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message_at,
  (SELECT UNIX_TIMESTAMP(m.created_at) FROM chat_thread_messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message_epoch
  FROM chat_threads t INNER JOIN chat_thread_members mine ON mine.thread_id=t.id AND mine.user_id=?
  LEFT JOIN chat_thread_members opposite ON opposite.thread_id=t.id AND opposite.user_id<>? AND t.kind='direct'
  LEFT JOIN users peer ON peer.id=opposite.user_id ORDER BY t.updated_at DESC,t.id DESC LIMIT 200");
 $stmt->execute([$owner,$owner]);$out=[];
 foreach($stmt->fetchAll(PDO::FETCH_ASSOC)as$r) {
  $date=chatTimeFields($r['last_message_at'],$zone,$timestampColumn?$r['last_message_epoch']:null);
  $out[]=['id'=>(string)$r['id'],'type'=>$r['kind'],'name'=>$r['kind']==='direct'?($r['peer_name']?:'Contacto'):($r['group_name']?:'Grupo'),
   'targetUserId'=>$r['target_user_id']!==null?(string)$r['target_user_id']:null,'callsign'=>$r['callsign'],'unit'=>$r['unit'],'participantCount'=>(int)$r['participants'],
   'isOnline'=>$r['status']==='online'||$r['status']==='transmitting','lastMessage'=>$r['last_message']?:'',
   'lastMessageTime'=>$date['timestamp'],'lastMessageAt'=>$date['sent_at']];
 }
 return $out;
}
$owner=authenticateContactOwner($pdo,contactsBearerToken($_SERVER));
if(!$owner)chatRespond(401,['success'=>false,'message'=>'Tu sesión venció. Inicia sesión nuevamente.']);
$method=strtoupper($_SERVER['REQUEST_METHOD']??'GET');
$data=$method==='POST'?getJsonInput():[];
if(!is_array($data))chatRespond(400,['success'=>false,'message'=>'Solicitud inválida.']);
$action=$method==='GET'?($_GET['action']??'threads'):($data['action']??'');
try {
 $zone=chatStorageTimeZone($pdo,$timestampColumn);
 if($method==='GET'&&$action==='threads')chatRespond(200,['success'=>true,'time_zone'=>$zone,'threads'=>chatThreads($pdo,$owner,$zone,$timestampColumn)]);
 if($method==='GET'&&$action==='messages') {
  $id=$_GET['thread_id']??'';if(!chatString($id,64)||$id==='')chatRespond(422,['success'=>false,'message'=>'Conversación inválida.']);
  if(!chatIsMember($pdo,$id,$owner))chatRespond(403,['success'=>false,'message'=>'No tienes acceso a esta conversación.']);
  $stmt=$pdo->prepare('SELECT m.id,m.sender_id,u.name AS sender_name,u.callsign AS sender_callsign,m.content,m.media_type,m.media_url,m.file_name,m.created_at,UNIX_TIMESTAMP(m.created_at) AS sent_epoch FROM chat_thread_messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.thread_id=? ORDER BY m.created_at DESC,m.id DESC LIMIT 100');
  $stmt->execute([$id]);$rows=array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));$messages=[];
  foreach($rows as$m)$messages[]=array_merge(['id'=>(string)$m['id'],'sender_id'=>(string)$m['sender_id'],'sender_name'=>$m['sender_name']?:'Oficial','sender_callsign'=>$m['sender_callsign']?:'',
   'text'=>$m['content'],'mediaType'=>$m['media_type'],'mediaUrl'=>$m['media_url'],'fileName'=>$m['file_name'],'created_at'=>$m['created_at']],chatTimeFields($m['created_at'],$zone,$timestampColumn?$m['sent_epoch']:null));
  chatRespond(200,['success'=>true,'time_zone'=>$zone,'messages'=>$messages]);
 }
 if($method==='POST'&&$action==='direct') {
  $peer=$data['target_user_id']??'';if(!chatString($peer,64)||$peer===''||$peer===$owner)chatRespond(422,['success'=>false,'message'=>'Selecciona otro usuario con cuenta registrada.']);
  $stmt=$pdo->prepare('SELECT 1 FROM users WHERE id=? LIMIT 1');$stmt->execute([$peer]);if(!$stmt->fetchColumn())chatRespond(404,['success'=>false,'message'=>'El contacto no tiene una cuenta disponible.']);
  $pair=[$owner,$peer];sort($pair,SORT_STRING);$key=hash('sha256',json_encode($pair));$id='chat-d-'.substr($key,0,32);
  $pdo->beginTransaction();$pdo->prepare("INSERT IGNORE INTO chat_threads(id,kind,name,direct_key,creator_id)VALUES(?,'direct',NULL,?,?)")->execute([$id,$key,$owner]);
  $add=$pdo->prepare('INSERT IGNORE INTO chat_thread_members(thread_id,user_id)VALUES(?,?)');$add->execute([$id,$owner]);$add->execute([$id,$peer]);$pdo->commit();
  chatRespond(200,['success'=>true,'thread_id'=>$id]);
 }
 if($method==='POST'&&$action==='group') {
  $name=is_string($data['name']??null)?trim($data['name']):'';$members=$data['member_ids']??null;
  if(!chatString($name,120)||$name===''||!is_array($members)||count($members)>40)chatRespond(422,['success'=>false,'message'=>'Ingresa nombre y miembros válidos para el grupo.']);
  $ids=array_values(array_unique(array_merge([$owner],$members)));
  foreach($ids as$id)if(!chatString($id,64)||$id==='')chatRespond(422,['success'=>false,'message'=>'Miembro de grupo inválido.']);
  $stmt=$pdo->prepare('SELECT id FROM users WHERE id IN('.implode(',',array_fill(0,count($ids),'?')).')');$stmt->execute($ids);
  if(count($stmt->fetchAll(PDO::FETCH_COLUMN))!==count($ids))chatRespond(422,['success'=>false,'message'=>'Algunos miembros ya no tienen cuenta.']);
  $id='chat-g-'.bin2hex(random_bytes(16));$pdo->beginTransaction();$pdo->prepare("INSERT INTO chat_threads(id,kind,name,creator_id)VALUES(?,'group',?,?)")->execute([$id,$name,$owner]);
  $add=$pdo->prepare('INSERT INTO chat_thread_members(thread_id,user_id)VALUES(?,?)');foreach($ids as$member)$add->execute([$id,$member]);$pdo->commit();
  chatRespond(201,['success'=>true,'thread_id'=>$id]);
 }
 if($method==='POST'&&$action==='send') {
  $thread=$data['thread_id']??'';$type=$data['mediaType']??'text';$text=$data['text']??'';$media=$data['mediaUrl']??null;$file=$data['fileName']??null;
  if(!chatString($thread,64)||$thread===''||!in_array($type,['text','image','voice','location','document'],true)||!chatString($text,10000)||!($media===null||is_string($media)&&strlen($media)<=5500000)||!($file===null||chatString($file,255)))chatRespond(422,['success'=>false,'message'=>'El mensaje es inválido o excede el tamaño permitido.']);
  if($type==='text'&&trim($text)==='')chatRespond(422,['success'=>false,'message'=>'Escribe un mensaje.']);
  if(in_array($type,['image','document'],true)&&(!is_string($media)||!preg_match('/^data:[^;,]+;base64,/i',$media)))chatRespond(422,['success'=>false,'message'=>'El archivo adjunto no tiene un formato válido.']);
  if($type==='location'&&$media!==null&&!preg_match('#^https://www\.google\.com/maps\?q=#',$media))chatRespond(422,['success'=>false,'message'=>'El enlace de ubicación no es válido.']);
  if(!chatIsMember($pdo,$thread,$owner))chatRespond(403,['success'=>false,'message'=>'No perteneces a esta conversación.']);
  $id='cm-'.bin2hex(random_bytes(16));$created=chatStorageNow($zone);$pdo->beginTransaction();
  $args=[$id,$thread,$owner,$text,$type,$media,$file];if(!$timestampColumn)$args[]=$created;
  $pdo->prepare('INSERT INTO chat_thread_messages(id,thread_id,sender_id,content,media_type,media_url,file_name,created_at)VALUES(?,?,?,?,?,?,?,'.($timestampColumn?'CURRENT_TIMESTAMP(6)':'?').')')->execute($args);
  $pdo->prepare('UPDATE chat_threads SET updated_at=CURRENT_TIMESTAMP(6) WHERE id=?')->execute([$thread]);
  // La confirmación usa exactamente la fecha persistida, igual que el sondeo.
  $stmt=$pdo->prepare('SELECT created_at,UNIX_TIMESTAMP(created_at) AS sent_epoch FROM chat_thread_messages WHERE id=?');$stmt->execute([$id]);$saved=$stmt->fetch(PDO::FETCH_ASSOC);$pdo->commit();
  chatRespond(201,array_merge(['success'=>true,'id'=>$id,'created_at'=>$saved['created_at']],chatTimeFields($saved['created_at'],$zone,$timestampColumn?$saved['sent_epoch']:null)));
 }
 chatRespond(405,['success'=>false,'message'=>'Acción de chat no soportada.']);
}catch(Throwable$error) {
 if($pdo->inTransaction())$pdo->rollBack();error_log('[walkiet chat-sync] '.$error->getMessage());
 chatRespond(500,['success'=>false,'message'=>'No se pudo sincronizar el chat. Revisa las tablas de MySQL y el registro del servidor.']);
}
