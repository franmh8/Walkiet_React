<?php
require __DIR__.'/../backend-alwaysdata/security-handler.php';
require __DIR__.'/../backend-alwaysdata/security-mail.php';
require __DIR__.'/../backend-alwaysdata/security-smtp.php';
if(getenv('WALKIET_SECURITY_TESTING')!=='1'||strpos(getenv('CONTACTS_TEST_DSN')?:'','dbname=contacts_test_')===false)throw new RuntimeException('Solo instancia SMTP sintética.');
$originalPath=getenv('WALKIET_SECURITY_CONFIG');$originalCa=getenv('WALKIET_SMTP_TEST_CA');$badCa=getenv('WALKIET_SMTP_TEST_BAD_CA');
if(!$badCa||!is_file($badCa))throw new RuntimeException('Se necesita una CA de prueba distinta para el caso negativo.');
$config=securityConfig();
if($config['provider']!=='gmail_smtp'||$config['gmail_sender']!=='sender@example.test'||$config['gmail_app_password']!=='abcdefghijklmnop')throw new RuntimeException('Configura las credenciales sintéticas de la fixture.');
function smtpTestEvents($path){return json_decode(file_get_contents('http://127.0.0.1:8115/test/'.$path),true);}
function smtpTestControl($failure){$ctx=stream_context_create(['http'=>['method'=>'POST','content'=>json_encode(['failure'=>$failure]),'header'=>'Content-Type: application/json']]);file_get_contents('http://127.0.0.1:8115/test/control',false,$ctx);}
function smtpTestNoSend($config){
    $before=count(smtpTestEvents('events'));$failed=false;
    try{securitySendSmtp($config,'blocked@example.test','Prueba controlada',"Código: 123456");}catch(RuntimeException $e){$failed=true;}
    if(!$failed||count(smtpTestEvents('events'))!==$before)throw new RuntimeException('No debe entregar ante un fallo TLS.');
    $transactions=smtpTestEvents('transactions');$last=end($transactions);
    if(($last['authCommands']??-1)!==0)throw new RuntimeException('Nunca debe autenticar sin validar TLS.');
}
$temp=tempnam(sys_get_temp_dir(),'walkiet-smtp-config-');
try{
    putenv('WALKIET_SMTP_TEST_CA='.$badCa);smtpTestNoSend($config);putenv('WALKIET_SMTP_TEST_CA='.$originalCa);
    smtpTestControl('tls');try{smtpTestNoSend($config);}finally{smtpTestControl('');}
    foreach([['gmail_app_password'=>'short'],['gmail_smtp_port'=>25],['provider'=>'arbitrary']]as$patch){
        file_put_contents($temp,'<?php return '.var_export(array_merge($config,$patch),true).';');putenv('WALKIET_SECURITY_CONFIG='.$temp);$failed=false;
        try{securityConfig();}catch(SecurityRequestError $e){$failed=$e->status===503;}
        if(!$failed)throw new RuntimeException('Debe rechazar configuración inválida.');
    }
    file_put_contents($temp,'<?php return '.var_export(array_merge($config,['gmail_smtp_port'=>465]),true).';');putenv('WALKIET_SECURITY_CONFIG='.$temp);
    if(securityConfig()['gmail_smtp_port']!==465)throw new RuntimeException('465 debe ser un puerto admitido.');
    echo "OK SMTP: normalización de clave, rechazo de certificado ajeno y STARTTLS ausente antes de AUTH, configuración inválida 503 y puertos limitados.\n";
}finally{putenv('WALKIET_SECURITY_CONFIG='.$originalPath);putenv('WALKIET_SMTP_TEST_CA='.$originalCa);@unlink($temp);}
