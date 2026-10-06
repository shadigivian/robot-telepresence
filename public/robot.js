// Robot side: streams the camera and microphone to the user over WebRTC,
// shows the user's camera and plays their sound, receives movement commands
// on a data channel and forwards them to the Arduino Uno via Web Serial.

const els = {
  netStatus: $('#netStatus'),
  boardStatus: $('#boardStatus'),
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
  boardBtn: $('#boardBtn'),
  serialNote: $('#serialNote'),
  userState: $('#userState'),
  rtcState: $('#rtcState'),
  cmdCount: $('#cmdCount'),
  relayState: $('#relayState'),
  log: $('#log'),
};

let stream = null;
let stationReady = false;
let boundRobot = null;
let remoteSession = null;
let remoteLease = null;
let leaseUntil = 0;
let accepting = false;
let videoAttempt = 0;
const commandGate = new RobotSafety.CommandGate();
const emergencyStop = reason => {
  remoteLease = null; leaseUntil = 0; commandGate.reset();
  drive('S', reason || 'stopped');
  sendDC({ t: 'control-revoked', reason });
};
Platform.on('control:lease', lease => {
  if (remoteSession && lease.sessionId === remoteSession.id) {
    remoteLease = lease;
    leaseUntil = performance.now() + 2500;
    commandGate.grant(lease.id);
  }
});
Platform.on('control:revoked', msg => emergencyStop(msg.reason));
Platform.on('disconnected', () => emergencyStop('ارتباط سرور قطع شد'));
Platform.on('expired', () => { stationReady = false; emergencyStop('ورود منقضی شد'); goOffline(); });
Platform.on('session:ended', msg => { if (!msg.id || msg.id === remoteSession?.id) { emergencyStop(msg.reason); dropUser(msg.reason, true); } });
Platform.on('robot:changed', () => { goOffline(); location.reload(); });

