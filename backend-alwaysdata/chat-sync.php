<?php
// Chat persistente del equipo. Fechas completas y zona explícita, sin alterar
// registros existentes. Primero se autentica al participante.
require_once __DIR__.'/cors.php';
require_once __DIR__.'/conexion.php';
require_once __DIR__.'/auth-session.php';
require_once __DIR__.'/chat-time.php';
require_once __DIR__.'/chat-receipts.php';
require_once __DIR__.'/chat-voice.php';
header('Cache-Control: no-store');
function chatRespond($status,array $body) { http_response_code($status); echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE); exit(); }
function chatString($value,$max=120) { return is_string($value)&&strlen($value)<=($max*4)&&(function_exists('mb_strlen')?mb_strlen($value)<=$max:strlen($value)<=($max*4)); }
function chatIsMember(PDO $pdo,$thread,$owner) { $stmt=$pdo->prepare('SELECT 1 FROM chat_thread_members WHERE thread_id=? AND user_id=? LIMIT 1');$stmt->execute([$thread,$owner]);return (bool)$stmt->fetchColumn(); }
function chatKnownMedia() {
 $raw=$_GET['known_media']??'';
 if(!is_string($raw)||strlen($raw)>6500)chatRespond(422,['success'=>false,'message'=>'Caché de archivos inválida.']);
 if($raw==='')return [];
 $ids=explode(',',$raw);
 if(count($ids)>100)chatRespond(422,['success'=>false,'message'=>'Demasiados archivos en caché.']);
 foreach($ids as$id)if(!preg_match('/^[A-Za-z0-9_-]{1,64}$/D',$id))chatRespond(422,['success'=>false,'message'=>'Archivo en caché inválido.']);
 return array_values(array_unique($ids));
}
function chatThreads(PDO $pdo,$owner,$zone,$timestampColumn) {
 $ready=chatActionsReady($pdo);
 $visible=$ready?' AND NOT EXISTS(SELECT 1 FROM chat_message_hidden h WHERE h.message_id=m.id AND h.user_id=?)':'';
 $annotation=$ready?' LEFT JOIN chat_message_annotations ann ON ann.message_id=last.id':'';
 $deleted=$ready?'ann.deleted_at':'NULL';
 $stmt=$pdo->prepare("SELECT t.id,t.kind,t.name AS group_name,peer.id AS target_user_id,peer.name AS peer_name,personal.name AS contact_name,peer.callsign,peer.unit,peer.status,
  (SELECT COUNT(*) FROM chat_thread_members cm WHERE cm.thread_id=t.id) AS participants,
  last.id AS last_message_id,CASE WHEN $deleted IS NOT NULL THEN 'Mensaje eliminado' WHEN last.media_type='image' AND last.content='' THEN 'Foto' ELSE last.content END AS last_message,
  last.created_at AS last_message_at,UNIX_TIMESTAMP(last.created_at) AS last_message_epoch
  FROM chat_threads t INNER JOIN chat_thread_members mine ON mine.thread_id=t.id AND mine.user_id=?
  LEFT JOIN chat_thread_members opposite ON opposite.thread_id=t.id AND opposite.user_id<>? AND t.kind='direct'
  LEFT JOIN users peer ON peer.id=opposite.user_id
  LEFT JOIN contactos personal ON personal.owner_user_id=? AND personal.phone_number=BINARY peer.phone_number
  LEFT JOIN chat_thread_messages last ON last.id=(SELECT m.id FROM chat_thread_messages m WHERE m.thread_id=t.id $visible ORDER BY m.created_at DESC,m.id DESC LIMIT 1)
  $annotation WHERE t.kind<>'direct' OR last.id IS NOT NULL ORDER BY t.updated_at DESC,t.id DESC LIMIT 200");
 $args=[$owner,$owner,$owner];if($ready)$args[]=$owner;
 $stmt->execute($args);$out=[];$threads=$stmt->fetchAll(PDO::FETCH_ASSOC);
 $lastIds=array_values(array_filter(array_column($threads,'last_message_id')));$statuses=[];
 if($lastIds){$marks=implode(',',array_fill(0,count($lastIds),'?'));foreach(chatMessageRows($pdo,"m.id IN ($marks)",$lastIds,200,true,true)as$row)$statuses[$row['id']]=chatMessageStatus($row,$owner);}
 foreach($threads as$r) {
  $date=chatTimeFields($r['last_message_at'],$zone,$timestampColumn?$r['last_message_epoch']:null);
  $out[]=['id'=>(string)$r['id'],'type'=>$r['kind'],'name'=>$r['kind']==='direct'?(trim($r['contact_name']??'')?:($r['peer_name']?:'Contacto')):($r['group_name']?:'Grupo'),
   'targetUserId'=>$r['target_user_id']!==null?(string)$r['target_user_id']:null,'callsign'=>$r['callsign'],'unit'=>$r['unit'],'participantCount'=>(int)$r['participants'],
   'isOnline'=>$r['status']==='online'||$r['status']==='transmitting','lastMessage'=>$r['last_message']?:'',
   'lastMessageTime'=>$date['timestamp'],'lastMessageAt'=>$date['sent_at'],'hasMessages'=>$r['last_message_id']!==null];
  $out[count($out)-1]['lastMessageStatus']=$statuses[$r['last_message_id']]??null;
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
 if($method==='GET'&&$action==='threads')chatRespond(200,['success'=>true,'time_zone'=>$zone,'features'=>array_merge(['receipts','idempotentSend'],chatActionsReady($pdo)?['messageActions']:[]),'threads'=>chatThreads($pdo,$owner,$zone,$timestampColumn)]);
 if($method==='GET'&&$action==='messages') {
  $id=$_GET['thread_id']??'';if(!chatString($id,64)||$id==='')chatRespond(422,['success'=>false,'message'=>'Conversación inválida.']);
  if(!chatIsMember($pdo,$id,$owner))chatRespond(403,['success'=>false,'message'=>'No tienes acceso a esta conversación.']);
  $hidden=chatActionsReady($pdo)?' AND NOT EXISTS(SELECT 1 FROM chat_message_hidden h WHERE h.message_id=m.id AND h.user_id=?)':'';
  $rows=chatMessageRows($pdo,'m.thread_id=?'.$hidden,chatActionsReady($pdo)?[$id,$owner]:[$id],100,true,false,chatKnownMedia(),$owner);
  $messages=array_map(fn($row)=>chatMessageDto($row,$zone,$timestampColumn,$owner),$rows);
  chatRespond(200,['success'=>true,'time_zone'=>$zone,'messages'=>$messages]);
 }
 if($method==='GET'&&$action==='inbox') {
  $hidden=chatActionsReady($pdo)?' AND NOT EXISTS(SELECT 1 FROM chat_message_hidden h WHERE h.message_id=m.id AND h.user_id=?)':'';
  $rows=chatMessageRows($pdo,'m.sender_id<>? AND EXISTS(SELECT 1 FROM chat_thread_members cm WHERE cm.thread_id=m.thread_id AND cm.user_id=?) AND NOT EXISTS(SELECT 1 FROM chat_message_receipts r WHERE r.message_id=m.id AND r.user_id=?)'.$hidden,chatActionsReady($pdo)?[$owner,$owner,$owner,$owner]:[$owner,$owner,$owner],20,false,false,chatKnownMedia(),$owner);
  chatRespond(200,['success'=>true,'time_zone'=>$zone,'messages'=>array_map(fn($row)=>chatMessageDto($row,$zone,$timestampColumn,$owner),$rows)]);
 }
 if($method==='POST'&&in_array($action,['edit','delete'],true))chatRespond(200,chatMutateMessage($pdo,$data,$owner));
 if($method==='POST'&&$action==='receipts') chatRespond(200,chatAcknowledge($pdo,$data,$owner));
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
  $reply=$data['reply_to_id']??null;$forward=$data['source_message_id']??null;
  if($reply!==null||$forward!==null){chatRequireActions($pdo);if($reply!==null&&!chatActionId($reply)||$forward!==null&&!chatActionId($forward)||$reply!==null&&$forward!==null)throw new ChatActionError(422,'Referencia de mensaje inválida.');}
  $thread=$data['thread_id']??'';$type=$data['mediaType']??'text';$text=$data['text']??'';$media=$data['mediaUrl']??null;$file=$data['fileName']??null;
  if(!chatString($thread,64)||$thread===''||!in_array($type,['text','image','voice','location','document'],true)||!chatString($text,10000)||!($media===null||is_string($media)&&strlen($media)<=5500000)||!($file===null||chatString($file,255)))chatRespond(422,['success'=>false,'message'=>'El mensaje es inválido o excede el tamaño permitido.']);
  if(!chatIsMember($pdo,$thread,$owner))chatRespond(403,['success'=>false,'message'=>'No perteneces a esta conversación.']);
  $client=$data['client_message_id']??null;
  if($client!==null&&(!is_string($client)||!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',$client)))chatRespond(422,['success'=>false,'message'=>'Identificador de envío inválido.']);
  $id=$client===null?'cm-'.bin2hex(random_bytes(16)):'cm-'.substr(hash('sha256',$owner.':'.$client),0,32);
  $intent=chatIntentHash($thread,$type,$text,$media,$file,$reply,$forward);
  $created=chatStorageNow($zone);$pdo->beginTransaction();
  // Reintentos y dos ventanas comparten un único envío por cuenta/client ID.
  $stmt=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$stmt->execute([$owner]);
  $stmt=$pdo->prepare('SELECT * FROM chat_thread_messages WHERE id=?');$stmt->execute([$id]);$existing=$stmt->fetch(PDO::FETCH_ASSOC);
  if($existing){
   $originalHash=null;if(chatActionsReady($pdo)){$stmt=$pdo->prepare('SELECT send_hash FROM chat_message_annotations WHERE message_id=?');$stmt->execute([$id]);$originalHash=$stmt->fetchColumn()?:null;}
   if((string)$existing['sender_id']!==$owner||$existing['thread_id']!==$thread||($originalHash?!hash_equals($originalHash,$intent):($existing['content']!==$text||$existing['media_type']!==$type||$existing['media_url']!==$media||$existing['file_name']!==$file))){$pdo->rollBack();chatRespond(409,['success'=>false,'message'=>'El identificador ya pertenece a otro mensaje.']);}
   $pdo->commit();$row=chatMessageRows($pdo,'m.id=?',[$id],1,true,false,[],$owner)[0];chatRespond(200,array_merge(['success'=>true],chatMessageDto($row,$zone,$timestampColumn,$owner)));
  }
  if($forward!==null){$source=chatSourceMessage($pdo,$forward,$owner);if($source['deleted_at'])throw new ChatActionError(409,'No puedes reenviar un mensaje eliminado.');$text=$source['content'];$type=$source['media_type'];$media=$source['media_url'];$file=$source['file_name'];}
  if($reply!==null)chatSourceMessage($pdo,$reply,$owner,$thread);
  if($type==='voice'&&!chatValidVoice($media))chatRespond(422,['success'=>false,'message'=>'Graba una nota de voz válida de hasta un minuto. No se recibió un archivo de audio compatible.']);
  if($type==='text'&&trim($text)==='')chatRespond(422,['success'=>false,'message'=>'Escribe un mensaje.']);
  if(in_array($type,['image','document'],true)&&(!is_string($media)||!preg_match('/^data:[^;,]+;base64,/i',$media)))chatRespond(422,['success'=>false,'message'=>'El archivo adjunto no tiene un formato válido.']);
  if($type==='location'&&$media!==null&&!preg_match('#^https://www\.google\.com/maps\?q=#',$media))chatRespond(422,['success'=>false,'message'=>'El enlace de ubicación no es válido.']);
  $args=[$id,$thread,$owner,$text,$type,$media,$file];if(!$timestampColumn)$args[]=$created;
  $pdo->prepare('INSERT INTO chat_thread_messages(id,thread_id,sender_id,content,media_type,media_url,file_name,created_at)VALUES(?,?,?,?,?,?,?,'.($timestampColumn?'CURRENT_TIMESTAMP(6)':'?').')')->execute($args);
  if(chatActionsReady($pdo))$pdo->prepare('INSERT INTO chat_message_annotations(message_id,reply_to_id,forwarded,send_hash) VALUES(?,?,?,?)')->execute([$id,$reply,$forward!==null?1:0,$intent]);
  $pdo->prepare('UPDATE chat_threads SET updated_at=CURRENT_TIMESTAMP(6) WHERE id=?')->execute([$thread]);
  // La confirmación usa exactamente la fecha persistida, igual que el sondeo.
  $stmt=$pdo->prepare('SELECT created_at,UNIX_TIMESTAMP(created_at) AS sent_epoch FROM chat_thread_messages WHERE id=?');$stmt->execute([$id]);$saved=$stmt->fetch(PDO::FETCH_ASSOC);$pdo->commit();
  chatRespond(201,array_merge(['success'=>true,'id'=>$id,'status'=>'sent','created_at'=>$saved['created_at']],chatTimeFields($saved['created_at'],$zone,$timestampColumn?$saved['sent_epoch']:null)));
 }
 chatRespond(405,['success'=>false,'message'=>'Acción de chat no soportada.']);
}catch(ChatActionError$error) {
 if($pdo->inTransaction())$pdo->rollBack();chatRespond($error->status,['success'=>false,'message'=>$error->getMessage()]);
}catch(Throwable$error) {
 if($pdo->inTransaction())$pdo->rollBack();error_log('[walkiet chat-sync] '.$error->getMessage());
 chatRespond(500,['success'=>false,'message'=>'No se pudo sincronizar el chat. Revisa las tablas de MySQL y el registro del servidor.']);
}
