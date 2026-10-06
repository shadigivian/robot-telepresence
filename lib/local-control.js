'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');

// Native launcher capability. This key is never served to browser clients.
function createLocalControl({ filename, port, retry }) {
  const key = randomBytes(32).toString('hex');
  const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = filename + '.' + randomBytes(8).toString('hex') + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify({ version: 1, key }), { mode: 0o600, flag: 'wx' });
  fs.renameSync(temporary, filename);
  async function handle(req, res, pathname) {
    if (pathname !== '/share-retry') return false;
    const host = String(req.headers.host || '').toLowerCase();
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const origin = req.headers.origin;
    if (!local || !hosts.has(host) || (origin && origin !== `http://${host}`) || req.headers['cf-ray']) {
      res.writeHead(404); res.end('Not found'); return true;
    }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(); return true; }
    const supplied = req.headers['x-robot-local-key'];
    if (typeof supplied !== 'string' || supplied.length !== 64 || !/^[0-9a-f]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(key))) {
      res.writeHead(403); res.end('Forbidden'); return true;
    }
    req.resume();
    try {
      const state = await retry();
      res.writeHead(202, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ accepted: true, state }));
    } catch { res.writeHead(503); res.end('Retry unavailable'); }
    return true;
  }
  return { handle };
}
module.exports = { createLocalControl };
