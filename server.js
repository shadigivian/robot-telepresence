// Local web server for the apps.
//
//   node server.js           serve the pages on http://localhost:3000
//   node server.js --share   also publish the USER page on a public
//                            https://....trycloudflare.com link (robot laptop)
//
// The robot and the user find each other through a public matchmaking
// server (see public/config.js), so they can be on different networks.
// Opening the robot page from http://localhost matters: browsers only allow
// the camera and Web Serial (Arduino) on secure pages, and localhost is one.
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createService } = require('./lib/service');

const PORT = Number(process.env.PORT) || 3000;
// A permanent user page (config.js: publicUserPage) makes the tunnel unnecessary
const PERMANENT = (fs.readFileSync(path.join(__dirname, 'public', 'config.js'), 'utf8')
  .match(/^\s*publicUserPage:\s*'([^']+)'/m) || [])[1];
const SHARE = process.argv.includes('--share') && !PERMANENT;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const ROUTES = { '/': '/index.html', '/robot': '/robot.html', '/user': '/user.html' };

// Only these files are reachable through the public link. The robot page
// and the share-link endpoint stay private to this laptop.
const PUBLIC_FILES = new Set(['/index.html', '/user.html', '/user.js', '/common.js', '/config.js', '/style.css', '/product.css', '/platform.js', '/portal.js', '/portal.html', '/vendor/peerjs.min.js', '/vendor/socket.io.min.js', '/safety.js']);

let publicUrl = null;
let shareState = SHARE ? 'starting' : 'off'; // off | starting | ready | blocked | error

let service;
const server = http.createServer(async (req, res) => {
  if (await service.handle(req, res)) return;
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  const viaTunnel = !!req.headers['cf-ray'];

  if (viaTunnel && url === '/') url = '/user';
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
  console.log('\nRobot Telepresence is running. Keep this window open.\n');
  console.log(`  Robot page: http://localhost:${PORT}/robot`);
  if (PERMANENT) console.log(`  Invite links use your permanent page: ${PERMANENT}`);
  else if (!SHARE) console.log(`  User page:  http://localhost:${PORT}/user`);
  console.log('');
  if (SHARE) startTunnel();
});

// ---------- Public link (Cloudflare quick tunnel, no account needed) ----------

const BIN = path.join(__dirname, 'bin');
const CLOUDFLARED = path.join(BIN, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
const DOWNLOADS = {
  win32: 'cloudflared-windows-amd64.exe',
  linux: 'cloudflared-linux-amd64',
  darwin: 'cloudflared-darwin-amd64.tgz',
};

async function startTunnel() {
  try {
    if (!fs.existsSync(CLOUDFLARED)) await downloadCloudflared();
  } catch (err) {
    shareState = 'error';
    console.log(`Could not download the tunnel tool: ${err.message}`);
    return;
  }
  runTunnel();
}

function runTunnel() {
  shareState = 'starting';
  publicUrl = null;
  console.log('Creating the public link…');
  const proc = spawn(CLOUDFLARED, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], { windowsHide: true });

  // The address is printed first, but it only works once a tunnel
  // connection is registered. Some networks (often phone hotspots) block
  // the port the tunnel needs (7844), and then it never registers.
  const blockedTimer = setTimeout(() => {
    if (shareState !== 'ready') {
      shareState = 'blocked';
      console.log('\n  This internet connection blocks the automatic public link (outbound port 7844).');
      console.log('  Use a permanent link instead: run deploy-github.bat once (see README).\n');
    }
  }, 45000);

  const onOutput = (chunk) => {
    const text = String(chunk);
    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) publicUrl = m[0];
    if (/Registered tunnel connection/i.test(text) && publicUrl && shareState !== 'ready') {
      clearTimeout(blockedTimer);
      shareState = 'ready';
      console.log(`\n  PUBLIC LINK for users: ${publicUrl}/user`);
      console.log('  The Robot page shows a ready-to-send link with the serial number.\n');
    }
  };
  proc.stdout.on('data', onOutput);
  proc.stderr.on('data', onOutput);

  proc.on('exit', (code) => {
    clearTimeout(blockedTimer);
    shareState = 'starting';
    publicUrl = null;
    console.log(`Public link stopped (code ${code}). Creating a new one in 5 s…`);
    setTimeout(runTunnel, 5000);
  });

  const stop = () => { proc.removeAllListeners('exit'); proc.kill(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

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
