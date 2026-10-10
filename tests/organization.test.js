'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { io } = require('socket.io-client');
const { createService } = require('../lib/service');
const { passwordHash } = require('../lib/store');
async function fixture(t, filename) {
  const folder = filename ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'organization-'));
  filename ||= path.join(folder, 'site.json');
  let service;
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) { res.writeHead(404); res.end(); } });
  service = createService(server, { filename });
  if (folder) service.store.change(d => {
    const password = passwordHash('organization-test-password');
    for (const role of ['admin', 'operator', 'staff', 'other', 'robot']) d.users.push({ id: role, name: role, username: role, role: role === 'other' ? 'staff' : role, active: true, robotId: role === 'robot' ? 'r1' : '', password });
    d.robots.push({ id: 'r1', serial: 'RB-TEST01', name: 'Existing', mode: 'welcome', startNodeId: '', active: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port, sockets = [];
  let closed = false;
  async function close() { if (closed) return; closed = true; sockets.forEach(s => s.disconnect()); service.close(); await new Promise(resolve => { server.close(resolve); server.closeIdleConnections?.(); }); }
  t.after(async () => { await close(); if (folder) fs.rmSync(folder, { recursive: true, force: true }); });
  async function api(route, token, method = 'GET', body) {
    const r = await fetch(base + '/api' + route, { method, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json() };
  }
  const login = async username => (await api('/login', '', 'POST', { username, password: 'organization-test-password' })).data.token;
  async function socket(token) { const s = io(base, { auth: { token }, transports: ['websocket'] }); sockets.push(s); await new Promise((resolve, reject) => { s.once('connect', resolve); s.once('connect_error', reject); }); return s; }
  return { api, login, socket, service, filename, close };
}
const event = (s, name) => new Promise(resolve => s.once(name, resolve));
const ack = (s, name, body) => new Promise(resolve => s.emit(name, body, resolve));
test('setup persists across login and repeats on server boot without changing robot identity', async t => {
  const f = await fixture(t), token = await f.login('admin');
  assert.equal((await f.api('/organization/state', token)).data.setup.completed, false);
  assert.equal((await f.api('/organization/setup', token, 'POST', { name: 'آوا', robotId: 'r1', address: '192.168.1.10:3000' })).status, 200);
  assert.equal((await f.api('/organization/state', await f.login('admin'))).data.setup.completed, true);
  assert.equal(f.service.store.data.robots[0].serial, 'RB-TEST01'); assert.equal(f.service.store.data.robots[0].mode, 'welcome');
  await f.close(); const restarted = await fixture(t, f.filename);
  const state = (await restarted.api('/organization/state', await restarted.login('admin'))).data;
  assert.equal(state.setup.completed, false); assert.equal(state.setup.name, 'آوا'); assert.equal(state.setup.address, '192.168.1.10:3000');
});
test('private uploads, role enforcement, verified reset and parent-bound call-only handoff', async t => {
  const f = await fixture(t), admin = await f.login('admin'), staff = await f.login('staff'), robot = await f.login('robot');
  assert.equal((await f.api('/organization/state', robot)).status, 403);
  assert.equal((await f.api('/organization/profile', staff, 'PUT', { name: 'Forbidden' })).status, 403);
  assert.equal((await f.api('/organization/profile', admin, 'PUT', { name: 'Organization', logo: 'data:image/svg+xml;base64,AAAA' })).status, 400);
  const document = { name: 'building.pdf', mime: 'application/pdf', data: Buffer.from('%PDF-1.4\nfixture').toString('base64') };
  assert.equal((await f.api('/organization/profile', admin, 'PUT', { name: 'Organization', description: 'Hours', document })).status, 200);
  assert.equal((await f.api('/organization/state', staff)).data.profile.document.data, undefined);
  assert.equal((await f.api('/organization/document', staff)).data.data, document.data);
  assert.equal((await f.api('/organization/setup', admin, 'POST', { name: 'Robot', robotId: 'r1', address: 'example.com/private?token=secret' })).status, 400);
  const handoff = (await f.api('/organization/robot-token', admin, 'POST', { robotId: 'r1' })).data;
  assert.equal((await f.api('/organization/state', handoff.token)).status, 403);
  assert.equal((await f.api('/me', handoff.token)).status, 200);
  assert.equal((await f.api('/organization/reset', admin, 'POST', { confirm: 'RESET', password: 'wrong' })).status, 403);
  assert.equal((await f.api('/organization/reset', admin, 'POST', { confirm: 'RESET', password: 'organization-test-password' })).status, 200);
  assert.equal(f.service.store.data.robots.length, 1); assert.equal(f.service.store.data.users.length, 5);
  await f.api('/logout', admin, 'POST'); assert.equal((await f.api('/me', handoff.token)).status, 401);
});
test('chat remains private and expert WebRTC signaling binds participants and sockets', async t => {
  const f = await fixture(t), admin = await f.login('admin'), staff = await f.login('staff'), other = await f.login('other');
  const a = await f.socket(admin), s = await f.socket(staff), o = await f.socket(other);
  const thread = (await f.api('/organization/threads', admin, 'POST', { expertId: 'staff' })).data;
  assert.equal((await f.api('/organization/threads/' + thread.id, other)).status, 404);
  const delivered = event(s, 'expert:message');
  assert.equal((await f.api('/organization/threads/' + thread.id + '/messages', admin, 'POST', { text: '<script>hello</script>' })).status, 201);
  assert.equal((await delivered).message.text, '<script>hello</script>');
  assert.equal((await f.api('/organization/threads/' + thread.id, staff)).data.messages.length, 1);
  const ringing = event(s, 'expert:call'); const call = (await f.api('/organization/threads/' + thread.id + '/call', admin, 'POST', {})).data; assert.equal((await ringing).id, call.id);
  assert.equal((await f.api('/organization/calls/' + call.id + '/accept', other, 'POST', {})).status, 404);
  assert.equal((await f.api('/organization/calls/' + call.id + '/accept', staff, 'POST', {})).status, 200);
  assert.equal((await ack(a, 'expert:join', { callId: call.id })).ok, true); assert.equal((await ack(s, 'expert:join', { callId: call.id })).ok, true);
  assert.ok((await ack(o, 'expert:join', { callId: call.id })).error);
  assert.ok((await ack(s, 'expert:signal', { callId: call.id, type: 'offer', description: { type: 'offer', sdp: 'v=0' } })).error);
  const offer = event(s, 'expert:signal');
  assert.equal((await ack(a, 'expert:signal', { callId: call.id, type: 'offer', description: { type: 'offer', sdp: 'v=0' } })).ok, true); assert.equal((await offer).description.sdp, 'v=0');
  const ended = event(s, 'expert:call'); a.disconnect(); assert.equal((await ended).state, 'ended');
});
