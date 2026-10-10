// User side: finds the robot by serial number, shows its camera and plays its
// sound, sends back this laptop's camera and microphone, and sends movement
// commands. Once connected, the session stays up until the user presses hang
// up: any drop triggers automatic reconnection.

const minimalEmbed = new URLSearchParams(location.search).get('minimal') === '1' && window.parent !== window;
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
  boardPill: $('#boardPill'),
  routePill: $('#routePill'),
  rttPill: $('#rttPill'),
  hudCmd: $('#hudCmd'),
  toast: $('#toast'),
  hangupBtn: $('#hangupBtn'),
  fullBtn: $('#fullBtn'),
  speed: $('#speed'),
  speedOut: $('#speedOut'),
  selfView: $('#selfView'),
  soundBtn: $('#soundBtn'),
  micBtn: $('#micBtn'),
  camBtn: $('#camBtn'),
  shareBtn: $('#shareBtn'),
  robotMicPill: $('#robotMicPill'),
};

let localStream = null;  // this laptop's camera and microphone, sent to the robot
let screenTrack = null;  // the shared screen, sent instead of the camera while sharing
let mediaNote = null;    // why they could not (all) be started, shown once in the call
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
let platformReady = false;
let activeSession = null;
let creatingSession = false;
let boardReady = false;
let driveLease = null;
let latestChallenge = null;
let challengeAt = 0;
let commandSeq = 0;
let leaseDeadline = 0;
let requestControlPending = false;
let controlGeneration = 0;
let mediaRetry = null;
const frameWatch = new RobotSafety.FrameWatch();

