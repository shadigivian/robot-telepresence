// Robot side: streams the camera and microphone to the user over WebRTC,
// shows the user's camera and plays their sound, receives movement commands
// on a data channel and forwards them to the ESP32 via Web Serial.

const els = {
  netStatus: $('#netStatus'),
  espStatus: $('#espStatus'),
  stage: $('#stage'),
  preview: $('#preview'),
  userVideo: $('#userVideo'),
  soundBtn: $('#soundBtn'),
  fullBtn: $('#fullBtn'),
  micBtn: $('#micBtn'),
  screenChip: $('#screenChip'),
  placeholder: $('#placeholder'),
  liveChip: $('#liveChip'),
  serialChip: $('#serialChip'),
  cmdDisplay: $('#cmdDisplay'),
  cmdText: $('#cmdText'),
  cmdSrc: $('#cmdSrc'),
  cameraSelect: $('#cameraSelect'),
  cameraBtn: $('#cameraBtn'),
  serialInput: $('#serialInput'),
  randomBtn: $('#randomBtn'),
  onlineBtn: $('#onlineBtn'),
  onlineNote: $('#onlineNote'),
  baudSelect: $('#baudSelect'),
  espBtn: $('#espBtn'),
  serialNote: $('#serialNote'),
  userState: $('#userState'),
  rtcState: $('#rtcState'),
  cmdCount: $('#cmdCount'),
  relayState: $('#relayState'),
  log: $('#log'),
};

let stream = null;

// ---------- Serial number ----------

function randomSerial() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'RB-';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function loadSerial() {
  let s = null;
  try { s = localStorage.getItem('robotSerial'); } catch {}
  els.serialInput.value = s || randomSerial();
}

function saveSerial() {
  try { localStorage.setItem('robotSerial', els.serialInput.value.trim().toUpperCase()); } catch {}
}

els.randomBtn.onclick = () => { els.serialInput.value = randomSerial(); saveSerial(); };
els.serialInput.oninput = saveSerial;

// ---------- Camera ----------

async function listCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cams = devices.filter((d) => d.kind === 'videoinput');
  const current = els.cameraSelect.value;
  els.cameraSelect.innerHTML = '<option value="">Default camera</option>' +
    cams.map((c, i) => `<option value="${c.deviceId}">${c.label || `Camera ${i + 1}`}</option>`).join('');
  els.cameraSelect.value = current;
}

async function startCamera() {
  const deviceId = els.cameraSelect.value;
  const video = {
    width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
  try {
    let newStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({ video, audio: MIC });
    } catch (err) {
      // No microphone, or it is blocked: carry on with video only
      newStream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      logLine(els.log, `Microphone unavailable (${err.message}). Sending video without sound.`, 'err');
    }
    newStream.getVideoTracks().forEach((t) => (t.contentHint = 'motion'));

    // Switching camera mid-call: swap the tracks without renegotiating.
    // If the microphone came or went, place the call again instead.
    const hadStream = !!stream;
    const kinds = (s) => s.getTracks().map((t) => t.kind).sort().join();
    const sameKinds = hadStream && kinds(stream) === kinds(newStream);
    if (userCall && sameKinds) {
      for (const sender of userCall.peerConnection.getSenders()) {
        if (!sender.track) continue;
        const next = newStream.getTracks().find((t) => t.kind === sender.track.kind);
        if (next) await sender.replaceTrack(next);
      }
    }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = newStream;
    applyMic();
    if (userCall && !sameKinds) startVideo();

    els.preview.srcObject = stream;
    els.preview.hidden = false;
    els.placeholder.hidden = true;
    els.cameraBtn.textContent = 'Restart camera';
    els.onlineBtn.disabled = false;
    if (!hadStream) startVideo(); // a user was already waiting for video
    if (!wantOnline) els.onlineNote.textContent = 'Type this number into the User app to connect.';
    const s = stream.getVideoTracks()[0].getSettings();
    logLine(els.log, `Camera on (${s.width}×${s.height})${stream.getAudioTracks().length ? ' with microphone' : ''}`);
    await listCameras();
  } catch (err) {
    logLine(els.log, `Camera error: ${err.message}`, 'err');
    alert(`Could not start the camera: ${err.message}`);
  }
}

