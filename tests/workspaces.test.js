'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { io: socketClient } = require('socket.io-client');
const { createService } = require('../lib/service');
const { Store, passwordHash } = require('../lib/store');
const { emptyDirectory, summaries } = require('../lib/workspaces');
const demo = require('../examples/directory.json');

function directory(name, prefix, distance = 7) {
  return {
    name, floors: [{ id: `${prefix}-floor`, name: 'Ground' }],
    nodes: [{ id: `${prefix}-start`, name: 'Reception', floorId: `${prefix}-floor`, x: 0, y: 0 }, { id: `${prefix}-destination`, name: 'Manager', floorId: `${prefix}-floor`, x: 50, y: 50 }],
    edges: [{ from: `${prefix}-start`, to: `${prefix}-destination`, distance, instruction: 'Go to manager', reverseInstruction: 'Return to reception', accessible: true, bidirectional: true }],
    rooms: [{ id: `${prefix}-room`, name: `${name} room`, nodeId: `${prefix}-destination`, number: '101', department: '', hours: '', aliases: [], active: true }],
    people: [{ id: 'person-manager', name: `${name} manager`, title: 'Manager', roomId: `${prefix}-room`, aliases: ['manager'], active: true, availability: '', userId: 'staff' }],
  };
}

async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-workspaces-'));
  const filename = path.join(dir, 'site.json');
  let service;
  const server = http.createServer(async (req, res) => { if (!await service.handle(req, res)) { res.writeHead(404); res.end(); } });
  service = createService(server, { filename });
  const password = passwordHash('workspace-test-password');
  service.store.change(d => {
    d.directory = structuredClone(demo); d.directory.people[0].userId = 'staff';
    d.workspaces.find(w => w.id === 'university').directory = directory('University', 'u');
    d.workspaces.find(w => w.id === 'hospital').directory = directory('Hospital', 'h', 17);
    d.workspaces.find(w => w.id === 'hospital').directory.people.push({ ...directory('Hospital', 'h').people[0], id: 'other-person', name: 'Other recipient', userId: 'other-staff' });
    d.robots.push(
      { id: 'robot-u', workspaceId: 'university', serial: 'RB-UNI01', name: 'University robot', location: 'Reception', mode: 'welcome', startNodeId: 'u-start', active: true },
      { id: 'robot-h', workspaceId: 'hospital', serial: 'RB-HOSP01', name: 'Hospital robot', location: 'Reception', mode: 'telepresence', startNodeId: 'h-start', active: true },
      { id: 'robot-legacy', serial: 'RB-LEGACY01', name: 'Existing robot', location: 'Reception', mode: 'welcome', startNodeId: 'reception', active: true },
    );
    for (const role of ['admin', 'operator', 'staff']) d.users.push({ id: role, username: role, name: role, role, active: true, robotId: '', password });
    d.users.push({ id: 'other-staff', username: 'other-staff', name: 'Other staff', role: 'staff', active: true, robotId: '', password });
    for (const robotId of ['robot-u', 'robot-h', 'robot-legacy']) d.users.push({ id: robotId, username: robotId, name: robotId, role: 'robot', active: true, robotId, password });
    d.visits.push({ id: 'legacy-visit', requestId: 'existing', robotId: 'robot-legacy', recipientId: 'staff', destination: 'Existing destination', visitor: 'Existing visitor', note: '', status: 'registered', response: '', createdAt: 1, updatedAt: 1, watchToken: 'private-test-watch' });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, sockets = [];
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    service.close();
    await new Promise(resolve => { server.close(resolve); server.closeIdleConnections?.(); });
    fs.rmSync(dir, { recursive: true, force: true });
  });
  async function api(route, method = 'GET', body, token) {
    const response = await fetch(base + '/api' + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const login = async username => (await api('/login', 'POST', { username, password: 'workspace-test-password' })).data.token;
  async function socket(token) {
    const client = socketClient(base, { auth: { token }, transports: ['websocket'] }); sockets.push(client);
    await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    return client;
  }
  return { service, filename, api, login, socket };
}

test('Workspace migration seeds independent empty categories once and preserves every legacy record', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-workspace-migration-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'site.json');
  const previous = { version: 1, directory: structuredClone(demo), users: [{ id: 'existing-user', password: 'existing-hash' }], robots: [{ id: 'existing-robot', serial: 'RB-OLD01' }], visits: [{ id: 'existing-visit', robotId: 'existing-robot' }] };
  fs.writeFileSync(filename, JSON.stringify(previous));
  const store = new Store(filename);
  for (const key of ['directory', 'users', 'robots', 'visits']) assert.deepEqual(store.data[key], previous[key]);
  assert.deepEqual(store.data.workspaces.map(w => w.id), ['university', 'hospital', 'office', 'mall', 'museum']);
  assert.ok(store.data.workspaces.every(w => w.directory.rooms.length === 0 && w.directory.nodes.length === 0));
  const university = store.data.workspaces[0], hospital = store.data.workspaces[1];
  assert.notEqual(university.directory.nodes, hospital.directory.nodes);
  store.change(d => { d.workspaces[0].directory = directory('Saved campus', 'campus'); });
  const saved = fs.readFileSync(filename, 'utf8');
  const reloaded = new Store(filename);
  assert.equal(reloaded.data.workspaces[0].directory.name, 'Saved campus');
  assert.equal(fs.readFileSync(filename, 'utf8'), saved);
  assert.equal(summaries(reloaded.data).find(w => w.id === 'legacy').robotCount, 1);
  const empty = new Store(path.join(dir, 'fresh.json'));
  assert.equal(summaries(empty.data).length, 5);
});

