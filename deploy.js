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
  return execFileSync('git', args, { cwd, stdio: 'inherit' });
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
    if (!/^[A-Za-z0-9-]+$/.test(settings.user) || !/^[A-Za-z0-9._-]+$/.test(settings.repo)) {
      console.log('That username or repository name is not valid.');
      process.exit(1);
    }
    fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  }
  const { user, repo } = settings;
  const site = `https://${user.toLowerCase()}.github.io/${repo}`;

  // --- Relay (TURN) URL (asked while not set)
  let config = fs.readFileSync(CONFIG, 'utf8');
  if (/^\s*turnCredentialsUrl:\s*''/m.test(config)) {
    console.log('\nRelay server (needed when the robot is on a phone hotspot or mobile data).');
    console.log('Paste your Metered "API URL" (https://....metered.live/api/v1/turn/credentials?apiKey=...),');
    const turn = await ask('or press Enter to skip for now: ');
    if (turn) {
      if (!/^https:\/\/[^\s']+$/.test(turn)) {
        console.log('That does not look like a https:// URL. Skipping the relay for now.');
      } else {
        config = config.replace(/^(\s*turnCredentialsUrl:\s*)''/m, `$1'${turn}'`);
      }
    }
  }
  // Invite links from the locally run robot page also point at the hosted user page
  config = config.replace(/^(\s*publicUserPage:\s*)'[^']*'/m, `$1'${site}/user.html'`);
  fs.writeFileSync(CONFIG, config);
  if (rl) rl.close();

  // --- Build and push the site
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'robot-site-'));
  copyDir(PUBLIC, dir);
  fs.writeFileSync(path.join(dir, '.nojekyll'), '');

  console.log(`\nPublishing to https://github.com/${user}/${repo} …`);
  console.log('(The first time, a GitHub sign-in window may open. Sign in, then come back here.)\n');
  try {
    const id = ['-c', `user.name=${user}`, '-c', `user.email=${user}@users.noreply.github.com`];
    git(['init', '-q', '-b', 'gh-pages'], dir);
    git(['add', '-A'], dir);
    git([...id, 'commit', '-q', '-m', 'Publish robot apps'], dir);
    const remote = process.env.DEPLOY_REMOTE || `https://github.com/${user}/${repo}.git`; // override for testing
    git(['push', '-f', remote, 'gh-pages'], dir);
  } catch {
    console.log('\nPublishing failed. Check that the repository exists, is public, and that you signed in as its owner.');
    console.log(`To start over with a different username or repository, delete ${SETTINGS}.`);
    process.exit(1);
  } finally {
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
