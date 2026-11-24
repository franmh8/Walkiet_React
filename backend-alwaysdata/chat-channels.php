<?php
// Un canal y su conversación comparten miembros, pero no la sintonía del PTT.
function chatChannelThreadsReady(PDO $db) {
    static $cache = [];
    $key = spl_object_id($db);
    if (!array_key_exists($key, $cache)) {
        $cache[$key] = (bool)$db->query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chat_channel_threads'")->fetchColumn();
    }
    return $cache[$key];
}
// Solo recibe expresiones SQL constantes del servidor, nunca campos del cliente.
function chatChannelAccessSql(PDO $db, $thread, $user) {
    if (!chatChannelThreadsReady($db)) return '1=1';
    return "(NOT EXISTS(SELECT 1 FROM chat_channel_threads link WHERE link.thread_id=$thread)
        OR EXISTS(SELECT 1 FROM chat_channel_threads link JOIN channels channel ON channel.id=link.channel_id
            JOIN channel_members member ON member.channel_id=channel.id
            WHERE link.thread_id=$thread AND member.user_id=$user))";
}
// El llamador mantiene bloqueado el canal dentro de una transacción.
function chatEnsureChannelThread(PDO $db, array $channel) {
    $id = 'chat-c-' . substr(hash('sha256', $channel['id']), 0, 32);
    $db->prepare("INSERT IGNORE INTO chat_threads(id,kind,name,creator_id) VALUES(?,'group',?,?)")
        ->execute([$id, $channel['name'], $channel['created_by']]);
    $db->prepare('INSERT IGNORE INTO chat_channel_threads(channel_id,thread_id) VALUES(?,?)')->execute([$channel['id'], $id]);
    $stmt = $db->prepare('SELECT thread_id FROM chat_channel_threads WHERE channel_id=?');
    $stmt->execute([$channel['id']]); $id = $stmt->fetchColumn();
    $db->prepare('INSERT IGNORE INTO chat_thread_members(thread_id,user_id) SELECT ?,user_id FROM channel_members WHERE channel_id=?')
        ->execute([$id, $channel['id']]);
    $db->prepare('DELETE FROM chat_thread_members WHERE thread_id=? AND NOT EXISTS(SELECT 1 FROM channel_members cm WHERE cm.channel_id=? AND cm.user_id=chat_thread_members.user_id)')
        ->execute([$id, $channel['id']]);
    return $id;
}
function chatBackfillChannelThreads(PDO $db, $owner) {
    if (!chatChannelThreadsReady($db)) return;
    // Solo escribe al faltar un enlace o la membresía, no en cada sondeo.
    $stmt = $db->prepare('SELECT c.id FROM channels c JOIN channel_members cm ON cm.channel_id=c.id AND cm.user_id=?
        LEFT JOIN chat_channel_threads link ON link.channel_id=c.id
        LEFT JOIN chat_thread_members mine ON mine.thread_id=link.thread_id AND mine.user_id=cm.user_id
        WHERE link.thread_id IS NULL OR mine.user_id IS NULL ORDER BY c.id');
    $stmt->execute([$owner]);
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) {
        $db->beginTransaction();
        try {
            $locked = $db->prepare('SELECT id,name,created_by FROM channels WHERE id=? FOR UPDATE');
            $locked->execute([$id]); $channel = $locked->fetch(PDO::FETCH_ASSOC);
            $member = $db->prepare('SELECT 1 FROM channel_members WHERE channel_id=? AND user_id=?');
            $member->execute([$id, $owner]);
            if ($channel && $member->fetchColumn()) chatEnsureChannelThread($db, $channel);
            $db->commit();
        } catch (Throwable $error) {
            if ($db->inTransaction()) $db->rollBack();
            throw $error;
        }
    }
}