test('Workspace summaries and admin state preserve shared accounts and legacy defaults while filtering robots', async t => {
  const f = await fixture(t), admin = await f.login('admin'), operator = await f.login('operator'), staff = await f.login('staff');
  assert.equal((await f.api('/workspaces')).status, 401);
  for (const token of [admin, operator, staff]) {
    const response = await f.api('/workspaces', 'GET', null, token);
    assert.equal(response.status, 200); assert.equal(response.data.length, 6);
    assert.equal(response.data.find(w => w.id === 'university').welcomeCount, 1);
    assert.equal(response.data.find(w => w.id === 'hospital').telepresenceCount, 1);
  }
  const university = (await f.api('/admin/state?workspace=university', 'GET', null, admin)).data;
  assert.equal(university.workspace.id, 'university'); assert.equal(university.directory.name, 'University');
  assert.deepEqual(university.robots.map(r => r.id), ['robot-u']);
  assert.equal(university.allRobots.length, 3);
  assert.equal(university.allRobots.find(r => r.id === 'robot-legacy').workspaceId, 'legacy');
  assert.ok(university.users.every(u => u.password === undefined));
  const legacy = (await f.api('/admin/state', 'GET', null, admin)).data;
  assert.equal(legacy.workspace.id, 'legacy'); assert.deepEqual(legacy.robots.map(r => r.id), ['robot-legacy']);
  assert.equal(legacy.robots[0].workspaceId, 'legacy'); assert.deepEqual(legacy.directory.nodes, demo.nodes);
  assert.equal((await f.api('/admin/state?workspace=university', 'GET', null, operator)).status, 403);
  assert.equal((await f.api('/admin/state?workspace=unknown', 'GET', null, admin)).status, 400);
  assert.equal((await f.api('/robots?workspace=unknown', 'GET', null, operator)).status, 400);
  assert.equal((await f.api('/robots?mode=autonomous', 'GET', null, operator)).status, 400);
  assert.equal((await f.api('/robots', 'GET', null, operator)).data.length, 3);
  assert.deepEqual((await f.api('/robots?workspace=hospital&mode=telepresence', 'GET', null, operator)).data.map(r => r.id), ['robot-h']);
  assert.equal((await f.api('/robots?workspace=hospital&mode=welcome', 'GET', null, operator)).data.length, 0);
  assert.equal((await f.api('/directory?workspace=hospital', 'GET', null, staff)).data.name, 'Hospital');
});

