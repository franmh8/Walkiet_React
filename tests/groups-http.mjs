import assert from 'node:assert/strict';
const base = process.env.GROUPS_TEST_BACKEND;
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Usa GROUPS_TEST_BACKEND local con la fixture contacts_test_groups_.');
const php = base.endsWith(':8099');
const endpoint = php ? '/channels.php' : '/api/channels';
async function login(phone) {
  const res = await fetch(base + (php ? '/login.php' : '/api/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identificador: phone, password: 'group-password' }) });
  const data = await res.json(); assert.equal(res.status, 200, JSON.stringify(data)); assert.ok(data.token); return data.token;
}
const a = await login('7710000101'), b = await login('7710000102'), c = await login('7710000103');
async function request(token, action, payload = {}, query = '') {
  const response = await fetch(base + endpoint + query, { method: action ? 'POST' : 'GET', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'text/plain;charset=UTF-8' }, ...(action ? { body: JSON.stringify({ action, ...payload }) } : {}) });
  return { status: response.status, data: await response.json() };
}
assert.equal((await request(null)).status, 401);
for (const token of [a, b, c]) assert.deepEqual((await request(token)).data.channels, []);
const created = await request(a, 'create', { name: 'FF prueba real', pin: '8183', category: 'emergencia', created_by: 'group-b', user_id: 'group-b' });
assert.equal(created.status, 200, JSON.stringify(created.data));
const channel = created.data.channel;
assert.equal(channel.member_count, 1); assert.equal(channel.created_by, 'group-a'); assert.equal(channel.category, 'Táctico'); assert.equal(channel.is_owner, true);
assert.equal((await request(a, 'join', { pin: '8183' })).data.channel.member_count, 1);
assert.deepEqual((await request(b)).data.channels, []);
assert.equal((await request(b, undefined, {}, '?action=members&id=' + channel.id)).status, 404);
assert.equal((await request(b, 'join', { pin: '9999' })).status, 404);
assert.deepEqual((await request(b)).data.channels, []);
assert.equal((await request(b, 'join', { pin: '8183', id: 'missing-channel' })).status, 404);
const joins = await Promise.all(Array.from({ length: 5 }, () => request(b, 'join', { pin: '8183', user_id: 'group-c' })));
for (const result of joins) { assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal(result.data.channel.member_count, 2); }
const members = await request(b, undefined, {}, '?action=members&id=' + channel.id);
assert.equal(members.status, 200); assert.equal(members.data.member_count, 2);
assert.deepEqual(members.data.members.map(m => m.id).sort(), ['group-a', 'group-b']);
assert.equal((await request(a)).data.channels[0].member_count, 2);
assert.deepEqual((await request(c)).data.channels, []);
assert.equal((await request(b, 'delete', { id: channel.id })).status, 403);
assert.equal((await request(a, 'create', { name: 'Otro', pin: '8183' })).status, 409);
assert.equal((await request(b, 'leave', { id: channel.id, user_id: 'group-a' })).status, 200);
assert.deepEqual((await request(b)).data.channels, []);
assert.equal((await request(a)).data.channels[0].member_count, 1);
assert.equal((await request(a, 'leave', { id: channel.id })).status, 200);
assert.deepEqual((await request(a)).data.channels, []);
assert.equal((await request(a, 'join', { pin: '8183', id: channel.id })).data.channel.member_count, 1);
assert.equal((await request(b, 'join', { pin: '8183' })).data.channel.member_count, 2);
assert.equal((await request(a, 'delete', { id: channel.id })).status, 200);
for (const token of [a, b, c]) assert.deepEqual((await request(token)).data.channels, []);
assert.equal((await request(a, 'create', { name: 'Inválido', pin: '123' })).status, 400);
assert.equal((await request(a, 'create', { name: '', pin: '1234' })).status, 400);
console.log(`OK ${php ? 'PHP' : 'Node'}: lista privada vacía, creador real, tipo táctico, cuenta 1→2→1, uniones concurrentes idempotentes, PIN/QR validado, salida persistente y eliminación solo por creador.`);
