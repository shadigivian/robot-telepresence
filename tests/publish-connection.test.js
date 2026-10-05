'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createConnectionPublisher, validOrigin } = require('../lib/publish-connection');
const repository = 'https://github.com/shadigivian/robot-telepresence.git';

function fixture(t, overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-connection-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const calls = [], pushes = [], statuses = [];
  const runGit = async (args, options) => {
    calls.push(args);
    assert.equal(args[0], '-c'); assert.equal(args[1], `safe.directory=${directory}`);
    assert.equal(options.cwd, directory); assert.equal(options.shell, false); assert.equal(options.timeout, 20000);
    assert.equal(options.env.GIT_TERMINAL_PROMPT, '0'); assert.equal(options.env.GCM_INTERACTIVE, 'Never');
    const command = args.slice(2);
    if (overrides.runner) return overrides.runner(command, { directory, pushes });
    if (command[0] === 'rev-parse') return directory + '\n';
    if (command[0] === 'symbolic-ref') return (overrides.branch || 'connection') + '\n';
    if (command[0] === 'remote') return ((command.includes('--push') && overrides.pushRemote) || overrides.remote || repository) + '\n';
    if (command[0] === 'status') return overrides.status || '';
    if (command[0] === 'push') {
      assert.deepEqual(command, ['push', 'origin', 'HEAD:refs/heads/connection']);
      if (overrides.pushError) throw new Error('private Git diagnostic: fake-token');
      pushes.push(JSON.parse(fs.readFileSync(path.join(directory, 'connection.json'), 'utf8')));
    }
    return '';
  };
  const publisher = createConnectionPublisher({ directory, repository, runGit, now: () => new Date('2026-10-05T12:00:00.000Z'), onStatus: value => statuses.push(value) });
  return { directory, publisher, calls, pushes, statuses };
}

test('Connection publishing rejects invalid configuration and untrusted origins without invoking Git', async () => {
  let invoked = false;
  const runGit = async () => { invoked = true; };
  for (const options of [{}, { directory: 'relative', repository }, { directory: path.resolve(os.tmpdir()), repository: 'https://other.test/repo.git' },
    { directory: path.resolve(os.tmpdir()), repository, branch: 'main' }, { directory: path.resolve(os.tmpdir()), repository, branch: 'gh-pages' }]) {
    const p = createConnectionPublisher({ ...options, runGit });
    assert.equal(p.enabled, false);
    assert.deepEqual(await p.publish('https://sample.lhr.life'), { ok: false, reason: 'disabled' });
  }
  const p = createConnectionPublisher({ directory: path.resolve(os.tmpdir()), repository, runGit });
  for (const origin of ['http://sample.lhr.life', 'https://sample.lhr.life.evil.test', 'https://example.test',
    'https://person:password@sample.lhr.life', 'https://sample.lhr.life:443', 'https://sample.lhr.life/',
    'https://sample.lhr.life/path', 'https://sample.lhr.life?secret=value', 'https://sample.lhr.life#fragment']) {
    assert.equal(validOrigin(origin), false);
    assert.deepEqual(await p.publish(origin), { ok: false, reason: 'invalid-origin' });
  }
  assert.equal(invoked, false);
  assert.equal(validOrigin('https://sample.lhr.life'), true);
  assert.equal(validOrigin('https://sample.trycloudflare.com'), true);
});

test('Wrong branch, remote or dirty worktree cannot write or publish the public connection', async t => {
  for (const override of [{ branch: 'main' }, { remote: 'https://other.test/repo.git' },
    { pushRemote: 'https://other.test/repo.git' }, { remote: repository + '\nhttps://other.test/repo.git' }, { status: ' M unrelated.txt\n' }]) {
    const f = fixture(t, override);
    assert.deepEqual(await f.publisher.publish('https://sample.lhr.life'), { ok: false, reason: 'publish-failed', superseded: false });
    assert.equal(fs.existsSync(path.join(f.directory, 'connection.json')), false);
    assert.equal(f.pushes.length, 0);
    assert.equal(f.calls.some(args => args.includes('add') || args.includes('commit') || args.includes('push')), false);
  }
});

test('Publisher writes only canonical public metadata, scopes commit and deduplicates pushed origins', async t => {
  const f = fixture(t);
  const result = await f.publisher.publish('https://sample.lhr.life');
  assert.equal(result.ok, true); assert.equal(result.changed, true);
  assert.deepEqual(fs.readdirSync(f.directory), ['connection.json']);
  assert.deepEqual(f.pushes[0], { version: 1, apiBase: 'https://sample.lhr.life', updatedAt: '2026-10-05T12:00:00.000Z' });
  const commit = f.calls.find(args => args.includes('commit'));
  assert.ok(commit.includes('--only')); assert.deepEqual(commit.slice(-2), ['--', 'connection.json']);
  const count = f.calls.length;
  assert.equal((await f.publisher.publish('https://sample.lhr.life')).changed, false);
  assert.equal(f.calls.length, count);
});

