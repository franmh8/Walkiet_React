<?php
function chatStorageTimeZone(PDO $db, &$timestampColumn=null) {
 $stmt=$db->query("SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_thread_messages' AND COLUMN_NAME='created_at'");$type=strtolower((string)$stmt->fetchColumn());
 $timestampColumn=$type==='timestamp';
 if($timestampColumn) {
  // UNIX_TIMESTAMP se consulta al leer: conserva el instante y no cambia
  // la zona de conexión usada por otras columnas del endpoint.
  return 'UTC';
 }
 if($type!=='datetime')throw new RuntimeException('Falta created_at de chat_thread_messages.');
 // DATETIME no contiene zona. Se conserva la zona de escritura de Alwaysdata
 // para las filas previas y futuras. Puede configurarse para otro alojamiento.
 $zone=getenv('WALKIET_CHAT_STORAGE_TIME_ZONE')?:'Europe/Paris';new DateTimeZone($zone);return $zone;
}
function chatStorageNow($zone) { return (new DateTimeImmutable('now',new DateTimeZone($zone)))->format('Y-m-d H:i:s.u'); }
function chatTimeFields($value,$zone,$unix=null) {
 if(!$value)return ['sent_at'=>null,'timestamp'=>'','time_zone'=>$zone];
 $date=$unix!==null ? new DateTimeImmutable('@'.(string)$unix) : new DateTimeImmutable($value,new DateTimeZone($zone));
 $fields=['sent_at'=>$date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.u\Z'),'timestamp'=>$date->format('H:i'),'time_zone'=>$zone];
 if($unix!==null)$fields['created_at']=$date->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u');
 return $fields;
}
