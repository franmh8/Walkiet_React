<?php
function contactsBearerToken(array $server) {
    $header = $server['HTTP_AUTHORIZATION'] ?? $server['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!is_string($header) || !preg_match('/^Bearer ([a-f0-9]{64})$/i', $header, $matches)) return null;
    return $matches[1];
}

function issueAuthSession(PDO $pdo, $userId) {
    $token = bin2hex(random_bytes(32));
    $expires = gmdate('Y-m-d H:i:s', time() + 7 * 86400);
    $stmt = $pdo->prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([hash('sha256', $token), $userId, $expires]);
    return ['token' => $token, 'expires_at' => $expires . ' UTC'];
}

function authenticateContactOwner(PDO $pdo, $token) {
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/i', $token)) return null;
    $stmt = $pdo->prepare('SELECT s.user_id FROM auth_sessions s INNER JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1');
    $stmt->execute([hash('sha256', $token), gmdate('Y-m-d H:i:s')]);
    $owner = $stmt->fetchColumn();
    return $owner === false ? null : (string)$owner;
}

function revokeAuthSession(PDO $pdo, $token) {
    if (is_string($token) && preg_match('/^[a-f0-9]{64}$/i', $token)) {
        $pdo->prepare('DELETE FROM auth_sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    }
}

function verifyAccountPassword($password, array $user) {
    $stored = $user['password_hash'] ?? '';
    if (!is_string($password) || $password === '' || $stored === '' || $stored === 'hash_demo') return false;
    if (password_verify($password, $stored)) return true;
    if (preg_match('/^[a-f0-9]{128}$/i', $stored)) {
        return !empty($user['salt']) && hash_equals($stored, hash('sha512', $password . $user['salt']));
    }
    return substr($stored, 0, 1) !== '$' && hash_equals($stored, $password);
}
