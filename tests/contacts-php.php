<?php
// Prueba con PDO SQLite en memoria; no usa conexion.php ni toca el servidor real.
require __DIR__ . '/../backend-alwaysdata/contacts-handler.php';
function check($condition, $label) {
    if (!$condition) throw new RuntimeException($label);
    echo "OK: $label\n";
}
$db = new PDO('sqlite::memory:');
$db->exec("CREATE TABLE contactos (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone_number TEXT UNIQUE NOT NULL,
    callsign TEXT, correo TEXT, unit TEXT, status TEXT)");
$db->exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)");
$db->exec("INSERT INTO users VALUES ('registered-user', 'Cuenta de acceso')");
$input = ['name' => 'Contacto de prueba', 'phone_number' => '(771) 555-1234', 'email' => 'prueba@example.com'];
[$status, $result] = handleContacts($db, 'POST', $input);
check($status === 201 && $result['success'], 'crear confirmado por BD');
$id = $result['contact']['id'];
check($result['contact']['phone_number'] === '7715551234', 'normalización del teléfono');
check($result['contact']['callsign'] === 'RADIO-1234', 'indicativo automático');
[$status, $list] = handleContacts($db, 'GET', []);
check(count($list['contacts']) === 1 && $list['contacts'][0]['id'] === $id, 'consulta devuelve ID persistido');
[$status, $updated] = handleContacts($db, 'POST', array_merge($input, [
    'action' => 'update', 'id' => $id, 'name' => 'Contacto editado', 'phone_number' => '7715559876', 'email' => ''
]));
check($status === 200 && $updated['contact']['email'] === '' && $updated['contact']['callsign'] === 'RADIO-9876', 'editar teléfono e indicativo y vaciar correo');
[$status, $list] = handleContacts($db, 'GET', []);
check($list['contacts'][0]['name'] === 'Contacto editado', 'edición persiste al volver a consultar');
[$status] = handleContacts($db, 'POST', array_merge($input, ['phone_number' => '']));
check($status === 422, 'rechaza teléfono vacío');
[$status] = handleContacts($db, 'POST', array_merge($input, ['action' => 'update', 'id' => 'missing']));
check($status === 404, 'editar inexistente no crea otro contacto');
[$status, $list] = handleContacts($db, 'GET', [], ['action' => 'delete', 'id' => $id]);
check(count($list['contacts']) === 1, 'GET no puede borrar datos');
[$status, $deleted] = handleContacts($db, 'POST', ['action' => 'delete', 'id' => $id]);
check($status === 200 && $deleted['id'] === $id, 'borrar confirmado por BD');
[$status, $list] = handleContacts($db, 'GET', []);
check($list['contacts'] === [], 'lista vacía después de borrar');
[$status] = handleContacts($db, 'DELETE', ['id' => $id]);
check($status === 404, 'borrar inexistente devuelve 404');
check((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn() === 1, 'CRUD no modifica cuentas users');
$db->exec('DROP TABLE contactos');
try { handleContacts($db, 'GET', []); throw new RuntimeException('SQL error hidden'); }
catch (PDOException $e) { echo "OK: errores SQL se propagan, no simulan lista vacía\n"; }
