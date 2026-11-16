<?php
$dsn = getenv('CONTACTS_TEST_DSN') ?: '';
if (strpos($dsn, 'dbname=contacts_test_') === false) throw new RuntimeException('Se requiere una BD contacts_test_ exclusiva de pruebas.');
$db = new PDO($dsn, getenv('CONTACTS_TEST_USER') ?: null, getenv('CONTACTS_TEST_PASSWORD') ?: null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec('DELETE FROM auth_sessions'); $db->exec('DELETE FROM contactos'); $db->exec('DELETE FROM users');
$users = $db->prepare('INSERT INTO users (id, name, phone_number, password_hash, status) VALUES (?, ?, ?, ?, ?)');
$users->execute(['owner-a', 'Prueba A', '7710000001', password_hash('password-a', PASSWORD_BCRYPT, ['cost' => 4]), 'online']);
$users->execute(['owner-b', 'Prueba B', '7710000002', password_hash('password-b', PASSWORD_BCRYPT, ['cost' => 4]), 'offline']);
$stmt = $db->prepare('INSERT INTO contactos (id, owner_user_id, name, phone_number, correo, callsign) VALUES (?, ?, ?, ?, ?, ?)');
for ($i=0; $i<110; $i++) $stmt->execute(['ui-a-'.$i, 'owner-a', 'Privado A'.str_pad((string)$i,3,'0',STR_PAD_LEFT), '7714'.str_pad((string)$i,6,'0',STR_PAD_LEFT), 'a'.$i.'@example.com', 'RADIO-'.$i]);
for ($i=0; $i<3; $i++) $stmt->execute(['ui-b-'.$i, 'owner-b', 'Privado B'.$i, '7715'.str_pad((string)$i,6,'0',STR_PAD_LEFT), 'b'.$i.'@example.com', 'RADIO-B'.$i]);
echo "UI fixtures ready\n";