// Privacy: people near the robot can switch its microphone off. The user
// is told, so silence isn't mistaken for a broken link.
let micMuted = false;

function applyMic() {
  const mics = stream ? stream.getAudioTracks() : [];
  mics.forEach((t) => (t.enabled = !micMuted));
  els.micBtn.hidden = !mics.length;
  els.micBtn.textContent = micMuted ? 'Turn microphone on' : 'Mute microphone';
  els.micBtn.classList.toggle('danger', micMuted);
  sendStatus();
}

els.micBtn.onclick = () => {
  micMuted = !micMuted;
  applyMic();
  logLine(els.log, micMuted ? 'Microphone muted' : 'Microphone on');
};

els.cameraBtn.onclick = startCamera;
els.cameraSelect.onchange = () => stream && startCamera();

// ---------- Going online (matchmaking) ----------
//
// The robot stays online until "Go offline" is pressed. If the matchmaking
// server drops, it reconnects by itself. An ongoing call is not affected,
// because video and commands flow directly between the laptops.

let peer = null;
let wantOnline = false;
let serial = '';
let brokerTimer = null;
let brokerRetries = 0;

let userConn = null;   // data channel to the current user
let userCall = null;   // video call to the current user
let lastHeard = 0;

function goOnline() {
  serial = normalizeSerial(els.serialInput.value);
  if (!isValidSerial(serial)) {
    alert('The serial number must be 3 to 32 letters, digits or dashes, and must start and end with a letter or digit.');
    return;
  }
  els.serialInput.value = serial;
  saveSerial();
  wantOnline = true;
  brokerRetries = 0;
  try { localStorage.setItem('robotAutoOnline', '1'); } catch {}
  els.onlineBtn.textContent = 'Go offline';
  els.onlineBtn.classList.remove('primary');
  els.onlineBtn.classList.add('danger');
  els.serialInput.disabled = true;
  els.randomBtn.disabled = true;
  els.serialChip.textContent = serial;
  els.serialChip.hidden = false;
  connectBroker();
}

function goOffline() {
  wantOnline = false;
  clearTimeout(brokerTimer);
  try { localStorage.removeItem('robotAutoOnline'); } catch {}
  dropUser('Robot went offline', true);
  if (peer) { peer.destroy(); peer = null; }
  setStatus(els.netStatus, 'Offline', 'idle');
  els.onlineBtn.textContent = 'Go online';
  els.onlineBtn.classList.add('primary');
  els.onlineBtn.classList.remove('danger');
  els.onlineBtn.disabled = !stream;
  els.serialInput.disabled = false;
  els.randomBtn.disabled = false;
  els.serialChip.hidden = true;
  els.userState.textContent = '—';
  logLine(els.log, 'Offline');
}

els.onlineBtn.onclick = () => (wantOnline ? goOffline() : goOnline());

async function connectBroker() {
  await iceReady;
  if (!wantOnline) return;
  if (peer) peer.destroy();
  setStatus(els.netStatus, 'Connecting…', 'wait');
  const p = createPeer(robotPeerId(serial));
  peer = p;

  p.on('open', () => {
    if (p !== peer) return;
    brokerRetries = 0;
    setStatus(els.netStatus, `Online · ${serial}`, 'ok');
    if (!userConn) els.userState.textContent = 'Waiting…';
    logLine(els.log, `Online as ${serial}. Waiting for a user.`);
  });

  p.on('connection', (conn) => p === peer && onUserConnection(conn));

  p.on('disconnected', () => {
    if (p !== peer || !wantOnline) return;
    setStatus(els.netStatus, 'Reconnecting…', 'wait');
    logLine(els.log, 'Lost the matchmaking server, reconnecting (any call in progress continues)', 'err');
    scheduleBroker();
  });

  p.on('error', (err) => {
    if (p !== peer) return;
    if (err.type === 'peer-unavailable') return; // a user that just left
    if (err.type === 'unavailable-id') {
      setStatus(els.netStatus, 'Serial in use, retrying…', 'wait');
      logLine(els.log, `Serial ${serial} is still registered, probably by this robot's previous session. Retrying until it frees up.`, 'err');
    } else if (err.type === 'invalid-id') {
      logLine(els.log, 'This serial number is not allowed.', 'err');
      goOffline();
      return;
    } else {
      logLine(els.log, `Network: ${err.message || err.type}`, 'err');
      setStatus(els.netStatus, 'Reconnecting…', 'wait');
    }
    scheduleBroker();
  });
}

