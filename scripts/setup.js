'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
require('../lib/env').loadEnv(path.join(__dirname, '..', '.env'));
const { Store, passwordHash } = require('../lib/store');
const { validateDirectory } = require('../lib/domain');
const store = new Store(path.resolve(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'site.json')));
if (store.data.users.length) { console.error('Already initialized. Manage users from portal.html.'); process.exit(1); }
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) { console.error('Set ADMIN_PASSWORD to at least 12 characters before running npm run setup. No default password is installed.'); process.exit(1); }
const username = process.env.ADMIN_USERNAME || 'admin';
if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) throw new Error('Invalid ADMIN_USERNAME');
store.change(d => {
  d.users.push({ id: crypto.randomUUID(), username, name: 'مدیر سامانه', role: 'admin', active: true, robotId: '', password: passwordHash(password) });
  if (process.argv.includes('--demo')) {
    d.directory = validateDirectory(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'examples', 'directory.json'), 'utf8')));
    d.robots.push({ id: 'robot-1', name: 'ربات آزمایشی', serial: 'RB-DEMO01', location: 'پذیرش آزمایشی', mode: 'welcome', startNodeId: 'reception', active: true });
  }
});
console.log('Initialized. Open portal.html to add rooms, users and robots. Keep data/site.json private and backed up.');
