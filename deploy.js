// Publishes both apps to GitHub Pages:
//   Robot page (open on the robot laptop):  https://<user>.github.io/<repo>/robot.html
//   Invite links for users:                 https://<user>.github.io/<repo>/user.html?serial=RB-XXXX
//
// Run it with deploy-github.bat. Run it again after any change in public/.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CONFIG = path.join(PUBLIC, 'config.js');
const SETTINGS = path.join(ROOT, 'deploy.json');

// One reader for all questions; answers typed ahead (or piped) are queued
let rl = null;
const pending = [];
const answers = [];
function ask(q) {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on('line', (line) => (pending.length ? pending.shift()(line.trim()) : answers.push(line.trim())));
    rl.on('close', () => { while (pending.length) pending.shift()(''); });
  }
  process.stdout.write(q);
  return new Promise((resolve) => (answers.length ? resolve(answers.shift()) : pending.push(resolve)));
}

function git(args, cwd) {
  return execFileSync('git', ['-c', `safe.directory=${cwd}`, ...args], { cwd, stdio: 'inherit', windowsHide: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

(async () => {
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch {}

  // --- GitHub account and repository (asked once)
  if (!settings.user) {
    console.log('\nPublish the robot apps on GitHub Pages (free)\n');
    console.log('Before continuing, you need:');
    console.log('  - a GitHub account           https://github.com/signup');
    console.log('  - an EMPTY PUBLIC repository https://github.com/new  (for example "robot-telepresence", no README)\n');
    settings.user = await ask('Your GitHub username: ');
    settings.repo = (await ask('Repository name [robot-telepresence]: ')) || 'robot-telepresence';
    // A relay URL pasted here one question early: use the default name and keep the URL for the relay question
    if (/^https?:\/\//.test(settings.repo)) {
      answers.unshift(settings.repo);
      settings.repo = 'robot-telepresence';
    }
    if (!/^[A-Za-z0-9-]+$/.test(settings.user) || !/^[A-Za-z0-9._-]+$/.test(settings.repo)) {
      console.log('That username or repository name is not valid.');
      process.exit(1);
    }
    fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  }
  const { user, repo } = settings;
  if (!/^[A-Za-z0-9-]+$/.test(user) || !/^[A-Za-z0-9._-]+$/.test(repo)) throw new Error('Invalid deployment settings');
  const site = `https://${user.toLowerCase()}.github.io/${repo}`;

  // A static host cannot execute the authenticated API or persist visits.
  let config = fs.readFileSync(CONFIG, 'utf8');
  const configured = (config.match(/^\s*apiBase:\s*'([^']*)'/m) || [])[1];
  if (!configured && !settings.backend) settings.backend = await ask('Public HTTPS backend URL (no API keys; required): ');
  const backend = configured || settings.backend;
  let backendOrigin;
  try { backendOrigin = new URL(backend); } catch {}
  if (!backend || !backendOrigin || backendOrigin.protocol !== 'https:' || backendOrigin.origin !== backend.replace(/\/$/, '')) {
    console.error('Deploy the shared server first and supply its HTTPS URL. See README.md. No site was published.');
    process.exit(1);
  }
  try {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    let response;
    try { response = await fetch(backend.replace(/\/$/, '') + '/api/health', { headers: { Origin: new URL(site).origin }, signal: controller.signal }); } finally { clearTimeout(timer); }
    const health = await response.json();
    if (!response.ok || health.version !== 2 || !health.initialized || response.headers.get('access-control-allow-origin') !== new URL(site).origin) throw new Error('Backend not initialized or Pages origin not allowed');
  } catch (e) { console.error('Backend is not ready. Verify HTTPS, setup and ALLOWED_ORIGINS. No site was published.'); process.exit(1); }
  const discovery = settings.discoveryUrl || '';
  if (discovery && discovery !== `https://raw.githubusercontent.com/${user}/${repo}/connection/connection.json`) {
    console.error('Discovery must use the connection branch of this repository. No site was published.'); process.exit(1);
  }
  config = config.replace(/^(\s*apiBase:\s*)'[^']*'/m, (_, prefix) => prefix + "'" + (discovery ? '' : backend.replace(/\/$/, '')) + "'");
  config = config.replace(/^(\s*apiDiscoveryUrl:\s*)'[^']*'/m, (_, prefix) => prefix + "'" + discovery + "'");
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  config = config.replace(/^(\s*publicUserPage:\s*)'[^']*'/m, `$1'${site}/user.html'`);
  // Configuration belongs to the copied Pages build. Leave local same-origin
  // settings untouched so deploying cannot disconnect the robot laptop.
  if (rl) rl.close();

  // --- Build and push the site
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-site-'));

  console.log(`\nPublishing to https://github.com/${user}/${repo} …`);
  console.log('(The first time, a GitHub sign-in window may open. Sign in, then come back here.)\n');
  try {
    const id = ['-c', `user.name=${user}`, '-c', `user.email=${user}@users.noreply.github.com`];
    const remote = process.env.DEPLOY_REMOTE || `https://github.com/${user}/${repo}.git`;
    const existing = execFileSync('git', ['ls-remote', '--heads', remote, 'gh-pages'], { encoding: 'utf8' }).trim();
    if (existing) git(['clone', '-q', '--single-branch', '--branch', 'gh-pages', remote, dir], ROOT);
    else git(['init', '-q', '-b', 'gh-pages'], dir);
    copyDir(PUBLIC, dir);
    fs.writeFileSync(path.join(dir, 'config.js'), config);
    fs.writeFileSync(path.join(dir, '.nojekyll'), '');
    git(['add', '-A'], dir);
    const changes = execFileSync('git', ['-c', `safe.directory=${dir}`, 'status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).trim();
    if (changes) git([...id, 'commit', '-q', '-m', 'Publish robot platform'], dir);
    git(['push', remote, 'gh-pages'], dir);
  } catch {
    console.log('\nPublishing failed. Check that the repository exists, is public, and that you signed in as its owner.');
    console.log(`To start over with a different username or repository, delete ${SETTINGS}.`);
    process.exitCode = 1;
    return;
  } finally {
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(dir).startsWith('robot-site-')) throw new Error('Unexpected cleanup path');
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log('\n==============================================================');
  console.log(' Published.');
  console.log('');
  console.log(' ROBOT PAGE (open on the robot laptop, then bookmark it):');
  console.log(`   ${site}/robot.html`);
  console.log('');
  console.log(' Invite links for users are shown on the robot page.');
  console.log('==============================================================\n');
  console.log('FIRST TIME ONLY: turn the site on. Open');
  console.log(`   https://github.com/${user}/${repo}/settings/pages`);
  console.log('set "Branch" to gh-pages and "/ (root)", press Save, and wait about a minute.\n');
})();
