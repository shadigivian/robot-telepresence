'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const REPOSITORY = 'https://github.com/shadigivian/robot-telepresence.git';
const BRANCH = 'connection';

function validOrigin(value) {
  if (typeof value !== 'string') return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  return value === url.origin && url.protocol === 'https:' && !url.username && !url.password &&
    !url.port && !url.search && !url.hash && url.pathname === '/' &&
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:lhr\.life|trycloudflare\.com)$/.test(url.hostname);
}

function executeGit(args, options) {
  return new Promise((resolve, reject) => {
    execFile('git', args, options, (error, stdout) => error ? reject(error) : resolve(stdout));
  });
}

// The caller prepares an isolated clone on `connection`. This helper never
// initializes repositories, changes branches, fetches, merges or force-pushes.
function createConnectionPublisher({
  directory = process.env.CONNECTION_PUBLISH_DIR,
  repository = process.env.CONNECTION_PUBLISH_REPOSITORY,
  branch = BRANCH,
  runGit = executeGit,
  now = () => new Date(),
  onStatus = () => {},
} = {}) {
  const enabled = typeof directory === 'string' && path.isAbsolute(directory) && repository === REPOSITORY && branch === BRANCH;
  let pending = null, running = false, lastPublished = null;
  const notify = message => { try { onStatus(message); } catch {} };

  async function git(args) {
    const output = await runGit(['-c', `safe.directory=${directory}`, ...args], {
      cwd: directory, shell: false, windowsHide: true, encoding: 'utf8',
      timeout: 20000, maxBuffer: 128 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    });
    return typeof output === 'string' ? output : (output && output.stdout) || '';
  }

  async function update(origin) {
    try {
      const top = (await git(['rev-parse', '--show-toplevel'])).trim();
      if (!top || path.relative(path.resolve(directory), path.resolve(top)) !== '') throw new Error('Wrong worktree');
      if ((await git(['symbolic-ref', '--short', 'HEAD'])).trim() !== BRANCH) throw new Error('Wrong branch');
      for (const args of [['remote', 'get-url', '--all', 'origin'], ['remote', 'get-url', '--push', '--all', 'origin']]) {
        const urls = (await git(args)).trim().split(/\r?\n/);
        if (urls.length !== 1 || urls[0] !== REPOSITORY) throw new Error('Wrong remote');
      }
      if ((await git(['status', '--porcelain=v1', '--untracked-files=all'])).trim()) throw new Error('Worktree is not clean');

      const filename = path.join(directory, 'connection.json');
      let current = null;
      try {
        if (!fs.lstatSync(filename).isFile() || fs.lstatSync(filename).isSymbolicLink()) throw new Error('Invalid connection file');
        try { current = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (error) { if (error.code) throw error; }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const keys = current && typeof current === 'object' ? Object.keys(current).sort().join(',') : '';
      const unchanged = keys === 'apiBase,updatedAt,version' && current.version === 1 && current.apiBase === origin &&
        typeof current.updatedAt === 'string' && Number.isFinite(Date.parse(current.updatedAt));
      if (!unchanged) {
        const value = { version: 1, apiBase: origin, updatedAt: now().toISOString() };
        fs.writeFileSync(filename, JSON.stringify(value, null, 2) + '\n', { mode: 0o644 });
        await git(['add', '--', 'connection.json']);
        await git(['-c', 'user.name=Robot connection publisher', '-c', 'user.email=codex@users.noreply.github.com',
          'commit', '--only', '-m', 'Update public backend connection', '--', 'connection.json']);
      }
      // A successful push (including an up-to-date result) is required before
      // reporting ready. A stale branch fails safely without resetting work.
      await git(['push', 'origin', `HEAD:refs/heads/${BRANCH}`]);
      notify(unchanged ? 'Public backend connection is current.' : 'Public backend connection updated.');
      return { ok: true, apiBase: origin, changed: !unchanged };
    } catch {
      notify('Could not publish the public backend connection. Check the isolated connection branch and Git access.');
      return { ok: false, reason: 'publish-failed' };
    }
  }

  async function drain() {
    while (pending) {
      const batch = pending; pending = null;
      const result = batch.origin === lastPublished ? { ok: true, apiBase: batch.origin, changed: false } : await update(batch.origin);
      // A failed push may still have reached the remote before the connection
      // failed. Do not deduplicate against an older successful origin until a
      // new push confirms the desired public state.
      lastPublished = result.ok ? batch.origin : null;
      for (const waiter of batch.waiters) waiter.resolve({ ...result, superseded: waiter.origin !== batch.origin });
    }
    running = false;
  }

  function publish(origin) {
    if (!enabled) return Promise.resolve({ ok: false, reason: 'disabled' });
    if (!validOrigin(origin)) return Promise.resolve({ ok: false, reason: 'invalid-origin' });
    if (!running && origin === lastPublished) return Promise.resolve({ ok: true, apiBase: origin, changed: false, superseded: false });
    return new Promise(resolve => {
      if (pending) { pending.origin = origin; pending.waiters.push({ origin, resolve }); }
      else pending = { origin, waiters: [{ origin, resolve }] };
      if (!running) { running = true; void drain(); }
    });
  }

  return { enabled, publish };
}

module.exports = { createConnectionPublisher, validOrigin };