function resetControl(reason = 'کنترل غیرفعال است') {
  controlGeneration++;
  if (conn?.open) conn.send({ t: 'cmd', c: 'S' });
  driveLease = null; latestChallenge = null; leaseDeadline = 0;
  pad.setEnabled(false); showCmd('S');
  document.querySelector('#controlState').textContent = reason;
  document.querySelector('#claimControl').disabled = !activeSession?.canDrive || !Platform.connected || !boardReady || !frameWatch.fresh;
}
function releaseControl(reason) {
  resetControl(reason);
  if (activeSession) Platform.api(`/sessions/${activeSession.id}/release`, { method: 'POST' }).catch(() => {});
}
Platform.on('control:revoked', m => resetControl(m.reason));
Platform.on('disconnected', () => resetControl('ارتباط سرور قطع است'));
Platform.on('session:ended', m => { activeSession = null; hangUp(m.reason); });
Platform.on('expired', () => { platformReady = false; hangUp('دوباره وارد حساب شوید.'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseControl('برای ادامه، کنترل را دوباره بگیرید'); });
window.addEventListener('blur', () => releaseControl('پنجره کنترل فعال نیست'));

function watchVideo() {
  if (typeof els.remote.requestVideoFrameCallback === 'function') {
    const frame = (_, meta) => { frameWatch.frame(meta.presentedFrames); els.remote.requestVideoFrameCallback(frame); };
    els.remote.requestVideoFrameCallback(frame);
  } else {
    setInterval(() => { if (!els.remote.paused && els.remote.readyState >= 2) frameWatch.frame(els.remote.getVideoPlaybackQuality?.().totalVideoFrames ?? els.remote.currentTime); }, 200);
  }
  setInterval(() => {
    const video = frameWatch.fresh && call?.peerConnection?.connectionState === 'connected' && !els.remote.paused;
    const permitted = RobotSafety.canDrive({ link: linkUp, server: Platform.connected, board: boardReady, video, lease: driveLease && performance.now() < leaseDeadline, visible: !document.hidden && document.hasFocus() });
    pad.setEnabled(permitted);
    document.querySelector('#claimControl').disabled = !!driveLease || requestControlPending || !activeSession?.canDrive || !linkUp || !Platform.connected || !boardReady || !video;
    if (driveLease && !permitted) releaseControl('حرکت متوقف شد؛ وضعیت تصویر یا اتصال را بررسی کنید');
    document.querySelector('#videoHealth').textContent = video ? 'تصویر زنده' : 'تصویر آماده نیست — حرکت قفل است';
  }, 200);
  setInterval(async () => {
    if (!activeSession || !driveLease) return;
    try { await Platform.socketRequest('control:renew', activeSession.id); if (driveLease) leaseDeadline = performance.now() + 2000; }
    catch (e) { resetControl(e.message); }
  }, 800);
}
document.querySelector('#claimControl').onclick = async () => {
  if (!activeSession || requestControlPending) return;
  requestControlPending = true;
  const generation = controlGeneration;
  const session = activeSession;
  try {
    await Platform.socketRequest('session:join', activeSession.id);
    const lease = await Platform.api(`/sessions/${session.id}/control`, { method: 'POST' });
    if (generation !== controlGeneration || activeSession !== session || document.hidden || !document.hasFocus() || !frameWatch.fresh || !boardReady) {
      Platform.api(`/sessions/${session.id}/release`, { method: 'POST' }).catch(() => {});
      return;
    }
    driveLease = lease;
    leaseDeadline = performance.now() + 2000; commandSeq = 0;
    document.querySelector('#controlState').textContent = 'کنترل در اختیار شماست؛ دکمه را نگه دارید';
  } catch (e) { resetControl(e.message); }
  finally { requestControlPending = false; }
};
document.querySelector('#stopBtn').onclick = () => releaseControl('توقف؛ برای ادامه دوباره کنترل بگیرید');
watchVideo();

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
const operatorWorkspaces = ['university', 'hospital', 'office', 'mall', 'museum', 'legacy'];
const operatorWorkspace = operatorWorkspaces.includes(params.get('workspace')) ? params.get('workspace') : '';
const operatorMode = ['welcome', 'telepresence'].includes(params.get('mode')) ? params.get('mode') : '';
function ignoresViewFilters() {
  return Platform.user?.username === 'guest' && !!Platform.user.robotId;
}
function robotQuery() {
  const query = new URLSearchParams();
  if (!ignoresViewFilters()) {
    if (operatorWorkspace) query.set('workspace', operatorWorkspace);
    if (operatorMode) query.set('mode', operatorMode);
  }
  return '/robots' + (query.size ? '?' + query.toString() : '');
}
function visibleRobots(robots) {
  if (ignoresViewFilters()) return robots;
  return robots.filter(robot => (!operatorWorkspace || (robot.workspaceId || 'legacy') === operatorWorkspace) && (!operatorMode || robot.mode === operatorMode));
}
try { els.serialInput.value = params.get('serial') || localStorage.getItem('lastRobot') || ''; } catch {}

els.joinForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!platformReady || !Platform.connected) { showJoinError('ابتدا وارد شوید و اتصال سرور را بررسی کنید.'); return; }
  if (document.querySelector('#preflight').hidden) { showJoinError('ابتدا دوربین و میکروفن را بررسی کنید.'); return; }
  serial = normalizeSerial(els.serialInput.value);
  if (!isValidSerial(serial)) {
    showJoinError('That does not look like a serial number. Copy it exactly as shown on the robot screen.');
    return;
  }
  try { localStorage.setItem('lastRobot', serial); } catch {}
  showJoinError(null);
  els.joinBtn.disabled = true;
  els.joinBtn.textContent = 'Starting camera…';
  await startLocalMedia();
  els.joinBtn.textContent = 'Finding robot…';
  wantConnected = true;
  everConnected = false;
  attempt = 0;
  connect();
};

// Camera and microphone. Either may be missing or blocked; the call still
// works, the robot just gets less.
async function startLocalMedia() {
  if (localStream) return;
  const video = { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } };
  mediaNote = null;
  if (!navigator.mediaDevices?.getUserMedia) {
    mediaNote = window.isSecureContext
      ? 'دوربین و میکروفن در این مرورگر در دسترس نیستند؛ از مرورگر به‌روز با پشتیبانی تماس تصویری استفاده کنید.'
      : 'برای دوربین و میکروفن، صفحه را از لینک HTTPS باز کنید؛ روی لپ‌تاپ ربات می‌توانید از localhost استفاده کنید.';
    updateMediaButtons();
    return;
  }
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video, audio: MIC });
  } catch {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: MIC });
      mediaNote = 'Camera not available: the robot hears you but cannot see you.';
    } catch {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video });
        mediaNote = 'Microphone not available: the robot sees you but cannot hear you.';
      } catch {
        localStream = null;
        mediaNote = 'Camera and microphone not available: the robot cannot see or hear you.';
      }
    }
  }
  updateMediaButtons();
}