function scheduleBroker() {
  clearTimeout(brokerTimer);
  const delay = Math.min(2000 * 2 ** brokerRetries, 15000);
  brokerRetries++;
  brokerTimer = setTimeout(() => {
    if (!wantOnline) return;
    if (!peer || peer.destroyed) connectBroker();
    else if (peer.disconnected) {
      try { peer.reconnect(); } catch { connectBroker(); }
    }
  }, delay);
}

// ---------- The user link ----------

function onUserConnection(conn) {
  conn.on('open', () => {
    const otherUserActive = userConn && userConn.open && userConn.peer !== conn.peer &&
      Date.now() - lastHeard < LINK_TIMEOUT_MS;
    if (otherUserActive) {
      conn.send({ t: 'busy' });
      setTimeout(() => conn.close(), 1000);
      logLine(els.log, 'Refused a second user (robot already in use)', 'err');
      return;
    }

    const reconnecting = userConn && userConn.peer === conn.peer;
    dropUser(null, false);
    userConn = conn;
    lastHeard = Date.now();
    els.userState.textContent = 'Connected';
    logLine(els.log, reconnecting ? 'User reconnected' : 'User connected');
    sendStatus();
    startVideo();
  });

  conn.on('data', (msg) => {
    if (conn !== userConn) return;
    lastHeard = Date.now();
    onControl(msg);
  });

  conn.on('close', () => {
    if (conn === userConn) dropUser('User link closed. Waiting for the user to reconnect.');
  });
  conn.on('error', (err) => logLine(els.log, `Link error: ${err.message || err.type}`, 'err'));
}

function startVideo() {
  if (!userConn || !peer || !stream) return;
  if (userCall) userCall.close();
  const call = peer.call(userConn.peer, stream);
  userCall = call;
  const pc = call.peerConnection;
  pc.addEventListener('connectionstatechange', () => {
    if (call !== userCall) return;
    const st = pc.connectionState;
    els.rtcState.textContent = st;
    els.liveChip.hidden = st !== 'connected';
    if (st === 'failed') logLine(els.log, hasRelay() ? 'Video could not reach the user, even through the relay.' : NO_PATH_HELP, 'err');
    if (st === 'connected') {
      describeRoute(pc).then((route) => logLine(els.log, `Video streaming to user (${route})`));
    }
  });
  // The user answers with their own camera and microphone (if they allowed them)
  call.on('stream', (remote) => { if (call === userCall) showUser(remote); });
  call.on('close', () => {
    if (call === userCall) { userCall = null; els.liveChip.hidden = true; els.rtcState.textContent = '—'; hideUser(); }
  });
  call.on('error', (err) => logLine(els.log, `Video error: ${err.message || err.type}`, 'err'));
}

// ---------- The user's camera and sound ----------

function showUser(remote) {
  // Fires once per incoming track, with the same stream
  const first = els.userVideo.srcObject !== remote;
  els.userVideo.srcObject = remote;
  const hasVideo = remote.getVideoTracks().length > 0;
  els.userVideo.hidden = !hasVideo;
  els.stage.classList.toggle('with-user', hasVideo);
  playWithSound(els.userVideo, els.soundBtn);
  if (first) logLine(els.log, 'Receiving the user\'s camera and sound');
}

function hideUser() {
  els.userVideo.srcObject = null;
  els.userVideo.hidden = true;
  els.soundBtn.hidden = true;
  els.stage.classList.remove('with-user');
}

// The user's shared screen takes the whole stage (the robot's own preview is
// hidden so it doesn't cover what they are showing)
function showSharing(on) {
  if (on === els.stage.classList.contains('sharing')) return;
  els.stage.classList.toggle('sharing', on);
  els.screenChip.hidden = !on;
  logLine(els.log, on ? 'The user is sharing their screen' : 'The user stopped sharing their screen');
}

els.fullBtn.onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else els.stage.requestFullscreen().catch(() => {});
};

