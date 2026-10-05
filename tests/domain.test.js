'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const demo = require('../examples/directory.json');
const { validateDirectory, planRoute, searchDirectory, publicDirectory } = require('../lib/domain');
const { CommandGate, FrameWatch, canDrive } = require('../public/safety');

test('Persian question resolves manager, Arabic letter variants and inactive destinations', () => {
  assert.ok(searchDirectory(demo, 'اتاق مدیر کجاست؟').some(x => x.id === 'room-manager'));
  assert.ok(searchDirectory(demo, 'مدير').length > 0);
  const d = structuredClone(demo); d.rooms[0].active = false;
  assert.equal(searchDirectory(d, 'مدیر').length, 0);
});
test('Route uses explicit forward/reverse directions across floors', () => {
  const route = planRoute(demo, 'reception', 'room-manager', true);
  assert.equal(route.distance, 24); assert.equal(route.steps.length, 3);
  const d = structuredClone(demo); d.rooms.push({ ...d.rooms[0], id: 'reception-room', nodeId: 'reception' });
  assert.equal(planRoute(d, 'manager', 'reception-room').steps[1].instruction, 'با آسانسور به همکف بروید.');
});
test('Accessible routes reject stairs and never invent a missing route', () => {
  const d = structuredClone(demo); d.edges[1].accessible = false;
  assert.throws(() => planRoute(d, 'reception', 'room-manager', true), /مسیر/);
  assert.equal(planRoute(d, 'reception', 'room-manager', false).distance, 24);
  d.edges[0].bidirectional = false; d.rooms.push({ ...d.rooms[0], id: 'reception-room', nodeId: 'reception' });
  assert.throws(() => planRoute(d, 'manager', 'reception-room'), /مسیر/);
});
test('Directory rejects dangling edges, duplicate ids, invalid coordinates and strips account ids', () => {
  validateDirectory(demo);
  for (const change of [d => d.nodes[0].x = NaN, d => d.edges[0].to = 'missing', d => d.rooms.push(d.rooms[0])]) { const d = structuredClone(demo); change(d); assert.throws(() => validateDirectory(d)); }
  const d = structuredClone(demo); d.people[0].userId = 'staff-user';
  const p = publicDirectory(d).people[0]; assert.equal(p.userId, undefined); assert.equal(p.canNotify, true);
});
test('Movement gate rejects replay, expired challenge, wrong lease and NaN; stop always works', () => {
  let now = 0; const gate = new CommandGate(() => now);
  const m = { c: 'F', v: 100, seq: 1, lease: 'lease1', challenge: 'c1' };
  assert.equal(gate.accept(m), false); gate.grant('lease1'); gate.issue('c1');
  assert.equal(gate.accept(m), true); assert.equal(gate.accept(m), false);
  assert.equal(gate.accept({ ...m, seq: 2, v: NaN }), false);
  now = 451; assert.equal(gate.accept({ ...m, seq: 2 }), false);
  gate.issue('c2'); assert.equal(gate.accept({ ...m, seq: 3 }), false);
  assert.equal(gate.accept({ c: 'S' }), true);
  gate.reset(); assert.equal(gate.accept({ ...m, seq: 4 }), false);
});
test('Fresh frames, visible page, ready board, live server and lease are all required', () => {
  let time = 0; const frames = new FrameWatch(() => time);
  assert.equal(frames.fresh, false); frames.frame(1); assert.equal(frames.fresh, true);
  time = 1300; frames.frame(1); assert.equal(frames.fresh, false);
  frames.frame(2); assert.equal(frames.fresh, true); frames.reset(); assert.equal(frames.fresh, false);
  const state = { link: true, server: true, board: true, video: true, lease: true, visible: true };
  assert.equal(canDrive(state), true);
  for (const key of Object.keys(state)) assert.equal(canDrive({ ...state, [key]: false }), false);
});
