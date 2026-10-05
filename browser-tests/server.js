// Isolated local fixture. Never creates accounts in the deployment database.
const fs = require('node:fs');
const path = require('node:path');
const { Store, passwordHash } = require('../lib/store');
const { PeerServer } = require('peer');
const root = path.join(__dirname, '..', '.qa'); fs.mkdirSync(root, { recursive: true });
const folder = fs.mkdtempSync(path.join(root, 'run-'));
process.env.DATA_FILE = path.join(folder, 'site.json'); process.env.PORT = '3100';
// Tests must never inherit production relay credentials from a private .env.
process.env.TURN_CREDENTIALS_URL = ''; process.env.TURN_SERVERS = '[]';
const store = new Store(process.env.DATA_FILE);
store.change(d => {
  d.directory = structuredClone(require('../examples/directory.json')); d.directory.people[0].userId = 'staff';
  d.robots.push({ id: 'r1', name: 'ربات آزمون', serial: 'RB-TEST01', location: 'پذیرش', mode: 'welcome', startNodeId: 'reception', active: true });
  for (const role of ['admin', 'staff', 'operator', 'robot']) d.users.push({ id: role, name: role, username: role, password: passwordHash('browser-test-password'), role, active: true, robotId: role === 'robot' ? 'r1' : '' });
});
PeerServer({ host: '127.0.0.1', port: 9101, path: '/peerjs' });
require('../server');
