<?php
// Copia los endpoints a un directorio temporal; no usa conexion.php de producción.
$dsn = getenv('CONTACTS_TEST_DSN') ?: '';
if (strpos($dsn, 'dbname=contacts_test_') === false) throw new RuntimeException('Se requiere una BD contacts_test_ exclusiva de pruebas.');
$destination = $argv[1] ?? '';
if (!$destination || !is_dir($destination)) throw new RuntimeException('Indica un directorio temporal existente como primer argumento.');
$source = __DIR__ . '/../../backend-alwaysdata';
foreach (['security.php','security-handler.php','security-mail.php','account.php','account-handler.php','ptt.php','ptt-worker.php','ptt-handler.php','ptt-livekit.php','voice-messages.php','channels.php','channels-handler.php','contacts.php','contacts-handler.php','auth-session.php','login.php','logout.php','reset-password.php','cors.php'] as $name) copy($source . '/' . $name, $destination . '/' . $name);
file_put_contents($destination . '/conexion.php', <<<'CONNECTION'
<?php
$dsn = getenv('CONTACTS_TEST_DSN') ?: '';
if (strpos($dsn, 'dbname=contacts_test_') === false) throw new RuntimeException('Test database required');
$pdo = new PDO($dsn, getenv('CONTACTS_TEST_USER') ?: null, getenv('CONTACTS_TEST_PASSWORD') ?: null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
function getJsonInput() { $data = json_decode(file_get_contents('php://input'), true); return is_array($data) ? $data : []; }
CONNECTION
);
file_put_contents($destination . '/router.php', <<<'ROUTER'
<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/api/security') { require __DIR__ . '/security.php'; return true; }
if ($path === '/api/account') { require __DIR__ . '/account.php'; return true; }
if ($path === '/api/ptt') { require __DIR__ . '/ptt.php'; return true; }
if ($path === '/api/channels') { require __DIR__ . '/channels.php'; return true; }
if ($path === '/api/contacts') { require __DIR__ . '/contacts.php'; return true; }
if ($path === '/api/auth/logout') { require __DIR__ . '/logout.php'; return true; }
if (in_array($path, ['/security.php', '/account.php', '/ptt.php', '/voice-messages.php', '/channels.php', '/login.php', '/logout.php', '/contacts.php', '/reset-password.php'], true)) return false;
require __DIR__ . '/cors.php';
echo json_encode(['success' => true, 'channels' => [], 'contacts' => []]);
ROUTER
);
echo "Backend de pruebas preparado. Ejecutar PHP -S conservando las variables CONTACTS_TEST_.\n";
