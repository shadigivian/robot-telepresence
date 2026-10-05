'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { io: client } = require('socket.io-client');
const { createService } = require('../lib/service');
const { passwordHash, Store } = require('../lib/store');
const demo = require('../examples/directory.json');

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-service-')), filename = path.join(dir, 'site.json');
  let service, clock = Date.now();
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) { res.writeHead(404); res.end(); } });
  service = createService(server, { filename, now: () => clock });
  service.store.change(d => {
    d.directory = structuredClone(demo); d.directory.people[0].userId = 'staff';
    d.robots.push({ id: 'r1', serial: 'RB-TEST01', name: 'Test', location: 'reception', active: true, mode: 'welcome', startNodeId: 'reception' });
    for (const role of ['admin', 'operator', 'staff', 'robot']) d.users.push({ id: role, username: role, name: role, role, active: true, robotId: role === 'robot' ? 'r1' : '', password: passwordHash('test-password-12345') });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`, sockets = [];
  t.after(async () => { for (const s of sockets) s.disconnect(); service.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); });
  async function api(p, method = 'GET', data, token, extraHeaders = {}) {
    const response = await fetch(url + '/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const login = async role => (await api('/login', 'POST', { username: role, password: 'test-password-12345' })).data.token;
  async function socket(token) { const s = client(url, { auth: { token }, transports: ['websocket'] }); sockets.push(s); await new Promise((resolve, reject) => { s.once('connect', resolve); s.once('connect_error', reject); }); return s; }
  const emit = (s, event, value) => new Promise((resolve, reject) => s.timeout(2000).emit(event, value, (err, result) => err ? reject(err) : resolve(result)));
  return { service, filename, api, login, socket, emit, advance: ms => clock += ms };
}
test('Authentication, roles, strict origin, durable notification lifecycle and idempotency', async t => {
  const f = await fixture(t), admin = await f.login('admin'), robot = await f.login('robot'), staff = await f.login('staff'), operator = await f.login('operator');
  assert.equal((await f.api('/admin/state')).status, 401);
  assert.equal((await f.api('/admin/state', 'GET', null, staff)).status, 403);
  assert.equal((await f.api('/directory', 'GET', null, admin, { Origin: 'https://evil.test' })).status, 403);
  const v = { requestId: 'request-123', personId: 'person-manager', visitor: '<img src=x>', note: 'arriving' };
  assert.equal((await f.api('/visits', 'POST', v, operator)).status, 403);
  const created = await f.api('/visits', 'POST', v, robot); assert.equal(created.status, 201);
  const repeated = await f.api('/visits', 'POST', v, robot); assert.equal(repeated.data.id, created.data.id);
  assert.equal(f.service.store.data.visits.length, 1);
  assert.equal((await f.api('/visits/' + created.data.id, 'GET', null, staff)).status, 404);
  const inbox = await f.api('/inbox', 'GET', null, staff); assert.equal(inbox.data.length, 1); assert.equal(inbox.data[0].status, 'registered');
  for (const status of ['delivered', 'seen', 'responded']) assert.equal((await f.api('/visits/' + created.data.id, 'POST', { status, response: status === 'responded' ? 'Come in' : '' }, staff)).status, 200);
  await f.api('/visits/' + created.data.id, 'POST', { status: 'delivered' }, staff);
  const reload = new Store(f.filename); assert.equal(reload.data.visits[0].status, 'responded'); assert.equal(reload.data.visits[0].response, 'Come in');
  const directory = await f.api('/directory', 'GET', null, robot); assert.equal(directory.data.people[0].userId, undefined);
});
test('Sessions bind to authenticated peers; media proofs are one-use; leases expire and invitations revoke', async t => {
  const f = await fixture(t), robot = await f.login('robot'), operator = await f.login('operator'), admin = await f.login('admin');
  const rs = await f.socket(robot), os = await f.socket(operator);
  assert.equal((await f.emit(rs, 'robot:state', { online: true, board: true, camera: true })).ok, true);
  const created = await f.api('/sessions', 'POST', { robotId: 'r1', peerId: 'user-test' }, operator); assert.equal(created.status, 201);
  const s = created.data;
  assert.equal((await f.api('/sessions', 'POST', { robotId: 'r1', peerId: 'other' }, admin)).status, 409);
  assert.equal((await f.api('/sessions/verify', 'POST', { id: s.id, secret: s.secret, peerId: 'wrong' }, robot)).status, 403);
  assert.equal((await f.api('/sessions/verify', 'POST', { id: s.id, secret: s.secret, peerId: 'user-test' }, robot)).status, 200);
  assert.equal((await f.api(`/sessions/${s.id}/media-proof`, 'POST', {}, operator)).status, 403);
  const proof = (await f.api(`/sessions/${s.id}/media-proof`, 'POST', {}, robot)).data.proof;
  assert.equal((await f.api(`/sessions/${s.id}/media-verify`, 'POST', { proof }, operator)).status, 200);
  assert.equal((await f.api(`/sessions/${s.id}/media-verify`, 'POST', { proof }, operator)).status, 403);
  await f.emit(os, 'session:join', s.id);
  assert.equal((await f.api(`/sessions/${s.id}/control`, 'POST', {}, operator)).status, 201);
  assert.equal((await f.emit(os, 'control:renew', s.id)).ok, true);
  f.advance(3100); assert.ok((await f.emit(os, 'control:renew', s.id)).error);
  await f.api(`/sessions/${s.id}`, 'DELETE', {}, operator);
  const invite = (await f.api('/invites', 'POST', { robotId: 'r1', canDrive: false }, robot)).data;
  const guest = await f.api('/invites/redeem', 'POST', { token: invite.token }); assert.equal(guest.status, 200);
  assert.equal((await f.api('/invites/redeem', 'POST', { token: invite.token })).status, 401);
  await f.emit(rs, 'robot:state', { online: true, board: true, camera: true });
  const gs = await f.api('/sessions', 'POST', { robotId: 'r1', peerId: 'guest-test' }, guest.data.token); assert.equal(gs.data.canDrive, false);
  assert.equal((await f.api(`/sessions/${gs.data.id}/control`, 'POST', {}, guest.data.token)).status, 403);
  await f.api('/invites', 'DELETE', { robotId: 'r1' }, robot);
  assert.equal((await f.api('/me', 'GET', null, guest.data.token)).status, 401);
});
test('Disconnecting the robot revokes control, disables users and rejects malformed payloads', async t => {
  const f = await fixture(t), robot = await f.login('robot'), operator = await f.login('operator'), admin = await f.login('admin');
  const rs = await f.socket(robot); await f.emit(rs, 'robot:state', { online: true, board: true, camera: true });
  const s = (await f.api('/sessions', 'POST', { robotId: 'r1', peerId: 'user-test' }, operator)).data;
  assert.equal((await f.api(`/sessions/${s.id}/control`, 'POST', {}, operator)).status, 201);
  rs.disconnect(); await new Promise(r => setTimeout(r, 50));
  assert.equal((await f.api(`/sessions/${s.id}/control`, 'POST', {}, operator)).status, 409);
  assert.equal((await f.api('/admin/users/operator', 'PUT', { active: false }, admin)).status, 200);
  assert.equal((await f.api('/me', 'GET', null, operator)).status, 401);
  const bad = structuredClone(demo); bad.edges[0].to = 'missing';
  assert.equal((await f.api('/admin/directory', 'PUT', bad, admin)).status, 400);
  assert.deepEqual(f.service.store.data.directory.nodes, demo.nodes);
});
test('Abandoned browser sessions free the robot after the reconnect grace period', async t => {
  const f = await fixture(t), robot = await f.login('robot'), operator = await f.login('operator');
  const rs = await f.socket(robot), os = await f.socket(operator);
  await f.emit(rs, 'robot:state', { online: true, board: true, camera: true });
  const s = (await f.api('/sessions', 'POST', { robotId: 'r1', peerId: 'user-test' }, operator)).data;
  await f.emit(os, 'session:join', s.id); os.disconnect(); await new Promise(r => setTimeout(r, 30));
  f.advance(31000); await new Promise(r => setTimeout(r, 600));
  await f.emit(rs, 'robot:state', { online: true, board: true, camera: true });
  assert.equal((await f.api('/sessions', 'POST', { robotId: 'r1', peerId: 'new-user' }, operator)).status, 201);
});
