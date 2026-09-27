// User side: finds the robot by serial number, shows its camera and sends
// movement commands. Once connected, the session stays up until the user
// presses hang up: any drop triggers automatic reconnection.

const els = {
  join: $('#join'),
  joinForm: $('#joinForm'),
  serialInput: $('#serialInput'),
  joinError: $('#joinError'),
  joinBtn: $('#joinBtn'),
  call: $('#call'),
  remote: $('#remote'),
  waiting: $('#waiting'),
  waitingText: $('#waitingText'),
  robotName: $('#robotName'),
  linkStatus: $('#linkStatus'),
  espPill: $('#espPill'),
  routePill: $('#routePill'),
  rttPill: $('#rttPill'),
  hudCmd: $('#hudCmd'),
  toast: $('#toast'),
  hangupBtn: $('#hangupBtn'),
  fullBtn: $('#fullBtn'),
  speed: $('#speed'),
  speedOut: $('#speedOut'),
};

let peer = null;
let conn = null;
let call = null;
let serial = '';
let wantConnected = false;
let everConnected = false;  // has the link been up at least once this session?
let linkUp = false;
let lastHeard = 0;
let attempt = 0;
let retryTimer = null;
let openTimer = null;

const pad = createDpad($('#dpad'), sendCommand);
pad.setEnabled(false);
keepAwake();

// A stable id for this tab, so the robot recognises us when we reconnect
function userPeerId(fresh = false) {
  let id = null;
  try { id = sessionStorage.getItem('userPeerId'); } catch {}
  if (!id || fresh) {
    id = `${CONFIG.idPrefix}user-${Math.random().toString(36).slice(2, 10)}`;
    try { sessionStorage.setItem('userPeerId', id); } catch {}
  }
  return id;
}

// ---------- Join / hang up ----------

const params = new URLSearchParams(location.search);
try { els.serialInput.value = params.get('serial') || localStorage.getItem('lastRobot') || ''; } catch {}

els.joinForm.onsubmit = (e) => {
  e.preventDefault();
  serial = normalizeSerial(els.serialInput.value);
  if (!isValidSerial(serial)) {
    showJoinError('That does not look like a serial number. Copy it exactly as shown on the robot screen.');
    return;
  }
  try { localStorage.setItem('lastRobot', serial); } catch {}
  showJoinError(null);
  els.joinBtn.disabled = true;
  els.joinBtn.textContent = 'Finding robot…';
  wantConnected = true;
  everConnected = false;
  attempt = 0;
  connect();
};

// Opened from an invite link (…/user?serial=RB-XXXX): connect right away
const invited = normalizeSerial(params.get('serial'));
if (isValidSerial(invited)) {
  $('#joinTitle').textContent = `Connecting to robot ${invited}`;
  $('#joinHint').textContent = 'You were invited to drive this robot.';
  setTimeout(() => els.joinForm.requestSubmit(), 0);
}

function showJoinError(text) {
  els.joinError.hidden = !text;
  els.joinError.textContent = text || '';
}

// Ends the session. Only called by hang up or a problem the user must fix.
function hangUp(error) {
  wantConnected = false;
  clearTimeout(retryTimer);
  clearTimeout(openTimer);
  sendCommand('S');
  closeLink();
  if (peer) { peer.destroy(); peer = null; }
  els.remote.srcObject = null;
  els.rttPill.hidden = true;
  els.espPill.hidden = true;
  els.routePill.hidden = true;
  showCmd('S');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  els.call.hidden = true;
  els.join.hidden = false;
  els.joinBtn.disabled = false;
  els.joinBtn.textContent = 'Connect';
  showJoinError(error);
}

els.hangupBtn.onclick = () => {
  if (conn && conn.open) conn.send({ t: 'cmd', c: 'S' });
  setTimeout(() => hangUp(), 100);
};
els.fullBtn.onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else els.call.requestFullscreen().catch(() => {});
};

// ---------- Connecting ----------