// Direct (same network or punched through NAT) or relayed via TURN
async function describeRoute(pc) {
  try {
    const stats = await pc.getStats();
    let pair = null;
    stats.forEach((s) => { if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s; });
    const local = pair && stats.get(pair.localCandidateId);
    if (!local) return 'direct';
    return local.candidateType === 'relay' ? 'via relay server' : 'direct';
  } catch { return 'direct'; }
}

// reason: log message (null = silent). notify: tell the user first.
function dropUser(reason, notify = false) {
  drive('S', 'link down');
  if (userConn && notify && userConn.open) userConn.send({ t: 'bye', reason });
  const conn = userConn;
  const call = userCall;
  userConn = null;
  userCall = null;
  if (call) call.close();
  if (conn) setTimeout(() => conn.close(), notify ? 300 : 0);
  hideUser();
  if (conn) showSharing(false);
  els.liveChip.hidden = true;
  els.rtcState.textContent = '—';
  if (wantOnline) els.userState.textContent = 'Waiting…';
  if (reason) logLine(els.log, reason);
}

// A user that stops answering (laptop closed, Wi-Fi gone) is dropped so the
// motors stay stopped and the user's automatic reconnect gets a clean slot.
setInterval(() => {
  if (userConn && Date.now() - lastHeard > LINK_TIMEOUT_MS) {
    dropUser('User stopped responding. Waiting for the user to reconnect.');
  }
}, 1000);

function sendDC(msg) {
  if (userConn && userConn.open) userConn.send(msg);
}

function sendStatus() {
  const mic = !!stream && stream.getAudioTracks().length > 0 && !micMuted;
  sendDC({ t: 'status', esp: !!port && espAnswered, cmd: currentCmd, mic });
}

let cmdCount = 0;
function onControl(msg) {
  if (msg.t === 'cmd' && COMMANDS[msg.c]) {
    cmdCount++;
    els.cmdCount.textContent = cmdCount;
    drive(msg.c, 'user', msg.v);
  } else if (msg.t === 'ping') {
    sendDC({ t: 'pong', ts: msg.ts });
  } else if (msg.t === 'recall') {
    startVideo(); // the user's camera or screen came or went: call again to carry it
  } else if (msg.t === 'screen') {
    showSharing(!!msg.on);
  }
}

// ---------- Motor commands ----------

let currentCmd = 'S';
let lastMoveAt = 0;
let speed = 200;

// Every command goes through here, whether it comes from the user or the local test pad.
function drive(cmd, source, newSpeed) {
  if (typeof newSpeed === 'number') speed = Math.max(0, Math.min(255, Math.round(newSpeed)));
  if (cmd !== 'S') lastMoveAt = Date.now();

  const changed = cmd !== currentCmd;
  if (cmd === 'S' && !changed && source !== 'user' && source !== 'local') return;

  // Always forward to the ESP32: repeats keep its safety watchdog fed
  writeSerial(cmd === 'S' ? 'S' : `${cmd} ${speed}`);

  if (changed) {
    currentCmd = cmd;
    els.cmdDisplay.dataset.cmd = cmd;
    els.cmdText.textContent = COMMANDS[cmd];
    els.cmdSrc.textContent = `${source}${port ? '' : ' · simulated'}`;
    logLine(els.log, `${COMMANDS[cmd]}${cmd !== 'S' ? ` @ ${speed}` : ''}  (${source})`, 'cmd');
    sendStatus();
  }
}

// Watchdog: if movement commands stop arriving (tab frozen, network hiccup), stop.
setInterval(() => {
  if (currentCmd !== 'S' && Date.now() - lastMoveAt > REPEAT_MS * 4) drive('S', 'watchdog');
}, 100);

createDpad($('#testPad'), (cmd) => drive(cmd, 'local'));

// ---------- ESP32 over Web Serial ----------

let port = null;
let writer = null;
let reader = null;
const encoder = new TextEncoder();

if (!('serial' in navigator)) {
  els.espBtn.disabled = true;
  els.serialNote.textContent = 'This browser has no Web Serial support. Use Chrome or Edge on the robot laptop. Simulation mode still works.';
  els.serialNote.classList.add('warn');
}

