<?php
class ChatActionError extends RuntimeException {
    public $status;
    public function __construct($status,$message){parent::__construct($message);$this->status=$status;}
}
function chatActionsReady(PDO $db) {
    static $cache=[];$key=spl_object_id($db);
    if(!array_key_exists($key,$cache)) {
        $stmt=$db->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('chat_message_annotations','chat_message_hidden')");
        $cache[$key]=(int)$stmt->fetchColumn()===2;
    }
    return $cache[$key];
}
function chatRequireActions(PDO $db) {
    if(!chatActionsReady($db))throw new ChatActionError(503,'Falta aplicar la migración 010_chat_message_actions.sql para usar las opciones de mensajes.');
}
function chatActionId($id) {return is_string($id)&&preg_match('/^[A-Za-z0-9_-]{1,64}$/D',$id);}
function chatActionStamp(){return (new DateTimeImmutable('now',new DateTimeZone('UTC')))->format('Y-m-d H:i:s.u');}
function chatIntentHash($thread,$type,$text,$media,$file,$reply=null,$forward=null) {
    return hash('sha256',json_encode([$thread,$type,$text,$media,$file,$reply,$forward],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE));
}
function chatSeedAnnotation(PDO $db,array $row) {
    $hash=chatIntentHash($row['thread_id'],$row['media_type'],$row['content'],$row['media_url'],$row['file_name'],$row['reply_to_id']??null);
    $db->prepare('INSERT INTO chat_message_annotations(message_id,send_hash,reply_to_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE send_hash=COALESCE(send_hash,VALUES(send_hash))')->execute([$row['id'],$hash,$row['reply_to_id']??null]);
}
function chatMutateMessage(PDO $db,array $data,$owner) {
    chatRequireActions($db);
    $thread=$data['thread_id']??'';$id=$data['message_id']??'';$action=$data['action'];
    if(!chatActionId($thread)||!chatActionId($id))throw new ChatActionError(422,'Selecciona un mensaje válido.');
    if(!chatIsMember($db,$thread,$owner))throw new ChatActionError(403,'No tienes acceso a esta conversación.');
    if($action==='edit'&&(!chatString($data['text']??null,10000)||trim($data['text'])===''))throw new ChatActionError(422,'Escribe un mensaje de hasta 10.000 caracteres.');
    $scope=$data['scope']??'me';if($action==='delete'&&!in_array($scope,['me','everyone'],true))throw new ChatActionError(422,'Elige para quién eliminar el mensaje.');
    $db->beginTransaction();
    try {
        $stmt=$db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$stmt->execute([$owner]);
        $stmt=$db->prepare('SELECT m.*,a.deleted_at,a.reply_to_id FROM chat_thread_messages m LEFT JOIN chat_message_annotations a ON a.message_id=m.id WHERE m.id=? AND m.thread_id=? FOR UPDATE');$stmt->execute([$id,$thread]);$row=$stmt->fetch(PDO::FETCH_ASSOC);
        if(!$row)throw new ChatActionError(404,'El mensaje ya no está disponible.');
        if($action==='edit'||$scope==='everyone') {
            if((string)$row['sender_id']!==$owner)throw new ChatActionError(403,'Solo puedes modificar tus propios mensajes.');
            if($action==='edit') {
                if($row['deleted_at'])throw new ChatActionError(409,'El mensaje fue eliminado.');
                if($row['media_type']!=='text')throw new ChatActionError(422,'Solo puedes editar mensajes de texto.');
                $hidden=$db->prepare('SELECT 1 FROM chat_message_hidden WHERE message_id=? AND user_id=?');$hidden->execute([$id,$owner]);
                if($hidden->fetchColumn())throw new ChatActionError(404,'El mensaje ya no está disponible.');
                chatSeedAnnotation($db,$row);
                $db->prepare('UPDATE chat_thread_messages SET content=? WHERE id=?')->execute([trim($data['text']),$id]);
                $db->prepare('UPDATE chat_message_annotations SET edited_at=? WHERE message_id=?')->execute([chatActionStamp(),$id]);
            } elseif(!$row['deleted_at']) {
                chatSeedAnnotation($db,$row);
                $db->prepare("UPDATE chat_thread_messages SET content='',media_type='text',media_url=NULL,file_name=NULL WHERE id=?")->execute([$id]);
                $db->prepare('UPDATE chat_message_annotations SET deleted_at=? WHERE message_id=?')->execute([chatActionStamp(),$id]);
            }
        } else {
            $db->prepare('INSERT IGNORE INTO chat_message_hidden(message_id,user_id,hidden_at) VALUES(?,?,?)')->execute([$id,$owner,chatActionStamp()]);
        }
        $db->commit();return ['success'=>true,'id'=>$id];
    } catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
}
function chatSourceMessage(PDO $db,$id,$owner,$thread=null) {
    $args=[$id,$owner,$owner];$inThread=$thread!==null?' AND m.thread_id=?':'';if($thread!==null)$args[]=$thread;
    $stmt=$db->prepare('SELECT m.*,a.deleted_at FROM chat_thread_messages m LEFT JOIN chat_message_annotations a ON a.message_id=m.id
      WHERE m.id=? AND EXISTS(SELECT 1 FROM chat_thread_members cm WHERE cm.thread_id=m.thread_id AND cm.user_id=?)
      AND NOT EXISTS(SELECT 1 FROM chat_message_hidden h WHERE h.message_id=m.id AND h.user_id=?)'.$inThread.' FOR UPDATE');
    $stmt->execute($args);$row=$stmt->fetch(PDO::FETCH_ASSOC);
    if(!$row)throw new ChatActionError(403,'El mensaje de origen no está disponible en esta conversación.');
    return $row;
}
function chatReplyDto(array $row) {
    if(empty($row['reply_message_id']))return null;
    $hidden=!empty($row['quote_hidden']);$deleted=!empty($row['quote_deleted']);
    $text=$hidden?'Mensaje no disponible':($deleted?'Mensaje eliminado':($row['quote_text']??''));
    preg_match('/^.{0,240}/us',$text,$excerpt);
    return ['id'=>(string)$row['reply_message_id'],'authorId'=>$hidden?'':(string)$row['quote_sender_id'],
      'authorName'=>$hidden?'':($row['quote_sender_name']?:'Oficial'),'text'=>$excerpt[0]??'',
      'mediaType'=>$hidden||$deleted?'text':$row['quote_media_type'],'unavailable'=>$hidden||$deleted];
}