function connect() {
  if (!wantConnected) return;
  clearTimeout(retryTimer);

  // 1. Make sure we are registered with the matchmaking server
  if (!peer || peer.destroyed) {
    startPeer();
    return; // continues in peer 'open'
  }
  if (peer.disconnected) {
    try { peer.reconnect(); } catch { startPeer(); }
    return;
  }

  // 2. Open the control channel to the robot; the robot then calls us with video
  attempt++;
  closeLink();
  const c = peer.connect(robotPeerId(serial), { serialization: 'json', reliable: true });
  conn = c;

  clearTimeout(openTimer);
  openTimer = setTimeout(() => {
    if (c !== conn || c.open) return;
    // The robot was found but no link came up: without a relay, retrying won't help
    if (!everConnected && !hasRelay()) hangUp(NO_PATH_HELP);
    else linkDown(hasRelay() ? 'The robot did not answer in time.' : NO_PATH_HELP);
  }, 15000);

  // ICE failure = no network path between the laptops
  if (c.peerConnection) {
    c.peerConnection.addEventListener('iceconnectionstatechange', () => {
      if (c !== conn || c.peerConnection.iceConnectionState !== 'failed') return;
      if (!everConnected && !hasRelay()) hangUp(NO_PATH_HELP);
      else linkDown(hasRelay() ? 'No network path to the robot, even through the relay.' : NO_PATH_HELP);
    });
  }

  c.on('open', () => {
    if (c !== conn) return;
    clearTimeout(openTimer);
    linkUp = true;
    lastHeard = Date.now();
    attempt = 0;
    if (!everConnected) enterCall();
    everConnected = true;
    pad.setEnabled(true);
    setStatus(els.linkStatus, 'Connected', 'ok');
    if (!els.remote.srcObject || els.remote.paused) showOverlay('Waiting for video…');
  });

  c.on('data', (msg) => {
    if (c !== conn) return;
    lastHeard = Date.now();
    onRobotMessage(msg);
  });

  c.on('close', () => {
    if (c === conn) linkDown('Connection to the robot closed.');
  });
  c.on('error', (err) => console.warn('link error', err));
}

async function startPeer() {
  await iceReady;
  if (peer) peer.destroy();
  const p = createPeer(userPeerId());
  peer = p;

  // Also fires after a matchmaking reconnect; only dial if the link is down
  p.on('open', () => { if (p === peer && !linkUp) connect(); });

  // The robot calls us with its video once the control channel is open
  p.on('call', (incoming) => {
    if (p !== peer) return;
    if (call) call.close();
    call = incoming;
    incoming.answer(); // receive only, we send no camera
    incoming.on('stream', (stream) => {
      if (incoming !== call) return;
      els.remote.srcObject = stream;
      els.remote.play().catch(() => {});
    });
    incoming.peerConnection.addEventListener('connectionstatechange', () => {
      if (incoming !== call) return;
      if (incoming.peerConnection.connectionState === 'connected') showRoute(incoming.peerConnection);
    });
  });

  p.on('disconnected', () => {
    // Lost the matchmaking server. The live link to the robot is unaffected;
    // reconnect quietly so we can redial later if needed.
    if (p !== peer || !wantConnected) return;
    setTimeout(() => {
      if (p === peer && p.disconnected && !p.destroyed) {
        try { p.reconnect(); } catch {}
      }
    }, 2000);
  });

  p.on('error', (err) => {
    if (p !== peer || !wantConnected) return;
    switch (err.type) {
      case 'peer-unavailable':
        if (!everConnected) {
          hangUp(`No robot with serial ${serial} is online. Check the number, and check that the robot app shows "Online".`);
        } else {
          linkDown('The robot is offline. Waiting for it to come back…');
        }
        break;
      case 'unavailable-id':
        userPeerId(true); // our old id is still registered; take a new one
        peer = null;
        scheduleRetry();
        break;
      default:
        if (!linkUp) linkDown(`Network problem (${err.type}). Retrying…`);
    }
  });
}