function stopLocalMedia() {
  stopScreenShare();
  if (localStream) localStream.getTracks().forEach((t) => t.stop());
  localStream = null;
  els.selfView.srcObject = null;
  els.selfView.hidden = true;
}

const ICONS = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5.1 2.1M19 10a7 7 0 0 1-1.2 3.9M5 10a7 7 0 0 0 11.2 5.6M12 17v5M3 3l18 18"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"/></svg>',
  camOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l4.55-2.28A1 1 0 0 1 21 8.62v6.76a1 1 0 0 1-1.45.9L15 14M13 18H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M9 6h4a2 2 0 0 1 2 2v4M3 3l18 18"/></svg>',
  screen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M12 13V7M9 10l3-3 3 3"/></svg>',
};

// Mute buttons switch the tracks off without ending the call
function updateMediaButtons() {
  const mic = localStream && localStream.getAudioTracks()[0];
  const cam = localStream && localStream.getVideoTracks()[0];
  els.micBtn.hidden = !mic;
  els.camBtn.hidden = !cam || !!screenTrack;
  els.shareBtn.hidden = !navigator.mediaDevices?.getDisplayMedia; // unavailable on some browsers and phones
  els.shareBtn.innerHTML = ICONS.screen;
  els.shareBtn.classList.toggle('sharing', !!screenTrack);
  els.shareBtn.title = screenTrack ? 'Stop sharing your screen' : 'Share your screen with the robot';
  if (mic) {
    els.micBtn.innerHTML = mic.enabled ? ICONS.mic : ICONS.micOff;
    els.micBtn.classList.toggle('off', !mic.enabled);
    els.micBtn.title = mic.enabled ? 'Mute microphone' : 'Unmute microphone';
  }
  if (cam) {
    els.camBtn.innerHTML = cam.enabled ? ICONS.cam : ICONS.camOff;
    els.camBtn.classList.toggle('off', !cam.enabled);
    els.camBtn.title = cam.enabled ? 'Turn camera off' : 'Turn camera on';
  }

  // Self view shows what the robot sees: the screen while sharing, else the camera
  const shown = screenTrack || (cam && cam.enabled ? cam : null);
  const current = els.selfView.srcObject && els.selfView.srcObject.getVideoTracks()[0];
  if (shown && shown !== current) els.selfView.srcObject = new MediaStream([shown]);
  els.selfView.hidden = !shown;
  els.selfView.classList.toggle('screen', !!screenTrack);
}

els.micBtn.onclick = () => {
  const mic = localStream && localStream.getAudioTracks()[0];
  if (mic) mic.enabled = !mic.enabled;
  updateMediaButtons();
};
els.camBtn.onclick = () => {
  const cam = localStream && localStream.getVideoTracks()[0];
  if (cam) cam.enabled = !cam.enabled;
  updateMediaButtons();
};

// ---------- Screen sharing ----------
//
// The shared screen replaces the camera on the robot's display. When sharing
// stops (our button or the browser's own "Stop sharing" bar), the camera
// comes back.

// What we send the robot: our microphone, plus the screen or the camera
function outgoingStream() {
  const tracks = localStream ? localStream.getAudioTracks() : [];
  const video = screenTrack || (localStream && localStream.getVideoTracks()[0]);
  if (video) tracks.push(video);
  return tracks.length ? new MediaStream(tracks) : undefined;
}

async function startScreenShare() {
  let display;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
  } catch {
    return; // picker cancelled
  }
  screenTrack = display.getVideoTracks()[0];
  screenTrack.contentHint = 'detail'; // keep text sharp rather than smooth
  screenTrack.onended = stopScreenShare;
  await sendVideo(screenTrack);
  if (conn && conn.open) conn.send({ t: 'screen', on: true });
  updateMediaButtons();
  toast('Sharing your screen with the robot');
}

function stopScreenShare() {
  if (!screenTrack) return;
  const t = screenTrack;
  screenTrack = null;
  t.onended = null;
  t.stop();
  sendVideo(localStream && localStream.getVideoTracks()[0]);
  if (conn && conn.open) conn.send({ t: 'screen', on: false });
  updateMediaButtons();
}