function bindStation(robot) {
  boundRobot = robot; stationReady = true;
  els.serialInput.value = robot.serial;
  els.serialInput.readOnly = true;
  els.randomBtn.hidden = true;
  document.querySelector('#stationName').textContent = robot.name;
  document.querySelector('#stationMode').value = robot.mode;
  document.querySelector('#startNode').value = robot.startNodeId;
  renderInvite();
}
setInterval(() => {
  if (!stationReady || !Platform.connected) return;
  Platform.socketRequest('robot:state', { online: !!(wantOnline && peer?.open), board: !!port && boardAnswered, camera: !!stream?.getVideoTracks().some(t => t.readyState === 'live') }).catch(e => { emergencyStop(e.message); setStatus(els.netStatus, e.message, 'error'); });
}, 1000);
setInterval(() => {
  if (remoteLease && (performance.now() > leaseUntil || !Platform.connected)) emergencyStop('مجوز کنترل منقضی شد');
  if (userConn?.open && remoteLease) {
    const challenge = crypto.randomUUID();
    commandGate.issue(challenge);
    sendDC({ t: 'challenge', challenge, lease: remoteLease.id });
  }
}, 200);

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
  els.cameraSelect.replaceChildren(new Option('دوربین پیش‌فرض', ''));
  cams.forEach((c, i) => els.cameraSelect.add(new Option(c.label || `دوربین ${i + 1}`, c.deviceId)));
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
  if (!stationReady || !Platform.connected) { alert('ابتدا با حساب دستگاه وارد شوید.'); return; }
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
  try { await loadPrivateIce(); els.relayState.textContent = hasRelay() ? 'Configured' : 'Not set (direct only)'; }
  catch (e) { setStatus(els.netStatus, e.message, 'error'); scheduleBroker(); return; }
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
  conn.on('open', async () => {
    if (accepting || !stationReady || !Platform.connected) { conn.close(); return; }
    accepting = true;
    let verified;
    try {
      verified = await Platform.api('/sessions/verify', { method: 'POST', body: { id: conn.metadata?.id, secret: conn.metadata?.secret, peerId: conn.peer } });
    } catch { conn.send({ t: 'denied' }); conn.close(); return; }
    finally { accepting = false; }
    if (!conn.open || !wantOnline || !Platform.connected) { conn.close(); return; }
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
    remoteSession = verified;
    lastHeard = Date.now();
    els.userState.textContent = verified.name;
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

async function startVideo() {
  if (!userConn || !peer || !stream) return;
  const generation = ++videoAttempt;
  const target = userConn, session = remoteSession;
  if (!session) return;
  let proof;
  try { ({ proof } = await Platform.api(`/sessions/${session.id}/media-proof`, { method: 'POST' })); }
  catch (e) { emergencyStop(e.message); return; }
  if (generation !== videoAttempt || target !== userConn || session !== remoteSession || !target.open) return;
  emergencyStop('تصویر در حال اتصال است');
  if (userCall) userCall.close();
  const call = peer.call(userConn.peer, stream, { metadata: { proof } });
  userCall = call;
  const pc = call.peerConnection;
  pc.addEventListener('connectionstatechange', () => {
    if (call !== userCall) return;
    const st = pc.connectionState;
    els.rtcState.textContent = st;
    els.liveChip.hidden = st !== 'connected';
    if (st !== 'connected') emergencyStop('تصویر قطع شد');
    if (st === 'failed') { logLine(els.log, hasRelay() ? 'Video could not reach the user, even through the relay.' : NO_PATH_HELP, 'err'); setTimeout(() => { if (call === userCall && userConn?.open) startVideo(); }, 2000); }
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
  videoAttempt++;
  emergencyStop(reason);
  drive('S', 'link down');
  if (userConn && notify && userConn.open) userConn.send({ t: 'bye', reason });
  const conn = userConn;
  const call = userCall;
  userConn = null;
  userCall = null;
  remoteSession = null;
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
  sendDC({ t: 'status', board: !!port && boardAnswered, cmd: currentCmd, mic });
}

let cmdCount = 0;
function onControl(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'cmd' && COMMANDS[msg.c]) {
    if (msg.c === 'S') commandGate.accept(msg);
    if (msg.c !== 'S' && (!Platform.connected || !remoteSession?.canDrive || !remoteLease || performance.now() > leaseUntil || !boardAnswered || !port || userCall?.peerConnection?.connectionState !== 'connected' || !commandGate.accept(msg))) return;
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
  if (typeof newSpeed === 'number' && Number.isFinite(newSpeed)) speed = Math.max(0, Math.min(255, Math.round(newSpeed)));
  if (cmd !== 'S') lastMoveAt = Date.now();

  const changed = cmd !== currentCmd;
  // Always forward to the Arduino: repeats keep its safety watchdog fed
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

const localPad = createDpad($('#testPad'), (cmd) => {
  if (!stationReady || !port || !boardAnswered) return;
  if (remoteSession) return;
  drive(cmd, 'local');
}, { listenKeys: false });
localPad.setEnabled(false);

// ---------- Arduino Uno over Web Serial ----------
//
// The Uno runs arduino/robot_controller_uno/robot_controller_uno.ino and takes
// one command per line at 115200 baud ("F 200", "S", "?"). Opening its port
// restarts the Uno; the sketch then says READY about a second later.

let port = null;
let writer = null;
let reader = null;
const encoder = new TextEncoder();

const BAUD = 115200; // must match Serial.begin() in the Uno sketch

// USB ids of Uno boards: genuine ones and the chips clones use. The chooser
// lists only these, so Bluetooth devices (headphones, phones), which Windows
// also shows as serial ports, never appear.
const UNO_USB_IDS = [
  { usbVendorId: 0x2341 }, // Arduino (genuine Uno)
  { usbVendorId: 0x2a03 }, // Arduino (arduino.org boards)
  { usbVendorId: 0x1a86 }, // WCH CH340: most Uno clones
  { usbVendorId: 0x0403 }, // FTDI: older boards, USB adapters
  { usbVendorId: 0x10c4 }, // Silicon Labs CP210x: some clones
];
const isUno = (p) => UNO_USB_IDS.some((f) => f.usbVendorId === p.getInfo().usbVendorId);

const CH340_DRIVER = '<a href="https://www.wch-ic.com/downloads/CH341SER_EXE.html" target="_blank" rel="noopener">CH340 driver</a>';

let boardAnswered = false;
let manualDisconnect = false; // "Disconnect" pressed: don't reconnect on our own
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Only fixed text from this file goes in here, never device data
function boardNote(html, warn = true) {
  els.serialNote.innerHTML = html;
  els.serialNote.classList.toggle('warn', warn);
}

if (!('serial' in navigator)) {
  els.boardBtn.disabled = true;
  boardNote('This browser cannot talk to the Arduino (no Web Serial). Use <b>Chrome</b> or <b>Edge</b> on the robot laptop. Simulation mode still works.');
}

// Unos this site was allowed to use before (Bluetooth ports are skipped)
async function knownUnos() {
  if (!('serial' in navigator)) return [];
  return (await navigator.serial.getPorts()).filter(isUno);
}

// The button: reuse the Uno allowed before, otherwise ask which one it is
async function connectBoard() {
  manualDisconnect = false;
  const [known] = await knownUnos();
  if (known) return openBoard(known);
  let chosen;
  try {
    chosen = await navigator.serial.requestPort({ filters: UNO_USB_IDS });
  } catch {
    // Closed with nothing picked, or the list was empty: the Uno isn't reaching the laptop
    boardNote('No Arduino found. Plug the Uno in with its USB cable (it must carry data; the green <b>ON</b> light should be lit), ' +
      `then press <b>Connect Arduino</b> again. Clone boards also need the ${CH340_DRIVER}.`);
    return;
  }
  return openBoard(chosen);
}

async function openBoard(p) {
  if (port || closingBoard || openingBoard) return;
  openingBoard = true;
  setStatus(els.boardStatus, 'Arduino connecting…', 'wait');
  try {
    await p.open({ baudRate: BAUD });
  } catch (err) {
    openingBoard = false;
    const busy = err.name === 'InvalidStateError' || /failed to open/i.test(err.message);
    setStatus(els.boardStatus, busy ? 'Arduino port busy' : 'Arduino error', 'error');
    boardNote(busy
      ? 'The Arduino is in use by another program. Close the Arduino IDE (Serial Monitor or an upload) and any other Robot Station tab, then press <b>Connect Arduino</b>.'
      : 'Could not open the Arduino port. Unplug the Uno, plug it back in, and press <b>Connect Arduino</b>.');
    logLine(els.log, `Serial error: ${err.message}`, 'err');
    return;
  }
  port = p;
  openingBoard = false;
  writer = port.writable.getWriter();
  els.boardBtn.textContent = 'Disconnect Arduino';
  logLine(els.log, 'Arduino port open. Restarting the Uno…');
  readLoop();
  await restartUno();
  helloBoard();
}

// Restart the Uno so the sketch starts fresh with the motors stopped. The
// Uno resets when DTR switches on (the same thing the Arduino IDE does).
async function restartUno() {
  try {
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await sleep(100);
    await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  } catch {}
}

// The sketch says READY after each restart. "?" asks again, for boards that
// did not restart. No answer means the robot sketch is not on the board.
async function helloBoard() {
  const p = port;
  boardAnswered = false;
  for (const wait of [1200, 1500, 1500]) {
    await sleep(wait);
    if (port !== p || boardAnswered) return;
    writeSerial('?');
  }
  await sleep(2000);
  if (port !== p || boardAnswered) return;
  setStatus(els.boardStatus, 'Arduino not answering', 'error');
  boardNote('The Uno is connected, but the robot sketch is not answering. In the Arduino IDE, open ' +
    '<b>arduino/robot_controller_uno/robot_controller_uno.ino</b>, choose board <b>Arduino Uno</b>, press <b>Upload</b>, ' +
    'then press <b>Connect Arduino</b> again. Commands still show here in the meantime.');
  logLine(els.log, 'Arduino is not answering: is robot_controller_uno.ino uploaded?', 'err');
}

function onBoardAnswer() {
  lastBoardAt = performance.now();
  if (boardAnswered) return;
  boardAnswered = true;
  localPad.setEnabled(true);
  setStatus(els.boardStatus, 'Arduino connected', 'ok');
  boardNote('Arduino ready. Commands go to the motors. Next time it connects by itself.', false);
  logLine(els.log, 'Arduino ready');
  writeSerial('S');
  sendStatus();
}

let closingBoard = false;
let openingBoard = false;
async function disconnectBoard() {
  const p = port;
  if (!p || closingBoard) return;
  closingBoard = true;
  await writeSerial('S');
  port = null;
  try { if (reader) await reader.cancel(); } catch {}
  try { if (writer) writer.releaseLock(); } catch {}
  try { await p.close(); } catch {}
  writer = null;
  reader = null;
  boardAnswered = false;
  localPad.setEnabled(false);
  emergencyStop('Arduino قطع شد');
  setStatus(els.boardStatus, 'Arduino not connected', 'idle');
  els.boardBtn.textContent = 'Connect Arduino';
  logLine(els.log, 'Arduino disconnected');
  sendStatus();
  closingBoard = false;
}

let serialPending = null;
let serialDraining = null;
let stopPending = false;
// At most one pending movement; old repeats are never queued behind a slow USB write.
function writeSerial(line) {
  if (!writer) return Promise.resolve();
  if (line === 'S') { stopPending = true; serialPending = null; }
  else if (line !== '?' || serialPending === null) serialPending = line;
  if (!serialDraining) {
    serialDraining = (async () => {
      while (writer && (stopPending || serialPending !== null)) {
        const activeWriter = writer;
        const next = stopPending ? 'S' : serialPending;
        if (stopPending) stopPending = false; else serialPending = null;
        try { await activeWriter.write(encoder.encode(next + '\n')); }
        catch (err) {
          serialPending = null; stopPending = false;
          if (!closingBoard) { logLine(els.log, `Serial write failed: ${err.message}`, 'err'); setTimeout(disconnectBoard, 0); }
          break;
        }
      }
    })().finally(() => { serialDraining = null; });
  }
  return serialDraining;
}
let lastBoardAt = 0;
setInterval(() => {
  if (!port || closingBoard) return;
  if (boardAnswered && performance.now() - lastBoardAt > 4500) {
    boardAnswered = false; localPad.setEnabled(false); emergencyStop('Arduino پاسخ نمی‌دهد');
    setStatus(els.boardStatus, 'Arduino پاسخ نمی‌دهد', 'error'); sendStatus();
  }
  writeSerial('?');
}, 2000);

// Lines printed by the Uno are shown in the log and forwarded to the user
async function readLoop() {
  const activePort = port;
  const decoder = new TextDecoder();
  let buffer = '';
  while (port === activePort && activePort?.readable) {
    let ended = false;
    reader = activePort.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (port !== activePort) break;
        if (done) { ended = true; break; }
        buffer += decoder.decode(value, { stream: true });
        let i;
        while ((i = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, i).trim();
          buffer = buffer.slice(i + 1);
          if (line === 'READY robot_controller') onBoardAnswer();
          else if (boardAnswered && /^(OK [FBLRS]|TIMEOUT motors stopped)\b/.test(line)) lastBoardAt = performance.now();
          if (/^(TIMEOUT|ERR)\b/.test(line)) emergencyStop('Arduino حرکت را متوقف کرد');
          if (line) {
            logLine(els.log, `Arduino: ${line}`, 'rx');
            sendDC({ t: 'board', line });
          }
        }
      }
    } catch {
      // unplugged, restart noise, or reader cancelled
      ended = true;
    } finally {
      try { reader.releaseLock(); } catch {}
    }
    if (ended) {
      if (port === activePort && !closingBoard) { emergencyStop('ارتباط سریال قطع شد'); disconnectBoard(); }
      return;
    }
  }
}

els.boardBtn.onclick = () => {
  if (port) { manualDisconnect = true; disconnectBoard(); }
  else connectBoard();
};

if ('serial' in navigator) {
  // Unplugged: stop, and wait for it to come back
  navigator.serial.addEventListener('disconnect', async (e) => {
    if (e.target !== port) return;
    await disconnectBoard();
    boardNote('Arduino unplugged. Plug it back in: it reconnects by itself.');
  });
  // Plugged in (an Uno this site was allowed before): connect by itself
  navigator.serial.addEventListener('connect', (e) => {
    if (!port && !manualDisconnect && isUno(e.target)) openBoard(e.target);
  });
  // Page opened: reconnect the Uno used last time, no click needed
  knownUnos().then(([known]) => {
    if (known && !port) {
      logLine(els.log, 'Connecting the Arduino used last time…');
      openBoard(known);
    }
  }).catch(() => {});
}

// ---------- Invite link ----------
//
// start-robot.bat publishes the user page on a public address; the local
// server reports it at /share-info. A permanent Pages address still needs
// this public backend connection before its authenticated invitations work.

const share = {
  link: $('#shareLink'),
  copy: $('#copyBtn'),
  shareBtn: $('#shareBtn'),
  note: $('#shareNote'),
  invite: $('#inviteBtn'),
};
let shareInfo = { state: 'off', url: null };
let inviteLink = null;
let inviteToken = null;
let inviteExpires = 0;
let creatingInvite = false;
let sharePoll = 0;

// Opened from a hosted site (GitHub Pages): the user page sits right next to
// this one. Both pages still require the configured shared backend.
const HOSTED = !['localhost', '127.0.0.1'].includes(location.hostname);
const permanentUserPage = HOSTED ? new URL('user.html', location.href).href : CONFIG.publicUserPage;

async function pollShareInfo() {
  const current = ++sharePoll;
  if (!HOSTED) {
    try {
      const res = await fetch('/share-info', { cache: 'no-store' });
      if (!res.ok) throw new Error('Public connection unavailable');
      const info = await res.json();
      if (current !== sharePoll) return;
      shareInfo = info;
    } catch {
      if (current !== sharePoll) return;
      shareInfo = { state: 'error', url: null };
    }
  }
  renderInvite();
}

function publicConnectionReady() {
  if (HOSTED) return Platform.connected && Platform.connection.state === 'ready';
  return shareInfo.state === 'ready' && typeof shareInfo.url === 'string' && !!shareInfo.url;
}

function invitationBase() {
  if (!publicConnectionReady()) return null;
  return permanentUserPage || `${shareInfo.url}/user`;
}

function renderInvite() {
  const base = invitationBase();
  if (Date.now() >= inviteExpires) inviteToken = null;
  inviteLink = inviteToken && base ? `${base}#invite=${encodeURIComponent(inviteToken)}` : null;

  share.link.textContent = inviteLink || '—';
  share.link.classList.toggle('dim', !inviteLink);
  share.copy.disabled = !inviteLink;
  share.shareBtn.hidden = !navigator.share;
  share.shareBtn.disabled = !inviteLink;
  share.invite.disabled = !boundRobot || creatingInvite;

  let note;
  if (!base) {
    note = HOSTED ? 'اتصال به سرور ربات در دسترس نیست؛ پس از وصل شدن سرور می‌توانید دعوت بسازید.' : {
      off: 'آدرس عمومی وب‌اپ کاربر در دسترس نیست. برنامه راه‌انداز ربات را با اشتراک عمومی اجرا کنید.',
      starting: 'آدرس عمومی در حال اتصال است. ساخت و کپی دعوت پس از آماده شدن سرور ممکن می‌شود.',
      error: 'آدرس عمومی وب‌اپ کاربر در دسترس نیست. اتصال دوباره در حال انجام است؛ سرور و لپ‌تاپ را روشن نگه دارید.',
      blocked: 'آدرس عمومی وب‌اپ کاربر هنوز آماده نیست. اتصال اینترنت و وضعیت سرور را بررسی کنید.',
    }[shareInfo.state] || 'آدرس عمومی در حال اتصال است.';
  } else if (!wantOnline) {
    note = 'Press Go online so the link works.';
  } else {
    note = 'Send this link. Opening it connects straight to this robot, with nothing to install.' +
      (permanentUserPage ? '' : ' The temporary address can change when the tunnel reconnects, so copy the current link before sending it.');
  }
  share.note.textContent = note;
}

share.invite.onclick = async () => {
  if (!boundRobot || creatingInvite) return;
  let message = '', succeeded = false;
  creatingInvite = true;
  renderInvite();
  try {
    const base = invitationBase();
    if (!base) throw new Error('آدرس عمومی وب‌اپ کاربر در دسترس نیست.');
    const invite = await Platform.api('/invites', { method: 'POST', body: { robotId: boundRobot.id, canDrive: document.querySelector('#inviteDrive').checked } });
    inviteToken = invite.token;
    inviteExpires = invite.expires;
    succeeded = true;
    message = 'دعوت یک‌بارمصرف تا ۱۵ دقیقه معتبر است.';
  } catch (e) { message = e.message; }
  finally {
    creatingInvite = false;
    renderInvite();
    if (message && (!succeeded || invitationBase())) share.note.textContent = message;
  }
};
document.querySelector('#revokeInvites').onclick = async () => {
  try { await Platform.api('/invites', { method: 'DELETE', body: { robotId: boundRobot.id } }); inviteToken = null; inviteLink = null; inviteExpires = 0; renderInvite(); } catch (e) { share.note.textContent = e.message; }
};
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
for (const event of ['connected', 'disconnected', 'expired', 'backend:status']) Platform.on(event, renderInvite);

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
if (autoOnline && stationReady) {
  logLine(els.log, 'Resuming: the robot was online before this page closed');
  startCamera().then(() => { if (stream && !wantOnline) goOnline(); });
}