// USB-to-serial chips used on ESP32 boards. Listing only these keeps
// Bluetooth and other COM ports out of the chooser.
const USB_SERIAL_CHIPS = [
  { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
  { usbVendorId: 0x1a86 }, // WCH CH340 / CH9102
  { usbVendorId: 0x0403 }, // FTDI
  { usbVendorId: 0x303a }, // Espressif native USB (S2, S3, C3...)
];
let showAllPorts = false;  // after an empty chooser, offer every port next time
let espAnswered = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectESP() {
  try {
    port = await navigator.serial.requestPort(showAllPorts ? {} : { filters: USB_SERIAL_CHIPS });
    await port.open({ baudRate: Number(els.baudSelect.value) });
  } catch (err) {
    port = null;
    if (err.name === 'NotFoundError') {
      // Chooser closed with nothing picked: often no driver, or a charge-only cable
      showAllPorts = true;
      els.serialNote.textContent = 'No ESP32 selected. If it was not in the list: use a USB cable that carries data (some are charge-only) ' +
        'and install the driver for its USB chip, CP210x (silabs.com) or CH340 (wch-ic.com). Press Connect ESP32 again to see every port.';
      els.serialNote.classList.add('warn');
    } else {
      logLine(els.log, `Serial error: ${err.message}`, 'err');
    }
    return;
  }
  // Release the reset lines so the board runs its sketch rather than staying in reset
  try { await port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch {}
  writer = port.writable.getWriter();
  setStatus(els.espStatus, 'ESP32 connecting…', 'wait');
  els.espBtn.textContent = 'Disconnect ESP32';
  els.baudSelect.disabled = true;
  logLine(els.log, `Serial port open @ ${els.baudSelect.value} baud. Checking the ESP32 answers…`);
  readLoop();
  helloESP();
}

// Ask the sketch to identify itself. No answer means something else is on the
// port: factory firmware, a different sketch, the wrong baud rate.
async function helloESP() {
  const p = port;
  espAnswered = false;
  for (const wait of [300, 1500, 1500]) { // the board may be restarting after the port opened
    await sleep(wait);
    if (port !== p || espAnswered) return;
    writeSerial('?');
  }
  await sleep(1500);
  if (port !== p || espAnswered) return;
  setStatus(els.espStatus, 'ESP32 not answering', 'error');
  els.serialNote.textContent = 'The port is open, but the ESP32 is not answering. Upload esp32/robot_controller/robot_controller.ino ' +
    'to it with the Arduino IDE, and check the baud rate is 115200. Commands still show here in the meantime.';
  els.serialNote.classList.add('warn');
  logLine(els.log, 'ESP32 is not answering: is robot_controller.ino uploaded?', 'err');
}

function onESPAnswer() {
  if (espAnswered) return;
  espAnswered = true;
  showAllPorts = false;
  setStatus(els.espStatus, 'ESP32 connected', 'ok');
  els.serialNote.textContent = 'ESP32 ready. Commands go to the motors.';
  els.serialNote.classList.remove('warn');
  writeSerial('S');
  sendStatus();
}

let closingESP = false;
async function disconnectESP() {
  const p = port;
  if (!p || closingESP) return;
  closingESP = true;
  await writeSerial('S');
  port = null;
  closingESP = false;
  try { if (reader) await reader.cancel(); } catch {}
  try { if (writer) writer.releaseLock(); } catch {}
  try { await p.close(); } catch {}
  writer = null;
  reader = null;
  espAnswered = false;
  setStatus(els.espStatus, 'ESP32 not connected', 'idle');
  els.espBtn.textContent = 'Connect ESP32';
  els.baudSelect.disabled = false;
  logLine(els.log, 'ESP32 disconnected');
  sendStatus();
}

async function writeSerial(line) {
  if (!writer) return;
  try {
    await writer.write(encoder.encode(line + '\n'));
  } catch (err) {
    if (closingESP) return;
    logLine(els.log, `Serial write failed: ${err.message}`, 'err');
    disconnectESP();
  }
}

// Lines printed by the ESP32 are shown in the log and forwarded to the user
async function readLoop() {
  const decoder = new TextDecoder();
  let buffer = '';
  while (port && port.readable) {
    reader = port.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let i;
        while ((i = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, i).trim();
          buffer = buffer.slice(i + 1);
          if (/^(READY|OK|ERR|TIMEOUT)\b/.test(line)) onESPAnswer();
          if (line) {
            logLine(els.log, `ESP32: ${line}`, 'rx');
            sendDC({ t: 'esp', line });
          }
        }
      }
    } catch {
      // device unplugged or reader cancelled
    } finally {
      try { reader.releaseLock(); } catch {}
    }
  }
}