test('Directory and robot changes affect only the selected workspace and forbid implicit moves or global serial collisions', async t => {
  const f = await fixture(t), admin = await f.login('admin'), operator = await f.login('operator');
  const socket = await f.socket(operator);
  const changed = new Promise(resolve => socket.once('directory:changed', resolve));
  assert.equal((await f.api('/admin/directory?workspace=office', 'PUT', emptyDirectory('Independent office'), admin)).status, 200);
  assert.deepEqual(await changed, { workspaceId: 'office' });
  assert.equal((await f.api('/admin/directory?workspace=university', 'PUT', emptyDirectory('Broken campus'), admin)).status, 400);
  const updated = directory('Updated campus', 'u');
  assert.equal((await f.api('/admin/directory?workspace=university', 'PUT', updated, admin)).status, 200);
  assert.equal((await f.api('/admin/state?workspace=hospital', 'GET', null, admin)).data.directory.name, 'Hospital');
  assert.deepEqual((await f.api('/admin/state', 'GET', null, admin)).data.directory.nodes, demo.nodes);
  const robot = { id: 'new-robot', workspaceId: 'hospital', serial: 'RB-NEW01', name: 'New hospital robot', location: '', mode: 'welcome', startNodeId: 'u-start', active: true };
  assert.equal((await f.api('/admin/robots', 'POST', robot, admin)).status, 400);
  robot.startNodeId = 'h-start';
  assert.equal((await f.api('/admin/robots', 'POST', { ...robot, id: 'robot-u' }, admin)).status, 409);
  assert.equal((await f.api('/admin/robots', 'POST', { ...robot, serial: 'RB-UNI01' }, admin)).status, 409);
  assert.equal((await f.api('/admin/robots', 'POST', robot, admin)).status, 200);
  assert.equal((await f.api('/admin/state?workspace=hospital', 'GET', null, admin)).data.robots.length, 2);
  const reloaded = new Store(f.filename);
  assert.equal(reloaded.data.workspaces.find(w => w.id === 'university').directory.name, 'Updated campus');
  assert.equal(reloaded.data.robots.find(r => r.id === 'new-robot').workspaceId, 'hospital');
  assert.equal(reloaded.data.robots.find(r => r.id === 'robot-legacy').workspaceId, undefined);
});

test('Bound robots and guests use their own maps, routes and settings; staff inboxes remain recipient scoped', async t => {
  const f = await fixture(t), u = await f.login('robot-u'), h = await f.login('robot-h'), staff = await f.login('staff'), other = await f.login('other-staff');
  assert.equal((await f.api('/directory', 'GET', null, u)).data.name, 'University');
  assert.equal((await f.api('/directory?workspace=hospital', 'GET', null, u)).status, 403);
  assert.equal((await f.api('/search?q=manager', 'GET', null, u)).data[0].label, 'University manager');
  assert.equal((await f.api('/route?from=u-start&room=u-room&accessible=true', 'GET', null, u)).data.distance, 7);
  assert.equal((await f.api('/route?from=h-start&room=h-room', 'GET', null, u)).status, 404);
  assert.equal((await f.api('/robot/settings', 'POST', { mode: 'welcome', startNodeId: 'h-start' }, u)).status, 400);
  assert.equal((await f.api('/robot/settings', 'POST', { mode: 'welcome', startNodeId: 'u-start' }, u)).status, 200);
  const invite = (await f.api('/invites', 'POST', { robotId: 'robot-u', canDrive: false }, u)).data;
  const guest = (await f.api('/invites/redeem', 'POST', { token: invite.token })).data.token;
  assert.equal((await f.api('/directory', 'GET', null, guest)).data.name, 'University');
  assert.equal((await f.api('/search?workspace=hospital', 'GET', null, guest)).status, 403);
  assert.equal((await f.api('/robots?workspace=hospital', 'GET', null, guest)).status, 403);
  assert.equal((await f.api('/workspaces', 'GET', null, guest)).status, 403);
  assert.equal((await f.api('/workspaces', 'GET', null, u)).status, 403);
  const visit = { requestId: 'campus-visit', personId: 'person-manager', visitor: 'Test visitor', note: '' };
  const universityVisit = await f.api('/visits', 'POST', visit, u);
  assert.equal(universityVisit.status, 201);
  assert.equal((await f.api('/visits', 'POST', visit, u)).data.id, universityVisit.data.id);
  const hospitalVisit = await f.api('/visits', 'POST', { ...visit, requestId: 'hospital-visit' }, h);
  const otherVisit = await f.api('/visits', 'POST', { ...visit, requestId: 'other-visit', personId: 'other-person' }, h);
  assert.equal(hospitalVisit.status, 201); assert.equal(otherVisit.status, 201);
  const campusInbox = (await f.api('/inbox?workspace=university', 'GET', null, staff)).data;
  assert.equal(campusInbox.length, 1); assert.equal(campusInbox[0].workspaceId, 'university'); assert.equal(campusInbox[0].watchToken, undefined);
  assert.equal((await f.api('/inbox?workspace=hospital', 'GET', null, staff)).data.length, 1);
  const legacyInbox = (await f.api('/inbox?workspace=legacy', 'GET', null, staff)).data;
  assert.equal(legacyInbox.length, 1); assert.equal(legacyInbox[0].workspaceId, 'legacy');
  assert.equal((await f.api('/inbox', 'GET', null, staff)).data.length, 3);
  assert.equal((await f.api('/inbox?workspace=hospital', 'GET', null, other)).data.length, 1);
  assert.equal((await f.api(`/visits/${otherVisit.data.id}`, 'POST', { status: 'seen' }, staff)).status, 404);
  assert.equal((await f.api(`/visits/${universityVisit.data.id}`, 'GET', null, h)).status, 404);
  const reloaded = new Store(f.filename);
  assert.equal(reloaded.data.visits.find(v => v.id === universityVisit.data.id).workspaceId, 'university');
  assert.equal(reloaded.data.visits.find(v => v.id === hospitalVisit.data.id).workspaceId, 'hospital');
  assert.equal(reloaded.data.visits.find(v => v.id === 'legacy-visit').workspaceId, undefined);
});

