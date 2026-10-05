// Local web server for the apps.
//
//   node server.js           serve the pages on http://localhost:3000
//   node server.js --share   also expose the shared API and all app pages
//                            over a temporary HTTPS tunnel
//
// The robot and the user find each other through a public matchmaking
// server (see public/config.js), so they can be on different networks.
// Camera and Web Serial (Arduino) need HTTPS or localhost in a supported
// browser. Permanent Pages frontends can discover this tunnel's current URL.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('./lib/env').loadEnv(path.join(__dirname, '.env'));
const { createService } = require('./lib/service');
const { createLineParser, localhostRunOrigin } = require('./lib/tunnel');
const { createConnectionPublisher } = require('./lib/publish-connection');

const PORT = Number(process.env.PORT) || 3000;
const PERMANENT = (fs.readFileSync(path.join(__dirname, 'public', 'config.js'), 'utf8')
  .match(/^\s*publicUserPage:\s*'([^']+)'/m) || [])[1];
// An explicit --share also exposes the backend needed by a static frontend.
const SHARE = process.argv.includes('--share');
const TUNNEL_PROVIDER = process.env.TUNNEL_PROVIDER || 'cloudflare';
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const ROUTES = { '/': '/index.html', '/robot': '/robot.html', '/user': '/user.html', '/portal': '/portal.html' };

// All product pages are public assets; their actions require authentication.
// Private data, provider credentials and the share-link endpoint stay local.
const PUBLIC_FILES = new Set(['/index.html', '/robot.html', '/robot.js', '/welcome.js', '/user.html', '/user.js', '/common.js', '/config.js', '/style.css', '/product.css', '/platform.js', '/connection.js', '/portal.js', '/portal.html', '/vendor/peerjs.min.js', '/vendor/socket.io.min.js', '/safety.js']);
const connectionPublisher = createConnectionPublisher({ onStatus: message => console.log(message) });

let publicUrl = null;
let shareState = SHARE ? 'starting' : 'off'; // off | starting | ready | error
let closing = false, tunnelProc = null, retryTimer = null, startupTimer = null, failures = 0;
let publishTimer = null;
async function publishConnection(origin, attempt = 0) {
  clearTimeout(publishTimer); publishTimer = null;
  if (closing || publicUrl !== origin || !connectionPublisher.enabled) return;
  const result = await connectionPublisher.publish(origin);
  if (!result.ok && !closing && publicUrl === origin && attempt < 4) {
    publishTimer = setTimeout(() => publishConnection(origin, attempt + 1), Math.min(5000 * 2 ** attempt, 30000));
  }
}

let service;
const server = http.createServer(async (req, res) => {
  if (await service.handle(req, res)) return;
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  const viaTunnel = !!req.headers['cf-ray'] || !!(publicUrl && req.headers.host === new URL(publicUrl).host);

  url = ROUTES[url] || url;

  if (url === '/share-info') {
    if (viaTunnel) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ state: shareState, url: publicUrl }));
  }

  if (viaTunnel && !PUBLIC_FILES.has(url)) { res.writeHead(404); return res.end('Not found'); }

  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    res.end(data);
  });
});
service = createService(server, {
  filename: path.resolve(process.env.DATA_FILE || path.join(__dirname, 'data', 'site.json')),
  origins: (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean),
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\nThe app is already running on this laptop (port ${PORT}). Use the browser tab that opened.\n`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log('\nRobot Telepresence is running. Keep this server and laptop running.\n');
  console.log(`  Robot page: http://localhost:${PORT}/robot`);
  if (PERMANENT) console.log(`  Invite links use your permanent page: ${PERMANENT}`);
  else if (!SHARE) console.log(`  User page:  http://localhost:${PORT}/user`);
  console.log('');
  if (SHARE) startTunnel();
});

// ---------- Temporary public link, no provider account needed ----------