els.espBtn.onclick = () => (port ? disconnectESP() : connectESP());

if ('serial' in navigator) {
  navigator.serial.addEventListener('disconnect', (e) => {
    if (e.target === port) disconnectESP();
  });
}

// ---------- Invite link ----------
//
// start-robot.bat publishes the user page on a public address; the local
// server reports it at /share-info. The link carries the serial number, so
// opening it connects straight to this robot.

const share = {
  link: $('#shareLink'),
  copy: $('#copyBtn'),
  shareBtn: $('#shareBtn'),
  note: $('#shareNote'),
};
let shareInfo = { state: 'off', url: null };
let inviteLink = null;

// Opened from a hosted site (GitHub Pages): the user page sits right next to
// this one, so the invite link is permanent and needs no local server.
const HOSTED = !['localhost', '127.0.0.1'].includes(location.hostname);
const permanentUserPage = HOSTED ? new URL('user.html', location.href).href : CONFIG.publicUserPage;

async function pollShareInfo() {
  if (!permanentUserPage) {
    try {
      const res = await fetch('/share-info', { cache: 'no-store' });
      shareInfo = await res.json();
    } catch {
      shareInfo = { state: 'error', url: null };
    }
  }
  renderInvite();
}

function renderInvite() {
  const base = permanentUserPage || (shareInfo.state === 'ready' && shareInfo.url ? `${shareInfo.url}/user` : null);
  const s = normalizeSerial(els.serialInput.value);
  inviteLink = base && isValidSerial(s) ? `${base}?serial=${encodeURIComponent(s)}` : null;

  share.link.textContent = inviteLink || '—';
  share.link.classList.toggle('dim', !inviteLink);
  share.copy.disabled = !inviteLink;
  share.shareBtn.hidden = !navigator.share;
  share.shareBtn.disabled = !inviteLink;

  let note;
  if (!base) {
    note = {
      off: 'No public link. Start the robot with start-robot.bat to get one.',
      starting: 'Creating the public link… (about 10 seconds)',
      error: 'Could not create the public link. Check the internet connection and the black server window.',
      blocked: 'This internet connection blocks the automatic link (common on phone hotspots). Set up the permanent link once with deploy-github.bat (see README), or use another network.',
    }[shareInfo.state] || 'Creating the public link…';
  } else if (!wantOnline) {
    note = 'Press Go online so the link works.';
  } else {
    note = 'Send this link. Opening it connects straight to this robot, with nothing to install.' +
      (permanentUserPage ? '' : ' The address changes when the robot app restarts, so re-send it then.');
  }
  share.note.textContent = note;
}

share.copy.onclick = async () => {
  if (!inviteLink) return;
  try {
    await navigator.clipboard.writeText(inviteLink);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(share.link);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    document.execCommand('copy');
  }
  share.copy.textContent = 'Copied ✓';
  setTimeout(() => (share.copy.textContent = 'Copy link'), 1500);
};

share.shareBtn.onclick = () => {
  if (inviteLink) navigator.share({ title: `Drive robot ${normalizeSerial(els.serialInput.value)}`, url: inviteLink }).catch(() => {});
};

els.serialInput.addEventListener('input', renderInvite);
els.onlineBtn.addEventListener('click', () => setTimeout(renderInvite, 0));
pollShareInfo();
setInterval(pollShareInfo, 3000);

// ---------- Startup ----------

window.addEventListener('pagehide', () => {
  writeSerial('S');
  if (peer) peer.destroy(); // frees the serial on the server right away
});

keepAwake();

iceReady.then(() => {
  els.relayState.textContent = hasRelay() ? 'Configured' : 'Not set (direct only)';
});

loadSerial();
listCameras().catch(() => {});
setStatus(els.netStatus, 'Offline', 'idle');

// Was the robot online when this page last closed (reload, browser restart)?
// Then come straight back online, so a connected user can resume.
let autoOnline = false;
try { autoOnline = localStorage.getItem('robotAutoOnline') === '1'; } catch {}
if (autoOnline) {
  logLine(els.log, 'Resuming: the robot was online before this page closed');
  startCamera().then(() => { if (stream && !wantOnline) goOnline(); });
}