test('Explicit legacy transfer preserves records and accounts, stops sessions, and never overwrites a populated workspace', async t => {
  const f = await fixture(t), admin = await f.login('admin'), operator = await f.login('operator'), robot = await f.login('robot-legacy');
  const prior = structuredClone(f.service.store.data);
  assert.equal((await f.api('/admin/workspaces/office/import-legacy', 'POST', {}, operator)).status, 403);
  assert.equal((await f.api('/admin/workspaces/legacy/import-legacy', 'POST', {}, admin)).status, 400);
  assert.equal((await f.api('/admin/workspaces/university/import-legacy', 'POST', {}, admin)).status, 409);
  assert.deepEqual(f.service.store.data, prior);
  const rs = await f.socket(robot), os = await f.socket(operator);
  const state = await new Promise((resolve, reject) => rs.timeout(2000).emit('robot:state', { online: true, camera: true, board: true }, (error, result) => error ? reject(error) : resolve(result)));
  assert.equal(state.ok, true);
  const session = (await f.api('/sessions', 'POST', { robotId: 'robot-legacy', peerId: 'workspace-test-peer' }, operator)).data;
  assert.equal((await f.api(`/sessions/${session.id}/control`, 'POST', {}, operator)).status, 201);
  const robotChanged = new Promise(resolve => rs.once('robot:changed', resolve));
  const directoryChanges = [];
  const changesReady = new Promise(resolve => os.on('directory:changed', value => {
    directoryChanges.push(value.workspaceId); if (directoryChanges.length === 2) resolve();
  }));
  const response = await f.api('/admin/workspaces/office/import-legacy', 'POST', {}, admin);
  assert.equal(response.status, 200); assert.equal(response.data.workspace.id, 'office');
  assert.equal((await robotChanged).workspaceId, 'office');
  await changesReady;
  assert.equal((await f.api(`/sessions/${session.id}/control`, 'POST', {}, operator)).status, 404);
  assert.deepEqual(directoryChanges, ['legacy', 'office']);
  const saved = new Store(f.filename).data;
  assert.deepEqual(saved.users, prior.users);
  assert.deepEqual(saved.workspaces.find(w => w.id === 'office').directory, prior.directory);
  assert.deepEqual(saved.workspaces.find(w => w.id === 'university'), prior.workspaces.find(w => w.id === 'university'));
  assert.deepEqual(saved.robots.find(r => r.id === 'robot-legacy'), { ...prior.robots.find(r => r.id === 'robot-legacy'), workspaceId: 'office' });
  assert.deepEqual(saved.visits.find(v => v.id === 'legacy-visit'), { ...prior.visits.find(v => v.id === 'legacy-visit'), workspaceId: 'office' });
  assert.deepEqual(saved.legacyArchive.directory, prior.directory);
  assert.deepEqual(saved.legacyArchive.robotIds, ['robot-legacy']);
  assert.equal(saved.legacyArchive.workspaceId, 'office');
  assert.ok(['floors', 'nodes', 'edges', 'rooms', 'people'].every(key => saved.directory[key].length === 0));
  assert.equal((await f.api('/directory', 'GET', null, robot)).data.name, prior.directory.name);
  assert.equal((await f.api('/workspaces', 'GET', null, admin)).data.some(w => w.id === 'legacy'), false);
  assert.equal((await f.api('/admin/workspaces/museum/import-legacy', 'POST', {}, admin)).status, 409);
  assert.deepEqual(new Store(f.filename).data, saved);
});

test('Legacy transfer refuses a target with assigned robots even when its directory is empty', async t => {
  const f = await fixture(t), admin = await f.login('admin');
  const robot = { id: 'office-robot', workspaceId: 'office', serial: 'RB-OFFICE01', name: 'Office robot', location: '', mode: 'welcome', startNodeId: '', active: true };
  assert.equal((await f.api('/admin/robots', 'POST', robot, admin)).status, 200);
  const previous = structuredClone(f.service.store.data);
  assert.equal((await f.api('/admin/workspaces/office/import-legacy', 'POST', {}, admin)).status, 409);
  assert.deepEqual(f.service.store.data, previous);
});