const BIN = path.join(__dirname, 'bin');
const CLOUDFLARED = path.join(BIN, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
const DOWNLOADS = {
  win32: 'cloudflared-windows-amd64.exe',
  linux: 'cloudflared-linux-amd64',
  darwin: 'cloudflared-darwin-amd64.tgz',
};

async function startTunnel() {
  if (TUNNEL_PROVIDER === 'localhost-run') return runTunnel();
  if (TUNNEL_PROVIDER !== 'cloudflare') {
    shareState = 'error';
    console.log('Set TUNNEL_PROVIDER to cloudflare or localhost-run.');
    return;
  }
  try {
    if (!fs.existsSync(CLOUDFLARED)) await downloadCloudflared();
  } catch {
    shareState = 'error';
    console.log('Could not download the tunnel tool. Check the connection or install cloudflared in bin/.');
    return;
  }
  if (!closing) runTunnel();
}

function runTunnel() {
  if (closing || tunnelProc) return;
  shareState = 'starting';
  publicUrl = null;
  console.log('Creating the public link...');
  let command = CLOUDFLARED;
  let args = ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`];
  if (TUNNEL_PROVIDER === 'localhost-run') {
    const nullFile = process.platform === 'win32' ? 'NUL' : '/dev/null';
    const trustDir = path.join(__dirname, 'data');
    try { fs.mkdirSync(trustDir, { recursive: true }); }
    catch { shareState = 'error'; console.log('Could not prepare the private tunnel trust directory.'); return; }
    command = process.platform === 'win32' ? 'ssh.exe' : 'ssh';
    args = ['-F', nullFile, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new',
      '-o', `UserKnownHostsFile="${path.join(trustDir, 'tunnel-known-hosts').replace(/\\/g, '/')}"`, '-o', `GlobalKnownHostsFile=${nullFile}`,
      '-o', 'PubkeyAuthentication=no', '-o', 'PasswordAuthentication=no', '-o', 'KbdInteractiveAuthentication=no',
      '-o', `IdentityFile=${nullFile}`, '-o', 'IdentityAgent=none', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
      '-T', '-R', `80:127.0.0.1:${PORT}`, 'nokey@localhost.run', '--', '--output', 'json'];
  }
  const proc = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  tunnelProc = proc;
  const ready = origin => {
    if (closing || tunnelProc !== proc || proc.killed || (shareState === 'ready' && publicUrl === origin)) return;
    clearTimeout(startupTimer); startupTimer = null;
    publicUrl = origin;
    failures = 0;
    shareState = 'ready';
    console.log(`\n  PUBLIC LINK for users: ${publicUrl}/user`);
    console.log('  Keep this laptop and server running. Invite users from the Robot page.\n');
    void publishConnection(origin);
  };
  if (TUNNEL_PROVIDER === 'localhost-run') {
    const onOutput = createLineParser(line => { const origin = localhostRunOrigin(line); if (origin) ready(origin); });
    proc.stdout.on('data', onOutput);
    // Drain SSH diagnostics, without printing host/IP details or arbitrary output.
    proc.stderr.resume();
  } else {
    let origin = null, registered = false;
    const onOutput = createLineParser(line => {
      const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
      if (match) origin = match[0];
      if (/Registered tunnel connection/i.test(line)) registered = true;
      if (origin && registered) ready(origin);
    });
    proc.stdout.on('data', onOutput);
    proc.stderr.on('data', onOutput);
  }
  startupTimer = setTimeout(() => {
    if (tunnelProc === proc && shareState !== 'ready') {
      shareState = 'error';
      console.log('Public tunnel startup timed out. Check the network or choose the other tunnel provider.');
      proc.kill();
    }
  }, 45000);
  let finished = false;
  const retry = () => {
    if (finished) return;
    finished = true;
    clearTimeout(startupTimer); startupTimer = null;
    if (tunnelProc === proc) tunnelProc = null;
    publicUrl = null;
    if (closing) return;
    shareState = 'error';
    if (++failures >= 5) {
      console.log('Public link stopped after five failed attempts. Check the connection/provider and restart with --share.');
      return;
    }
    const delay = Math.min(1000 * 2 ** (failures - 1), 30000);
    console.log(`Public link disconnected. Retrying in ${delay / 1000} seconds.`);
    retryTimer = setTimeout(() => { retryTimer = null; runTunnel(); }, delay);
  };
  proc.once('error', retry);
  proc.once('close', retry);
}

function stopServer() {
  if (closing) return;
  closing = true;
  clearTimeout(retryTimer); clearTimeout(startupTimer); clearTimeout(publishTimer);
  if (tunnelProc) tunnelProc.kill();
  service.close();
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(0), 1000).unref();
}
process.once('SIGINT', stopServer);
process.once('SIGTERM', stopServer);

function downloadCloudflared() {
  const file = DOWNLOADS[process.platform];
  if (!file || file.endsWith('.tgz')) {
    return Promise.reject(new Error('install cloudflared manually: https://github.com/cloudflare/cloudflared/releases'));
  }
  console.log('Downloading the Cloudflare tunnel tool (one time, about 55 MB)…');
  fs.mkdirSync(BIN, { recursive: true });
  const get = (url, resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return get(res.headers.location, resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const tmp = CLOUDFLARED + '.part';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => out.close(() => {
        fs.renameSync(tmp, CLOUDFLARED);
        if (process.platform !== 'win32') fs.chmodSync(CLOUDFLARED, 0o755);
        resolve();
      }));
      out.on('error', reject);
    }).on('error', reject);
  };
  return new Promise((resolve, reject) =>
    get(`https://github.com/cloudflare/cloudflared/releases/latest/download/${file}`, resolve, reject));
}