function closeLink() {
  linkUp = false;
  pad.setEnabled(false);
  const c = conn;
  const k = call;
  conn = null;
  call = null;
  if (c) c.close();
  if (k) k.close();
}

// Called whenever the link is lost. Keeps retrying until the user hangs up.
function linkDown(reason) {
  if (!wantConnected) return;
  closeLink();
  showCmd('S');
  if (!everConnected && attempt >= 4) {
    hangUp(`Could not connect to robot ${serial}. ${reason}`);
    return;
  }
  setStatus(els.linkStatus, 'Reconnecting…', 'wait');
  els.rttPill.hidden = true;
  showOverlay(`${reason}<br><small>Reconnecting automatically. Press the red button to stop.</small>`);
  scheduleRetry();
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  const delay = Math.min(1000 * 2 ** Math.min(attempt, 3), 8000);
  retryTimer = setTimeout(connect, delay);
}

// Heartbeat: ping the robot every second; silence means the link is dead
setInterval(() => {
  if (!linkUp || !conn) return;
  if (Date.now() - lastHeard > LINK_TIMEOUT_MS) {
    linkDown('The robot stopped responding.');
    return;
  }
  if (conn.open) conn.send({ t: 'ping', ts: performance.now() });
}, PING_MS);

// ---------- Call screen ----------

function enterCall() {
  els.join.hidden = true;
  els.call.hidden = false;
  els.robotName.textContent = serial;
  showOverlay('Connected. Waiting for video…');
}

function showOverlay(html) {
  els.waitingText.innerHTML = html;
  els.waiting.hidden = false;
}

els.remote.addEventListener('playing', () => {
  if (linkUp) els.waiting.hidden = true;
});

async function showRoute(pc) {
  try {
    const stats = await pc.getStats();
    let pair = null;
    stats.forEach((s) => { if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s; });
    const local = pair && stats.get(pair.localCandidateId);
    const relayed = local && local.candidateType === 'relay';
    els.routePill.textContent = relayed ? 'Via relay' : 'Direct';
    els.routePill.title = relayed
      ? 'No direct path between the networks, so video goes through a relay server'
      : 'Video goes directly between the two laptops';
    els.routePill.hidden = false;
  } catch {}
}

function onRobotMessage(msg) {
  switch (msg.t) {
    case 'pong': {
      const rtt = Math.round(performance.now() - msg.ts);
      els.rttPill.hidden = false;
      els.rttPill.textContent = `${rtt} ms`;
      break;
    }
    case 'status':
      els.espPill.hidden = false;
      els.espPill.textContent = msg.esp ? 'ESP32 connected' : 'Simulation (no ESP32)';
      els.espPill.className = `pill ${msg.esp ? 'hw' : 'sim'}`;
      break;
    case 'esp':
      toast(`ESP32: ${msg.line}`);
      break;
    case 'busy':
      hangUp(`Robot ${serial} is already being controlled by someone else.`);
      break;
    case 'bye':
      linkDown('The robot went offline. Waiting for it to come back…');
      break;
  }
}

// ---------- Controls ----------

function sendCommand(cmd) {
  if (conn && conn.open) conn.send({ t: 'cmd', c: cmd, v: Number(els.speed.value) });
  showCmd(cmd);
}

let shownCmd = null;
function showCmd(cmd) {
  if (cmd === shownCmd) return;
  shownCmd = cmd;
  els.hudCmd.dataset.cmd = cmd;
  els.hudCmd.textContent = COMMANDS[cmd].toUpperCase();
}

els.speed.oninput = () => (els.speedOut.value = els.speed.value);

let toastTimer = null;
function toast(text) {
  els.toast.textContent = text;
  els.toast.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.style.opacity = 0), 2500);
}

window.addEventListener('pagehide', () => {
  if (conn && conn.open) conn.send({ t: 'cmd', c: 'S' });
  if (peer) peer.destroy();
});
