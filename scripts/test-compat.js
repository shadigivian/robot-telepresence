'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');

if (!fs.existsSync(cli)) {
  console.error('Playwright is missing. Run npm ci first.');
  process.exit(1);
}

// Each CLI invocation owns a fresh local fixture, including its real login
// rate limiter. Do not weaken production limits to combine browser engines.
for (const browser of ['chromium', 'firefox', 'webkit']) {
  console.log(`Running ${browser} compatibility checks with an isolated backend.`);
  const result = spawnSync(process.execPath, [cli, 'test', '--config=playwright.compat.config.js', `--project=${browser}`], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    console.error(`${browser} compatibility checks failed; remaining engines were not started.`);
    process.exit(result.status || 1);
  }
}
console.log('All three browser engines passed compatibility checks.');
