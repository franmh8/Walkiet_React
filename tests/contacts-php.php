<?php
// Por defecto: BD SQLite efímera. CONTACTS_TEST_DSN permite una BD MySQL exclusiva de pruebas.
require __DIR__ . '/../backend-alwaysdata/contacts-handler.php';
require __DIR__ . '/../backend-alwaysdata/auth-session.php';
function check($condition, $label) {
    if (!$condition) throw new RuntimeException($label);
    echo "OK: $label\n";
}
$dsn = getenv('CONTACTS_TEST_DSN') ?: 'sqlite::memory:';
if ($dsn !== 'sqlite::memory:' && strpos($dsn, 'dbname=contacts_test_') === false) throw new RuntimeException('Se requiere una BD contacts_test_ exclusiva.');
$db = new PDO($dsn, getenv('CONTACTS_TEST_USER') ?: null, getenv('CONTACTS_TEST_PASSWORD') ?: null);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
if ($dsn === 'sqlite::memory:') {
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone_number TEXT UNIQUE, password_hash TEXT, status TEXT)');
    $db->exec('CREATE TABLE contactos (id TEXT PRIMARY KEY, owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL,
        phone_number TEXT NOT NULL, callsign TEXT, correo TEXT, unit TEXT, UNIQUE(owner_user_id, phone_number))');
    $db->exec('CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT)');
}
$db->exec('DELETE FROM auth_sessions'); $db->exec('DELETE FROM contactos'); $db->exec('DELETE FROM users');
$db->prepare('INSERT INTO users (id, name, phone_number, password_hash, status) VALUES (?, ?, ?, ?, ?)')->execute(['owner-a', 'Cuenta A', '7710000001', 'password-a', 'online']);
$db->prepare('INSERT INTO users (id, name, phone_number, password_hash, status) VALUES (?, ?, ?, ?, ?)')->execute(['owner-b', 'Cuenta B', '7710000002', 'password-b', 'offline']);
$before = $db->query('SELECT id, name, phone_number, password_hash FROM users ORDER BY id')->fetchAll();
function callContacts($method, $data = [], $query = [], $owner = 'owner-a') {
    global $db; return handleContacts($db, $method, $data, $query, $owner);
}
$sessionA = issueAuthSession($db, 'owner-a'); $sessionB = issueAuthSession($db, 'owner-b');
check(authenticateContactOwner($db, $sessionA['token']) === 'owner-a', 'sesión autenticada identifica al dueño');
check(authenticateContactOwner($db, str_repeat('f', 64)) === null, 'token inventado no autentica');
check(authenticateContactOwner($db, null) === null, 'falta de token no autentica');
check(contactsBearerToken(['HTTP_AUTHORIZATION' => 'Bearer ' . $sessionA['token']]) === $sessionA['token'], 'lee Authorization Bearer');
$db->prepare('UPDATE auth_sessions SET expires_at = ? WHERE user_id = ?')->execute(['2000-01-01 00:00:00', 'owner-b']);
check(authenticateContactOwner($db, $sessionB['token']) === null, 'sesión vencida no autentica');
revokeAuthSession($db, $sessionA['token']);
check(authenticateContactOwner($db, $sessionA['token']) === null, 'logout revoca el token');
foreach ([['secret123', password_hash('secret123', PASSWORD_BCRYPT), null], ['secret123', hash('sha512', 'secret123salt'), 'salt'], ['secret123', 'secret123', null]] as [$password, $hash, $salt]) {
    check(verifyAccountPassword($password, ['password_hash' => $hash, 'salt' => $salt]), 'contraseña registrada válida');
    check(!verifyAccountPassword('incorrecta', ['password_hash' => $hash, 'salt' => $salt]), 'contraseña incorrecta rechazada');
}
check(!verifyAccountPassword('', ['password_hash' => '']), 'contraseña vacía rechazada');
check(!verifyAccountPassword('hash_demo', ['password_hash' => 'hash_demo']), 'placeholder demo no permite acceso');
[$status] = callContacts('GET', [], [], null); check($status === 401, 'CRUD exige sesión');
$input = ['name' => 'Agenda propia', 'phone_number' => '(771) 000-0002', 'email' => 'prueba@example.com', 'owner_user_id' => 'owner-b'];
[$status, $saved] = callContacts('POST', $input);
check($status === 201, 'crear solo en agenda autenticada'); $id = $saved['contact']['id'];
check($saved['contact']['registered_user_id'] === 'owner-b', 'contacto enlaza cuenta registrada por teléfono sin crear usuarios');
[$status, $a] = callContacts('GET'); check(count($a['contacts']) === 1 && $a['contacts'][0]['id'] === $id, 'propietario A ve su contacto');
[$status, $b] = callContacts('GET', [], ['owner_user_id' => 'owner-a'], 'owner-b'); check($b['contacts'] === [], 'B no ve contactos de A aunque altere el query');
[$status] = callContacts('PUT', array_merge($input, ['id' => $id]), [], 'owner-b'); check($status === 404, 'B no edita un ID de A');
[$status] = callContacts('DELETE', ['id' => $id], [], 'owner-b'); check($status === 404, 'B no elimina un ID de A');
[$status] = callContacts('POST', $input); check($status === 409, 'teléfono duplicado dentro de una agenda se rechaza');
[$status] = callContacts('POST', $input, [], 'owner-b'); check($status === 201, 'mismo teléfono permitido para otro propietario');
[$status, $updated] = callContacts('PUT', array_merge($input, ['id' => $id, 'name' => 'Editado', 'phone_number' => '7715559876', 'email' => '']));
check($status === 200 && $updated['contact']['email'] === '' && $updated['contact']['callsign'] === 'RADIO-9876', 'edición persiste y recalcula indicativo');
check($updated['contact']['registered_user_id'] === null, 'contacto sin cuenta no inventa destinatario de chat');
if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'mysql' || $db->query("SHOW COLUMNS FROM contactos LIKE 'owner_user_id'")->fetch()['Null'] === 'YES') {
    $db->prepare('INSERT INTO contactos (id, name, phone_number) VALUES (?, ?, ?)')->execute(['legacy', 'Sin dueño', '7715550000']);
}
[$status, $a] = callContacts('GET'); check(count($a['contacts']) === 1, 'registros antiguos sin dueño no se publican');
[$status] = callContacts('POST', array_merge($input, ['phone_number' => ''])); check($status === 422, 'teléfono obligatorio');
[$status] = callContacts('GET', [], ['limit' => '10000']); check($status === 422, 'límite máximo de página');
[$status] = callContacts('GET', [], ['cursor' => 'invalid']); check($status === 422, 'cursor malformado rechazado');
for ($i = 0; $i < 53; $i++) {
    [$status] = callContacts('POST', ['name' => 'Repetido', 'phone_number' => '7716' . str_pad((string)$i, 6, '0', STR_PAD_LEFT), 'email' => '']);
    if ($status !== 201) throw new RuntimeException('Fixture pagination');
}
$seen = []; $cursor = null; $pages = 0;
do {
    [$status, $page] = callContacts('GET', [], array_filter(['limit' => '20', 'cursor' => $cursor]));
    foreach ($page['contacts'] as $contact) { check(!isset($seen[$contact['id']]), 'paginación sin duplicados'); $seen[$contact['id']] = true; }
    $cursor = $page['next_cursor']; $pages++;
} while ($page['has_more']);
check(count($seen) === 54 && $pages === 3, 'paginación por cursor recorre nombres iguales sin perder contactos');
[$status, $page] = callContacts('GET', [], ['q' => 'Edit']); check(count($page['contacts']) === 1, 'búsqueda por prefijo en servidor');
[$status, $page] = callContacts('GET', [], ['q' => '%']); check($page['contacts'] === [], 'comodín recibido se trata como texto');
[$status, $deleted] = callContacts('POST', ['action' => 'delete', 'id' => $id]); check($status === 200 && $deleted['id'] === $id, 'baja por propietario');
check($db->query('SELECT id, name, phone_number, password_hash FROM users ORDER BY id')->fetchAll() === $before, 'CRUD no crea ni modifica cuentas users');
foreach ([['42S02', 1146, 'CONTACTS_TABLE_MISSING'], ['42S22', 1054, 'CONTACTS_SCHEMA_MISMATCH'], ['42000', 1142, 'CONTACTS_DATABASE_PERMISSIONS']] as [$state, $driver, $code]) {
    $error = new PDOException('Detalles internos'); $error->errorInfo = [$state, $driver, 'Detalles internos'];
    [$status, $body] = contactsErrorResponse($error);
    check($body['code'] === $code && strpos(json_encode($body), 'Detalles internos') === false, 'diagnóstico sin datos SQL privados');
}
echo "PHP PRIVATE CONTACTS PASSED\n";
