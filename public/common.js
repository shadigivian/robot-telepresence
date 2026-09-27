// Shared helpers for robot.html and user.html

// Movement commands shared by both apps and the ESP32 sketch
const COMMANDS = {
  F: 'Forward',
  B: 'Backward',
  L: 'Left',
  R: 'Right',
  S: 'Stop',
};

// Liveness: each side pings every second. If nothing is heard for this
// long, the link is treated as dead and a reconnect starts.
const PING_MS = 1000;
const LINK_TIMEOUT_MS = 6000;

// ---------- Peer (matchmaking + WebRTC) ----------

function normalizeSerial(s) {
  return String(s || '').trim().toUpperCase().replace(/\s+/g, '');
}

function isValidSerial(s) {
  return /^[A-Z0-9](?:[A-Z0-9-]{1,30})[A-Z0-9]$/.test(s);
}

function robotPeerId(serial) {
  return CONFIG.idPrefix + normalizeSerial(serial);
}

// STUN + any TURN relays from config.js (fetched once at startup)
let ICE_SERVERS = [...CONFIG.iceServers, ...CONFIG.turnServers];
const iceReady = (async () => {
  if (!CONFIG.turnCredentialsUrl) return;
  try {
    const res = await fetch(CONFIG.turnCredentialsUrl);
    const list = await res.json();
    if (!Array.isArray(list)) throw new Error('unexpected response');
    ICE_SERVERS = [...CONFIG.iceServers, ...CONFIG.turnServers, ...list];
  } catch (err) {
    console.warn('Could not load TURN credentials from turnCredentialsUrl:', err);
  }
})();

function hasRelay() {
  return ICE_SERVERS.some((s) => [].concat(s.urls).some((u) => /^turns?:/.test(u)));
}

const NO_PATH_HELP = 'The two networks cannot connect directly (common with phone hotspots and mobile data). ' +
  'Add a relay (TURN) server in public/config.js on both laptops. See the README.';

// id: fixed peer id, or undefined to get a random one from the server
function createPeer(id) {
  return new Peer(id, {
    ...CONFIG.peerServer,
    config: {
      iceServers: ICE_SERVERS,
      iceTransportPolicy: CONFIG.relayOnly ? 'relay' : 'all',
    },
    pingInterval: 5000,
    debug: 1,
  });
}

// Keep the screen (and the laptop) awake while the app is open
function keepAwake() {
  if (!('wakeLock' in navigator)) return;
  const request = () => {
    if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {});
  };
  document.addEventListener('visibilitychange', request);
  request();
}

function $(sel) { return document.querySelector(sel); }

function setStatus(el, text, state) {
  el.textContent = text;
  el.dataset.state = state; // idle | wait | ok | error
}

function logLine(listEl, text, kind = '') {
  const li = document.createElement('li');
  li.className = kind;
  const t = new Date().toLocaleTimeString([], { hour12: false });
  li.innerHTML = `<time>${t}</time><span></span>`;
  li.querySelector('span').textContent = text;
  listEl.prepend(li);
  while (listEl.children.length > 60) listEl.lastChild.remove();
}

// ---------- Controls ----------

const ARROW = {
  F: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  B: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  L: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  R: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
};

// How often a held direction is re-sent. The ESP32 stops the motors if it
// hears nothing for 500 ms, so a dropped connection can never leave the
// robot driving on its own.
const REPEAT_MS = 150;

// Builds a D-pad inside `el` and wires press-and-hold behaviour.
// onCommand(cmd) is called on press, repeatedly while held, and with 'S' on release.
// Set listenKeys to bind arrows / WASD / Space as well.
function createDpad(el, onCommand, { listenKeys = true } = {}) {
  el.classList.add('dpad');
  el.innerHTML = ['F', 'L', 'S', 'R', 'B'].map((c) =>
    `<button type="button" data-cmd="${c}" aria-label="${COMMANDS[c]}" title="${COMMANDS[c]}">${c === 'S' ? 'STOP' : ARROW[c]}</button>`
  ).join('');

  let held = null;
  let timer = null;

  const press = (cmd) => {
    if (held === cmd) return;
    release(false);
    held = cmd;
    highlight(el, cmd);
    onCommand(cmd);
    if (cmd !== 'S') timer = setInterval(() => onCommand(cmd), REPEAT_MS);
  };
  const release = (sendStop = true) => {
    if (held === null) return;
    clearInterval(timer);
    timer = null;
    const wasMoving = held !== 'S';
    held = null;
    highlight(el, null);
    if (sendStop && wasMoving) onCommand('S');
  };

  el.querySelectorAll('button').forEach((btn) => {
    const cmd = btn.dataset.cmd;
    btn.addEventListener('pointerdown', (e) => {
      if (btn.disabled) return;
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      press(cmd);
    });
    btn.addEventListener('pointerup', () => release());
    btn.addEventListener('pointercancel', () => release());
    btn.addEventListener('lostpointercapture', () => release());
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  if (listenKeys) {
    const KEYS = {
      ArrowUp: 'F', KeyW: 'F', ArrowDown: 'B', KeyS: 'B',
      ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', Space: 'S',
    };
    window.addEventListener('keydown', (e) => {
      const cmd = KEYS[e.code];
      if (!cmd || e.target.matches('input, select, textarea')) return;
      if (el.querySelector('button').disabled) return;
      e.preventDefault();
      if (e.repeat) return;
      press(cmd);
    });
    window.addEventListener('keyup', (e) => {
      if (KEYS[e.code] && KEYS[e.code] === held) release();
    });
    window.addEventListener('blur', () => release());
  }

  return {
    setEnabled(on) {
      el.querySelectorAll('button').forEach((b) => (b.disabled = !on));
      if (!on) release(false);
    },
    release,
  };
}

function highlight(el, cmd) {
  el.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.cmd === cmd));
}
