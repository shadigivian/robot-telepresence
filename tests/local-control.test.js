'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLocalControl } = require('../lib/local-control');

function fixture(t, retry = async () => 'starting') {
  const parent = path.resolve(os.tmpdir());
  const prefix = 'robot-local-control-test-';
  const directory = fs.mkdtempSync(path.join(parent, prefix));
  t.after(() => {
    // Delete only the test directory created immediately above, never a
    // computed parent or a real deployment's private configuration.
    assert.equal(path.dirname(path.resolve(directory)), parent);
    assert.ok(path.basename(directory).startsWith(prefix));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const filename = path.join(directory, 'control.json');
  const control = createLocalControl({ filename, port: 3333, retry });
  const capability = JSON.parse(fs.readFileSync(filename, 'utf8'));
  return { control, filename, capability };
}

function request({ headers = {}, method = 'POST', address = '127.0.0.1' } = {}) {
  return {
    method, headers: { host: 'localhost:3333', ...headers }, socket: { remoteAddress: address },
    resumed: 0, resume() { this.resumed++; },
  };
}

function response() {
  return {
    status: null, headers: {}, body: '',
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; },
    end(body = '') { this.body = body; },
  };
}

test('Local retry endpoint rejects nonlocal hosts, clients, foreign origins and tunnel headers', async t => {
  let calls = 0;
  const f = fixture(t, async () => { calls++; return 'starting'; });
  const cases = [
    { headers: { host: 'attacker.test:3333' } },
    { headers: { host: 'localhost:3333.attacker.test' } },
    { headers: { host: 'localhost' } },
    { headers: { host: '' } },
    { address: '192.168.1.2' },
    { address: '::2' },
    { headers: { origin: 'https://attacker.test' } },
    { headers: { origin: 'https://localhost:3333' } },
    { headers: { origin: 'null' } },
    { headers: { 'cf-ray': 'test-tunnel' } },
  ];
  for (const options of cases) {
    const req = request(options), res = response();
    req.headers['x-robot-local-key'] = f.capability.key;
    assert.equal(await f.control.handle(req, res, '/share-retry'), true);
    assert.equal(res.status, 404);
    assert.equal(res.body, 'Not found');
    assert.equal(req.resumed, 0);
  }
  assert.equal(calls, 0);
});

test('Unrelated paths pass through and GET cannot retry even with a valid capability', async t => {
  let calls = 0;
  const f = fixture(t, async () => { calls++; });
  const unrelated = response();
  assert.equal(await f.control.handle(request(), unrelated, '/user'), false);
  assert.equal(unrelated.status, null);
  const res = response();
  assert.equal(await f.control.handle(request({ method: 'GET', headers: { 'x-robot-local-key': f.capability.key } }), res, '/share-retry'), true);
  assert.equal(res.status, 405);
  assert.equal(res.headers.Allow, 'POST');
  assert.equal(calls, 0);
});

test('Missing, wrong, Unicode and malformed capabilities return 403 without invoking retry', async t => {
  let calls = 0;
  const f = fixture(t, async () => { calls++; });
  const wrong = (f.capability.key[0] === '0' ? '1' : '0') + f.capability.key.slice(1);
  for (const key of [undefined, wrong, '', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), '０'.repeat(64), f.capability.key + '\n', f.capability.key + '\r\n', [f.capability.key], 123]) {
    const req = request({ headers: { 'x-robot-local-key': key } }), res = response();
    assert.equal(await f.control.handle(req, res, '/share-retry'), true);
    assert.equal(res.status, 403);
    assert.equal(res.body, 'Forbidden');
    assert.equal(req.resumed, 0);
  }
  assert.equal(calls, 0);
});

test('Valid local capability accepts native and matching-origin requests without returning the key', async t => {
  let calls = 0;
  const f = fixture(t, async () => { calls++; return 'starting'; });
  assert.equal(f.capability.version, 1);
  assert.match(f.capability.key, /^[0-9a-f]{64}$/);
  for (const options of [
    {},
    { headers: { origin: 'http://localhost:3333' } },
    { headers: { host: '127.0.0.1:3333' }, address: '::ffff:127.0.0.1' },
    { headers: { host: '[::1]:3333', origin: 'http://[::1]:3333' }, address: '::1' },
  ]) {
    const req = request(options), res = response();
    req.headers['x-robot-local-key'] = f.capability.key;
    assert.equal(await f.control.handle(req, res, '/share-retry'), true);
    assert.equal(res.status, 202);
    assert.equal(res.headers['Content-Type'], 'application/json');
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.deepEqual(JSON.parse(res.body), { accepted: true, state: 'starting' });
    assert.equal(res.body.includes(f.capability.key), false);
    assert.equal(req.resumed, 1);
  }
  assert.equal(calls, 4);
});

test('Retry rejection returns a generic 503 instead of arbitrary internal details', async t => {
  const internalDetails = 'private test failure: never expose this detail';
  const f = fixture(t, async () => { throw new Error(internalDetails); });
  const res = response();
  assert.equal(await f.control.handle(request({ headers: { 'x-robot-local-key': f.capability.key } }), res, '/share-retry'), true);
  assert.equal(res.status, 503);
  assert.equal(res.body, 'Retry unavailable');
  assert.equal(res.body.includes(internalDetails), false);
  assert.equal(res.body.includes(f.capability.key), false);
});

test('Creating a replacement factory rotates the capability and rejects the previous key', async t => {
  let calls = 0;
  const f = fixture(t);
  const replacement = createLocalControl({ filename: f.filename, port: 3333, retry: async () => { calls++; return 'starting'; } });
  const current = JSON.parse(fs.readFileSync(f.filename, 'utf8'));
  assert.equal(current.version, 1);
  assert.notEqual(current.key, f.capability.key);
  const oldResponse = response();
  await replacement.handle(request({ headers: { 'x-robot-local-key': f.capability.key } }), oldResponse, '/share-retry');
  assert.equal(oldResponse.status, 403);
  const currentResponse = response();
  await replacement.handle(request({ headers: { 'x-robot-local-key': current.key } }), currentResponse, '/share-retry');
  assert.equal(currentResponse.status, 202);
  assert.equal(calls, 1);
  assert.deepEqual(fs.readdirSync(path.dirname(f.filename)), ['control.json']);
});

test('Capability file is private on POSIX', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t);
  assert.equal(fs.statSync(f.filename).mode & 0o777, 0o600);
});