// Swap the video we send without renegotiating. Without a camera there is no
// video slot in the call yet, so the robot is asked to call again instead.
async function sendVideo(track) {
  const pc = call && call.peerConnection;
  const slot = pc && pc.getTransceivers().find((tr) =>
    tr.receiver.track.kind === 'video' && /send/.test(tr.currentDirection || ''));
  if (slot && track) {
    await slot.sender.replaceTrack(track);
  } else if (conn && conn.open) {
    conn.send({ t: 'recall' });
  }
}

els.shareBtn.onclick = () => (screenTrack ? stopScreenShare() : startScreenShare());

// Legacy serial-only invitations retain their existing preflight flow. Scoped
// workspace launch links never start a connection automatically.
const invited = normalizeSerial(params.get('serial'));
if (isValidSerial(invited)) {
  $('#joinTitle').textContent = `Connecting to robot ${invited}`;
  $('#joinHint').textContent = 'You were invited to drive this robot.';
  if (!minimalEmbed && !operatorWorkspace && !operatorMode) setTimeout(() => els.joinForm.requestSubmit(), 0);
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
  resetControl();
  clearTimeout(mediaRetry);
  const ended = activeSession; activeSession = null;
  if (ended) Platform.api(`/sessions/${ended.id}`, { method: 'DELETE' }).catch(() => {});
  closeLink();
  if (peer) { peer.destroy(); peer = null; }
  stopLocalMedia();
  els.remote.srcObject = null;
  els.soundBtn.hidden = true;
  els.rttPill.hidden = true;
  els.boardPill.hidden = true;
  els.robotMicPill.hidden = true;
  els.routePill.hidden = true;
  showCmd('S');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  els.call.hidden = true;
  els.join.hidden = false;
  els.joinBtn.disabled = false;
  els.joinBtn.textContent = 'Connect';
  showJoinError(error);
  if (minimalEmbed) window.parent.postMessage({ type: 'organization:robot-ended', error: error || '' }, location.origin);
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

async function connect() {
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
  if (creatingSession) return;
  if (!activeSession) {
    creatingSession = true;
    try {
      const robots = await Platform.api(robotQuery());
      const robot = robots.find(r => r.serial === serial);
      if (!robot) throw new Error('این ربات برای حساب شما قابل دسترسی نیست.');
      const session = await Platform.api('/sessions', { method: 'POST', body: { robotId: robot.id, peerId: userPeerId() } });
      if (!wantConnected) { Platform.api(`/sessions/${session.id}`, { method: 'DELETE' }).catch(() => {}); return; }
      activeSession = session;
      await Platform.socketRequest('session:join', activeSession.id);
    } catch (e) { hangUp(e.message); return; }
    finally { creatingSession = false; }
  }
  if (!wantConnected || !activeSession || !peer?.open) return;
  const c = peer.connect(robotPeerId(serial), { serialization: 'json', reliable: true, metadata: { id: activeSession.id, secret: activeSession.secret } });
  conn = c;

  clearTimeout(openTimer);
  openTimer = setTimeout(() => {
    if (c !== conn || c.open) return;
    // The robot was found but no link came up: without a relay, retrying won't help
    if (!everConnected && !hasRelay()) hangUp(NO_PATH_HELP);
    else linkDown(hasRelay() ? 'The robot did not answer in time.' : NO_PATH_HELP);
  }, 15000);

  // ICE failure = no network path between the laptops
  const dataPc = c.peerConnection;
  if (dataPc) {
    dataPc.addEventListener('iceconnectionstatechange', () => {
      if (c !== conn || !wantConnected || dataPc.iceConnectionState !== 'failed') return;
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
    if (screenTrack) c.send({ t: 'screen', on: true }); // still sharing after a reconnect
    resetControl('تماس برقرار است؛ پس از دریافت تصویر کنترل را بگیرید');
    Platform.socketRequest('session:join', activeSession.id).catch(() => {});
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
  try { await loadPrivateIce(); } catch (e) { hangUp(e.message); return; }
  if (peer) peer.destroy();
  const p = createPeer(userPeerId());
  peer = p;

  // Also fires after a matchmaking reconnect; only dial if the link is down
  p.on('open', () => { if (p === peer && !linkUp) connect(); });

  // The robot calls us with its video and sound once the control channel is
  // open; we answer with our own camera and microphone
  p.on('call', async (incoming) => {
    if (p !== peer || !wantConnected || incoming.peer !== robotPeerId(serial) || !activeSession) { incoming.close(); return; }
    const session = activeSession;
    try { await Platform.api(`/sessions/${session.id}/media-verify`, { method: 'POST', body: { proof: incoming.metadata?.proof } }); }
    catch { incoming.close(); return; }
    if (session !== activeSession || !wantConnected || p !== peer) { incoming.close(); return; }
    releaseControl('تصویر در حال اتصال است'); frameWatch.reset();
    const previousCall = call;
    call = incoming;
    if (previousCall) previousCall.close();
    incoming.answer(outgoingStream());
    incoming.on('stream', (stream) => {
      if (incoming !== call) return;
      els.remote.srcObject = stream;
      playWithSound(els.remote, els.soundBtn);
    });
    const mediaPc = incoming.peerConnection;
    mediaPc?.addEventListener('connectionstatechange', () => {
      if (incoming !== call || session !== activeSession || p !== peer || !wantConnected) return;
      if (mediaPc.connectionState === 'connected' && incoming.peerConnection === mediaPc) showRoute(mediaPc, incoming);
      else {
        releaseControl('تصویر قطع شد'); frameWatch.reset();
        if (['failed', 'disconnected'].includes(mediaPc.connectionState)) retryVideo();
      }
    });
    incoming.on('close', () => { if (incoming === call && wantConnected) { frameWatch.reset(); releaseControl('تماس تصویری قطع شد'); retryVideo(); } });
    incoming.on('error', () => { if (incoming === call) { frameWatch.reset(); releaseControl('خطای تماس تصویری'); retryVideo(); } });
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
        if (activeSession) { hangUp('شناسه تماس در پنجره دیگری استفاده می‌شود؛ دوباره وصل شوید.'); break; }
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
  resetControl('ارتباط در حال بازیابی است');
  frameWatch.reset(); boardReady = false;
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
  updateMediaButtons();
  if (mediaNote) toast(mediaNote);
}

function showOverlay(html) {
  els.waitingText.textContent = String(html).replace(/<br\s*\/?\s*>/g, '\n').replace(/<\/?small>/g, '');
  els.waiting.hidden = false;
}

els.remote.addEventListener('playing', () => {
  if (linkUp) els.waiting.hidden = true;
});

async function showRoute(pc, mediaCall) {
  try {
    const stats = await pc.getStats();
    if (mediaCall !== call || mediaCall.peerConnection !== pc || !wantConnected) return;
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
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'challenge':
      if (driveLease && msg.lease === driveLease.id) { latestChallenge = msg.challenge; challengeAt = performance.now(); }
      break;
    case 'control-revoked': resetControl(msg.reason); break;
    case 'denied': hangUp('مجوز تماس پذیرفته نشد. دوباره وارد شوید.'); break;
    case 'pong': {
      const rtt = Math.round(performance.now() - msg.ts);
      els.rttPill.hidden = false;
      els.rttPill.textContent = `${rtt} ms`;
      break;
    }
    case 'status':
      boardReady = msg.board === true;
      if (!boardReady) releaseControl('Arduino آماده نیست');
      els.boardPill.hidden = false;
      els.boardPill.textContent = msg.board ? 'Arduino connected' : 'Simulation (no Arduino)';
      els.boardPill.className = `pill ${msg.board ? 'hw' : 'sim'}`;
      els.robotMicPill.hidden = msg.mic !== false;
      break;
    case 'board':
      toast(`Arduino: ${msg.line}`);
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
  if (cmd !== 'S' && (!driveLease || !frameWatch.fresh || !boardReady || !Platform.connected || performance.now() > leaseDeadline || performance.now() - challengeAt > 400 || document.hidden || !document.hasFocus())) return;
  if (conn && conn.open) conn.send({ t: 'cmd', c: cmd, v: Number(els.speed.value), lease: driveLease?.id, seq: ++commandSeq, challenge: latestChallenge });
  showCmd(cmd);
}

let shownCmd = null;
function showCmd(cmd) {
  if (cmd === shownCmd) return;
  shownCmd = cmd;
  els.hudCmd.dataset.cmd = cmd;
  els.hudCmd.textContent = COMMANDS[cmd].toUpperCase();
}

els.speed.oninput = () => (els.speedOut.value = els.speed.selectedOptions[0].textContent);

function retryVideo() {
  clearTimeout(mediaRetry);
  mediaRetry = setTimeout(() => { if (wantConnected && conn?.open) conn.send({ t: 'recall' }); }, 2000);
}
Platform.on('connected', () => {
  if (activeSession) Platform.socketRequest('session:join', activeSession.id).catch(() => {});
  refreshRobots().catch(() => {});
});
Platform.on('robots', robots => renderRobots(robots));
function renderRobots(robots) {
  const select = document.querySelector('#robotSelect');
  const list = visibleRobots(robots);
  const enteredSerial = normalizeSerial(els.serialInput.value);
  const selected = enteredSerial || select.value;
  select.replaceChildren(new Option('انتخاب ربات', ''));
  for (const r of list) select.add(new Option(`${r.name} · ${r.location} · ${r.online ? r.busy ? 'مشغول' : 'آنلاین' : 'آفلاین'}`, r.serial));
  select.value = list.some(r => r.serial === selected) ? selected : '';
  if (enteredSerial && !list.some(r => r.serial === enteredSerial)) els.serialInput.value = '';
}
async function refreshRobots() { if (platformReady) renderRobots(await Platform.api(robotQuery())); }
document.querySelector('#robotSelect').onchange = e => { if (e.target.value) els.serialInput.value = e.target.value; };
document.querySelector('#checkMedia').onclick = async () => {
  await startLocalMedia();
  const preflight = document.querySelector('#preflight'); preflight.hidden = false;
  document.querySelector('#mediaPreview').srcObject = localStream;
  document.querySelector('#mediaSummary').textContent = mediaNote || 'دوربین و میکروفن آماده‌اند';
};
const userAuth = document.querySelector('#userAuth');
async function userReady(u) {
  if (!['admin', 'operator'].includes(u.role)) throw new Error('این حساب مجوز تماس ندارد.');
  platformReady = true; document.querySelector('#joinForm').hidden = false;
  userAuth.hidden = true; await refreshRobots();
}
const inviteToken = new URLSearchParams(location.hash.slice(1)).get('invite');
if (minimalEmbed) {
  document.body.classList.add('minimal-call');
  const end = document.createElement('button'); end.className = 'minimal-end'; end.textContent = 'قطع تماس'; end.onclick = () => hangUp(); document.body.append(end);
  const status = document.createElement('p'); status.className = 'minimal-status'; status.textContent = 'در حال اتصال به ربات…'; document.body.append(status);
  let received = false;
  window.addEventListener('message', async e => {
    if (received || e.source !== window.parent || e.origin !== location.origin || e.data?.type !== 'organization:robot-auth') return;
    received = true;
    try {
      const u = await Platform.acceptHandoff(e.data.auth);
      await userReady(u);
      if (!Platform.connected) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('اتصال سرور آماده نیست.')), 12000);
        Platform.on('connected', () => { clearTimeout(timer); resolve(); });
      });
      els.serialInput.value = invited;
      await document.querySelector('#checkMedia').onclick();
      els.joinForm.requestSubmit(); status.hidden = true;
    } catch (error) { hangUp(error.message); }
  });
} else if (inviteToken) {
  history.replaceState(null, '', location.pathname);
  Platform.redeem(inviteToken).then(userReady).catch(e => { showJoinError(e.message); Platform.loginForm(userAuth, userReady, ['admin', 'operator']); });
} else Platform.loginForm(userAuth, userReady, ['admin', 'operator']);
document.querySelector('#userLogout').onclick = () => { hangUp(); Platform.logout().finally(() => location.reload()); };

let toastTimer = null;
function toast(text) {
  els.toast.textContent = text;
  els.toast.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.style.opacity = 0), 2500);
}

window.addEventListener('pagehide', () => {
  if (conn && conn.open) conn.send({ t: 'cmd', c: 'S' });
  if (activeSession) Platform.api(`/sessions/${activeSession.id}`, { method: 'DELETE', keepalive: true }).catch(() => {});
  if (peer) peer.destroy();
});