test('Concurrent updates serialize Git work and publish only the latest queued origin', async t => {
  let resumeFirst, firstStarted;
  const waitForFirst = new Promise(resolve => { firstStarted = resolve; });
  const paused = new Promise(resolve => { resumeFirst = resolve; });
  let first = true, active = 0, peak = 0;
  const f = fixture(t, { runner: async (command, state) => {
    active++; peak = Math.max(peak, active);
    try {
      if (command[0] === 'rev-parse') {
        if (first) { first = false; firstStarted(); await paused; }
        return state.directory;
      }
      if (command[0] === 'symbolic-ref') return 'connection';
      if (command[0] === 'remote') return repository;
      if (command[0] === 'push') state.pushes.push(JSON.parse(fs.readFileSync(path.join(state.directory, 'connection.json'), 'utf8')));
      return '';
    } finally { active--; }
  } });
  const a = f.publisher.publish('https://first.lhr.life');
  await waitForFirst;
  const b = f.publisher.publish('https://second.lhr.life');
  const c = f.publisher.publish('https://latest.trycloudflare.com');
  resumeFirst();
  const results = await Promise.all([a, b, c]);
  assert.equal(peak, 1);
  assert.deepEqual(f.pushes.map(p => p.apiBase), ['https://first.lhr.life', 'https://latest.trycloudflare.com']);
  assert.equal(results[1].superseded, true); assert.equal(results[1].apiBase, 'https://latest.trycloudflare.com');
  assert.equal(results[2].superseded, false);
});

test('Rejected push never reports ready or exposes raw credential diagnostics', async t => {
  const f = fixture(t, { pushError: true });
  const result = await f.publisher.publish('https://sample.lhr.life');
  assert.equal(result.ok, false); assert.equal(f.pushes.length, 0);
  assert.equal(JSON.stringify(result).includes('fake-token'), false);
  assert.equal(f.statuses.join('\n').includes('fake-token'), false);
  assert.equal(f.statuses.some(message => message.includes('updated.')), false);
});

test('A committed update recovers after a transient push failure without resetting or recommitting', async t => {
  let pushes = 0, commits = 0;
  const f = fixture(t, { runner: async (command, state) => {
    if (command[0] === 'rev-parse') return state.directory;
    if (command[0] === 'symbolic-ref') return 'connection';
    if (command[0] === 'remote') return repository;
    if (command.includes('commit')) commits++;
    if (command[0] === 'push') {
      if (++pushes === 1) throw new Error('Transient transport error');
      state.pushes.push(JSON.parse(fs.readFileSync(path.join(state.directory, 'connection.json'), 'utf8')));
    }
    // A successful commit leaves this isolated worktree clean even if push fails.
    return '';
  } });
  assert.equal((await f.publisher.publish('https://sample.lhr.life')).ok, false);
  const retried = await f.publisher.publish('https://sample.lhr.life');
  assert.equal(retried.ok, true); assert.equal(retried.changed, false);
  assert.equal(commits, 1); assert.equal(pushes, 2);
  assert.equal((await f.publisher.publish('https://next.lhr.life')).ok, true);
  assert.equal(commits, 2); assert.equal(pushes, 3);
  assert.equal(f.calls.some(args => args.includes('reset') || args.includes('merge') || args.includes('--force')), false);
});

test('An ambiguous failed push invalidates the old success cache before restoring an older origin', async t => {
  let remoteOrigin = '', pushes = 0;
  const f = fixture(t, { runner: async (command, state) => {
    if (command[0] === 'rev-parse') return state.directory;
    if (command[0] === 'symbolic-ref') return 'connection';
    if (command[0] === 'remote') return repository;
    if (command[0] === 'push') {
      pushes++;
      remoteOrigin = JSON.parse(fs.readFileSync(path.join(state.directory, 'connection.json'), 'utf8')).apiBase;
      // Simulate acceptance at GitHub followed by an interrupted response.
      if (pushes === 2) throw new Error('Response interrupted');
    }
    return '';
  } });
  assert.equal((await f.publisher.publish('https://first.lhr.life')).ok, true);
  assert.equal((await f.publisher.publish('https://second.lhr.life')).ok, false);
  assert.equal(remoteOrigin, 'https://second.lhr.life');
  const restored = await f.publisher.publish('https://first.lhr.life');
  assert.equal(restored.ok, true); assert.equal(restored.changed, true);
  assert.equal(pushes, 3); assert.equal(remoteOrigin, 'https://first.lhr.life');
});
