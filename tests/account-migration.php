<?php
$socket=getenv('CONTACTS_TEST_SOCKET'); if (!$socket) throw new RuntimeException('Usa la instancia local de pruebas.');
$db=new PDO('mysql:unix_socket='.$socket.';charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$sql=file_get_contents(__DIR__.'/../backend-alwaysdata/migrations/005_account_profile.sql');
foreach (['VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci','BIGINT UNSIGNED'] as $type) {
    $schema='contacts_test_profile_migration_'.bin2hex(random_bytes(6));
    $db->exec('CREATE DATABASE `'.$schema.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    try {
        $db->exec('USE `'.$schema.'`'); $db->exec('CREATE TABLE users(id '.$type.' PRIMARY KEY) ENGINE=InnoDB');
        $db->exec("INSERT INTO users(id) VALUES(1)");
        $apply=function()use($db,$sql){foreach(explode(';',$sql)as$statement)if(trim($statement)!=='')$db->exec($statement);};
        $apply();
        foreach(['user_settings','account_avatars']as$table){
            if((int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn()!==0)throw new RuntimeException('No se deben importar usuarios.');
            $stmt=$db->prepare('SELECT COLUMN_TYPE,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?');
            $stmt->execute([$schema,'users','id']);$source=$stmt->fetch();$stmt->execute([$schema,$table,'user_id']);$target=$stmt->fetch();
            if($source!==$target)throw new RuntimeException('Tipo/collation incompatible en '.$table);
        }
        $db->exec("INSERT INTO user_settings(user_id,theme_mode)VALUES(1,'dark')");
        $db->exec("INSERT INTO account_avatars(user_id,image_data)VALUES(1,'synthetic-avatar')");
        $apply();
        if($db->query('SELECT theme_mode FROM user_settings')->fetchColumn()!=='dark'||$db->query('SELECT image_data FROM account_avatars')->fetchColumn()!=='synthetic-avatar')throw new RuntimeException('La repetición modificó preferencias/foto.');
        $db->exec('DELETE FROM users WHERE id=1');
        foreach(['user_settings','account_avatars']as$table)if((int)$db->query('SELECT COUNT(*) FROM '.$table)->fetchColumn()!==0)throw new RuntimeException('No funcionó la FK de '.$table);
        echo 'OK migración perfil: '.$type."; IDs/FK, tablas sin importar usuarios, repetición y cascada.\n";
    }finally{$db->exec('DROP DATABASE `'.$schema.'`');}
}
