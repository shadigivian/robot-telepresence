'use strict';
const crypto = require('node:crypto');
const { Server } = require('socket.io');
const { Store, passwordHash, checkPassword } = require('./store');
const { Problem, ensure, text, id, validateDirectory, publicDirectory, searchDirectory, planRoute } = require('./domain');
const { LEGACY, emptyDirectory, workspaceIdOf, workspace, summaries } = require('./workspaces');
const token = () => crypto.randomBytes(32).toString('base64url');
const safeUser = ({ password, ...u }) => u;

function createService(server, { filename, origins = [], now = Date.now } = {}) {
  const store = new Store(filename);
  const auth = new Map(), sessions = new Map(), leases = new Map(), presence = new Map(), invites = new Map(), rates = new Map();
  const allowedOrigin = (origin, host) => !origin || origins.includes(origin) || origin === `http://${host}` || origin === `https://${host}`;
  const io = new Server(server, { maxHttpBufferSize: 16384, cors: { origin: origins, credentials: false }, allowRequest: (req, cb) => cb(null, allowedOrigin(req.headers.origin, req.headers.host)) });
  const requireAuth = value => {
    const a = auth.get(value);
    ensure(a && a.expires > now(), 'جلسه ورود منقضی شده؛ دوباره وارد شوید.', 401);
    const user = a.guest ? a.user : store.data.users.find(u => u.id === a.user.id && u.active);
    ensure(user, 'حساب غیرفعال شده است.', 401);
    return { ...a, user: a.device ? { ...user, role: 'robot', robotId: a.device } : user };
  };
  function issue(user, options = {}) {
    const t = token();
    const a = { user: safeUser(user), expires: now() + 8 * 3600000, ...options };
    auth.set(t, a);
    return { token: t, user: a.device ? { ...a.user, role: 'robot', robotId: a.device } : a.user, expires: a.expires };
  }
  const role = (a, ...roles) => ensure(roles.includes(a.user.role), 'دسترسی مجاز نیست.', 403);
  const ownRobot = (a, robotId) => { role(a, 'robot'); ensure(a.user.robotId === robotId, 'این حساب متعلق به ربات دیگری است.', 403); };
  const getRobot = robotId => { const r = store.data.robots.find(r => r.id === robotId && r.active); ensure(r, 'ربات یافت نشد.', 404); return { ...r, workspaceId: workspaceIdOf(r) }; };
  function selectedWorkspace(a, url) {
    const requested = url.searchParams.has('workspace') ? workspace(store.data, url.searchParams.get('workspace')).id : null;
    if (a.user.role === 'robot' || a.guest) {
      const bound = workspaceIdOf(getRobot(a.user.robotId));
      ensure(!requested || requested === bound, 'این حساب به فضای کاری دیگری وابسته است.', 403);
      return workspace(store.data, bound);
    }
    return workspace(store.data, requested || LEGACY);
  }
  const live = robotId => { const p = presence.get(robotId); return p && now() - p.at < 4500 ? p : null; };
  function broadcastRobots() {
    for (const socket of io.sockets.sockets.values()) {
      try { const a = requireAuth(socket.handshake.auth.token); if (['admin', 'operator'].includes(a.user.role)) socket.emit('robots', robotList(a)); } catch {}
    }
  }
  function robotList(a, workspaceId, mode) {
    return store.data.robots.filter(r => r.active && (!a.guest || a.user.robotId === r.id) &&
      (!workspaceId || workspaceIdOf(r) === workspaceId) && (!mode || r.mode === mode)).map(r => ({ ...r, workspaceId: workspaceIdOf(r), online: !!live(r.id)?.state.online, board: !!live(r.id)?.state.board, camera: !!live(r.id)?.state.camera, busy: [...sessions.values()].some(s => s.robotId === r.id && s.expires > now()) }));
  }
  function revoke(robotId, reason = 'کنترل آزاد شد') {
    const lease = leases.get(robotId);
    leases.delete(robotId);
    io.to(`robot:${robotId}`).emit('control:revoked', { reason });
    if (lease) io.to(`session:${lease.sessionId}`).emit('control:revoked', { reason });
  }
  function endSession(s, reason) {
    if (leases.get(s.robotId)?.sessionId === s.id) revoke(s.robotId, reason);
    sessions.delete(s.id);
    io.to(`session:${s.id}`).emit('session:ended', { reason });
    io.to(`robot:${s.robotId}`).emit('session:ended', { id: s.id, reason });
    broadcastRobots();
  }
  function sessionFor(a, sessionId, robot = false) {
    const s = sessions.get(sessionId);
    ensure(s && s.expires > now(), 'جلسه تماس منقضی شده است.', 404);
    if (robot) ownRobot(a, s.robotId);
    else ensure(s.authToken === a.authToken, 'این جلسه متعلق به شما نیست.', 403);
    return s;
  }
  io.use((socket, next) => {
    try { requireAuth(socket.handshake.auth?.token); next(); } catch { next(new Error('ورود لازم است')); }
  });
  io.on('connection', socket => {
    const a = requireAuth(socket.handshake.auth.token);
    socket.join(`user:${a.user.id}`);
    if (a.user.role === 'robot') socket.join(`robot:${a.user.robotId}`);
    if (['admin', 'operator'].includes(a.user.role)) socket.emit('robots', robotList(a));
    socket.on('robot:state', (state, cb = () => {}) => {
      try {
        const a = requireAuth(socket.handshake.auth.token); ownRobot(a, a.user.robotId); getRobot(a.user.robotId);
        const previous = presence.get(a.user.robotId);
        ensure(!previous || previous.socketId === socket.id || now() - previous.at >= 4500, 'ربات در پنجره دیگری فعال است.', 409);
        ensure(state && typeof state.online === 'boolean' && typeof state.board === 'boolean' && typeof state.camera === 'boolean', 'وضعیت نامعتبر');
        presence.set(a.user.robotId, { at: now(), socketId: socket.id, state: { online: state.online, board: state.board, camera: state.camera } });
        if (!state.online || !state.board || !state.camera) revoke(a.user.robotId, 'ربات آماده حرکت نیست');
        cb({ ok: true }); broadcastRobots();
      } catch (e) { cb({ error: e.message }); }
    });
    socket.on('session:join', (sessionId, cb = () => {}) => {
      try { const a = { ...requireAuth(socket.handshake.auth.token), authToken: socket.handshake.auth.token }; const s = sessionFor(a, sessionId); s.socketId = socket.id; s.disconnectedAt = null; socket.join(`session:${sessionId}`); cb({ ok: true }); } catch (e) { cb({ error: e.message }); }
    });
    socket.on('control:renew', (sessionId, cb = () => {}) => {
      try {
        const a = { ...requireAuth(socket.handshake.auth.token), authToken: socket.handshake.auth.token };
        const s = sessionFor(a, sessionId);
        ensure(s.socketId === socket.id, 'این پنجره صاحب کنترل نیست.', 403);
        const l = leases.get(s.robotId);
        ensure(l && l.sessionId === s.id && l.expires > now() && live(s.robotId)?.state.online, 'کنترل منقضی شد؛ دوباره درخواست کنید.', 409);
        l.expires = now() + 3000;
        io.to(`robot:${s.robotId}`).emit('control:lease', l);
        cb({ ok: true, expires: l.expires });
      } catch (e) { cb({ error: e.message }); }
    });
    socket.on('disconnect', () => {
      const robotId = a.user.robotId;
      if (a.user.role === 'robot' && presence.get(robotId)?.socketId === socket.id) { presence.delete(robotId); revoke(robotId, 'ارتباط سرور ربات قطع شد'); }
      for (const s of sessions.values()) if (s.socketId === socket.id) { s.disconnectedAt = now(); revoke(s.robotId, 'ارتباط اپراتور قطع شد'); }
      broadcastRobots();
    });
  });
  function publishVisit(v) { io.to(`user:${v.recipientId}`).emit('visit', v); io.to(`visit:${v.id}`).emit('visit', { id: v.id, status: v.status, response: v.response, updatedAt: v.updatedAt }); }
  function limit(key, max = 30, window = 60000) {
    let r = rates.get(key);
    if (!r || r.until <= now()) rates.set(key, r = { until: now() + window, count: 0 });
    ensure(++r.count <= max, 'درخواست‌ها زیاد است؛ کمی صبر کنید.', 429);
  }
  async function body(req) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; ensure(Buffer.byteLength(raw) <= 262144, 'حجم درخواست زیاد است.', 413); }
    try { const parsed = raw ? JSON.parse(raw) : {}; ensure(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'درخواست باید یک شیء JSON باشد.'); return parsed; } catch { throw new Problem(400, 'JSON معتبر نیست.'); }
  }
  async function handle(req, res) {
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { return false; }
    if (!pathname.startsWith('/api/')) return false;
    const origin = req.headers.origin;
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(origin && allowedOrigin(origin, req.headers.host) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) });
      res.end(JSON.stringify(data));
    };
    try {
      ensure(allowedOrigin(origin, req.headers.host), 'مبدأ درخواست مجاز نیست.', 403);
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': origin || '', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', Vary: 'Origin' }); res.end(); return true; }
      limit(`ip:${req.socket.remoteAddress}`, 600);
      const url = new URL(req.url, 'http://localhost');
      const method = req.method;
      if (pathname === '/api/health' && method === 'GET') { send(200, { ok: true, version: 2, initialized: store.data.users.length > 0 }); return true; }
      if (pathname === '/api/login' && method === 'POST') {
        limit(`login:${req.socket.remoteAddress}`, 10);
        const b = await body(req);
        const u = store.data.users.find(u => u.username === b.username && u.active);
        // Use a real hash even for unknown users to keep failure timing comparable.
        const hash = u?.password || dummyHash;
        ensure(checkPassword(b.password, hash) && u, 'نام کاربری یا رمز درست نیست.', 401);
        send(200, issue(u)); return true;
      }
      if (pathname === '/api/invites/redeem' && method === 'POST') {
        limit(`invite:${req.socket.remoteAddress}`, 10);
        const b = await body(req), invite = invites.get(b.token);
        ensure(invite && invite.expires > now(), 'دعوت نامعتبر یا منقضی شده است.', 401);
        invites.delete(b.token); getRobot(invite.robotId);
        send(200, issue({ id: crypto.randomUUID(), username: 'guest', name: 'مهمان', role: 'operator', robotId: invite.robotId, active: true }, { guest: true, canDrive: invite.canDrive, expires: Math.min(invite.expires, now() + 3600000) })); return true;
      }
      const authToken = (req.headers.authorization || '').replace(/^Bearer /, '');
      const a = { ...requireAuth(authToken), authToken };
      if (pathname === '/api/ice' && method === 'GET') {
        let servers = [];
        if (process.env.TURN_SERVERS) servers = JSON.parse(process.env.TURN_SERVERS);
        if (process.env.TURN_CREDENTIALS_URL) {
          const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
          try {
            const remote = await fetch(process.env.TURN_CREDENTIALS_URL, { signal: controller.signal });
            ensure(remote.ok, 'تنظیمات رله در دسترس نیست.', 503);
            const list = await remote.json(); ensure(Array.isArray(list), 'پاسخ تنظیمات رله معتبر نیست.', 503);
            servers = servers.concat(list);
          } finally { clearTimeout(timer); }
        }
        ensure(Array.isArray(servers) && servers.length <= 30, 'تنظیمات ICE معتبر نیست.', 503);
        send(200, { servers }); return true;
      }
      if (pathname === '/api/me' && method === 'GET') { send(200, { user: a.user, expires: a.expires }); return true; }
      if (pathname === '/api/logout' && method === 'POST') {
        auth.delete(authToken);
        for (const s of sessions.values()) if (s.authToken === authToken) endSession(s, 'خروج از حساب');
        for (const socket of io.sockets.sockets.values()) if (socket.handshake.auth.token === authToken) socket.disconnect(true);
        send(200, { ok: true }); return true;
      }
      if (pathname === '/api/device' && method === 'POST') {
        role(a, 'admin'); const b = await body(req); getRobot(b.robotId);
        send(200, issue(a.user, { device: b.robotId })); return true;
      }
      if (pathname === '/api/workspaces' && method === 'GET') { role(a, 'admin', 'operator', 'staff'); ensure(!a.guest, 'دسترسی مجاز نیست.', 403); send(200, summaries(store.data)); return true; }
      if (pathname === '/api/directory' && method === 'GET') { send(200, publicDirectory(selectedWorkspace(a, url).directory)); return true; }
      if (pathname === '/api/search' && method === 'GET') { send(200, searchDirectory(selectedWorkspace(a, url).directory, url.searchParams.get('q') || '')); return true; }
      if (pathname === '/api/route' && method === 'GET') { send(200, planRoute(selectedWorkspace(a, url).directory, url.searchParams.get('from'), url.searchParams.get('room'), url.searchParams.get('accessible') === 'true')); return true; }
      if (pathname === '/api/robots' && method === 'GET') {
        const workspaceId = url.searchParams.has('workspace') ? selectedWorkspace(a, url).id : null;
        const mode = url.searchParams.get('mode');
        ensure(!url.searchParams.has('mode') || ['welcome', 'telepresence'].includes(mode), 'حالت ربات معتبر نیست.');
        send(200, a.user.role === 'robot' ? [getRobot(a.user.robotId)].filter(r => !mode || r.mode === mode) : (role(a, 'admin', 'operator'), robotList(a, workspaceId, mode))); return true;
      }
      if (pathname === '/api/robot/settings' && method === 'POST') {
        role(a, 'robot'); const b = await body(req), r = getRobot(a.user.robotId);
        const directory = workspace(store.data, workspaceIdOf(r)).directory;
        ensure(['welcome', 'telepresence'].includes(b.mode) && (!b.startNodeId || directory.nodes.some(n => n.id === b.startNodeId)), 'حالت یا نقطه شروع معتبر نیست.');
        store.change(d => { const robot = d.robots.find(x => x.id === r.id); robot.mode = b.mode; robot.startNodeId = b.startNodeId || ''; });
        send(200, getRobot(r.id)); return true;
      }
      if (pathname === '/api/invites' && method === 'POST') {
        role(a, 'admin', 'robot'); const b = await body(req), r = getRobot(b.robotId);
        if (a.user.role === 'robot') ownRobot(a, r.id);
        ensure(typeof b.canDrive === 'boolean', 'مجوز حرکت مشخص نیست.');
        const t = token(), expires = now() + 15 * 60000;
        invites.set(t, { robotId: r.id, expires, canDrive: b.canDrive }); send(201, { token: t, expires, robotId: r.id }); return true;
      }
      if (pathname === '/api/invites' && method === 'DELETE') {
        role(a, 'admin', 'robot'); const b = await body(req); if (a.user.role === 'robot') ownRobot(a, b.robotId);
        for (const [t, v] of invites) if (v.robotId === b.robotId) invites.delete(t);
        for (const s of sessions.values()) if (s.robotId === b.robotId && s.guest) endSession(s, 'دعوت لغو شد');
        for (const [t, v] of auth) if (v.guest && v.user.robotId === b.robotId) auth.delete(t);
        send(200, { ok: true }); return true;
      }
      if (pathname === '/api/sessions' && method === 'POST') {
        role(a, 'admin', 'operator'); const b = await body(req), r = getRobot(b.robotId);
        ensure(!a.guest || a.user.robotId === r.id, 'دعوت مربوط به این ربات نیست.', 403);
        ensure(text(b.peerId, 120) && /^[\w-]+$/.test(b.peerId), 'شناسه تماس معتبر نیست.');
        ensure(live(r.id)?.state.online, 'ربات آنلاین نیست.', 409);
        ensure(![...sessions.values()].some(s => s.robotId === r.id && s.expires > now()), 'ربات در اختیار کاربر دیگری است.', 409);
        const s = { id: crypto.randomUUID(), robotId: r.id, peerId: b.peerId, userId: a.user.id, name: a.user.name, guest: !!a.guest, canDrive: !a.guest || a.canDrive, authToken, secret: token(), disconnectedAt: now(), expires: Math.min(a.expires, now() + 3600000) };
        sessions.set(s.id, s); broadcastRobots();
        send(201, { id: s.id, secret: s.secret, expires: s.expires, canDrive: s.canDrive, robot: r }); return true;
      }
      if (pathname === '/api/sessions/verify' && method === 'POST') {
        const b = await body(req), s = sessionFor(a, b.id, true);
        ensure(b.secret === s.secret && b.peerId === s.peerId, 'مجوز تماس نامعتبر است.', 403);
        send(200, { id: s.id, name: s.name, canDrive: s.canDrive, expires: s.expires }); return true;
      }
      const sm = pathname.match(/^\/api\/sessions\/([\w-]+)(?:\/(control|release|media-proof|media-verify))?$/);
      if (sm) {
        const s = sessionFor(a, sm[1], a.user.role === 'robot');
        if (method === 'POST' && sm[2] === 'media-proof') {
          ownRobot(a, s.robotId); s.mediaProof = token(); s.mediaProofExpires = now() + 15000;
          send(201, { proof: s.mediaProof }); return true;
        }
        if (method === 'POST' && sm[2] === 'media-verify') {
          ensure(a.user.role !== 'robot', 'دسترسی مجاز نیست.', 403);
          const b = await body(req);
          ensure(s.mediaProof && s.mediaProofExpires > now() && b.proof === s.mediaProof, 'هویت تماس تصویری تأیید نشد.', 403);
          s.mediaProof = null; send(200, { ok: true }); return true;
        }
        if (method === 'DELETE' && !sm[2]) { endSession(s, 'جلسه پایان یافت'); send(200, { ok: true }); return true; }
        if (method === 'POST' && sm[2] === 'release') { revoke(s.robotId); send(200, { ok: true }); return true; }
        if (method === 'POST' && sm[2] === 'control') {
          ensure(a.user.role !== 'robot' && s.canDrive, 'مجوز حرکت ندارید.', 403);
          const p = live(s.robotId);
          ensure(p?.state.online && p.state.board && p.state.camera, 'ربات برای حرکت آماده نیست.', 409);
          ensure(!leases.has(s.robotId) || leases.get(s.robotId).expires <= now(), 'کنترل قبلاً فعال است.', 409);
          const l = { id: token(), sessionId: s.id, robotId: s.robotId, expires: now() + 3000 };
          leases.set(s.robotId, l); io.to(`robot:${s.robotId}`).emit('control:lease', l); send(201, l); return true;
        }
      }
      if (pathname === '/api/visits' && method === 'POST') {
        role(a, 'robot'); limit(`visit:${a.user.robotId}`, 10);
        const b = await body(req); ensure(text(b.requestId, 80) && id(b.requestId) && text(b.visitor, 80) && text(b.note, 300), 'اطلاعات مراجعه معتبر نیست.');
        const old = store.data.visits.find(v => v.requestId === b.requestId && v.robotId === a.user.robotId);
        if (old) { send(200, { id: old.id, status: old.status, response: old.response }); return true; }
        const robot = getRobot(a.user.robotId), workspaceId = workspaceIdOf(robot), directory = workspace(store.data, workspaceId).directory;
        const p = directory.people.find(p => p.id === b.personId && p.active);
        ensure(p && directory.rooms.some(r => r.id === p.roomId && r.active) && store.data.users.some(u => u.id === p.userId && u.active && ['staff', 'admin'].includes(u.role)), 'برای این مقصد دریافت‌کننده فعال ثبت نشده است.', 409);
        const v = { id: crypto.randomUUID(), requestId: b.requestId, workspaceId, robotId: a.user.robotId, personId: p.id, recipientId: p.userId, destination: p.name, visitor: b.visitor.trim(), note: b.note.trim(), status: 'registered', response: '', createdAt: now(), updatedAt: now(), watchToken: token() };
        store.change(d => d.visits.push(v)); publishVisit(v);
        send(201, { id: v.id, status: v.status, response: v.response, watchToken: v.watchToken }); return true;
      }
      const vm = pathname.match(/^\/api\/visits\/([\w-]+)$/);
      if (vm && method === 'GET') {
        const v = store.data.visits.find(v => v.id === vm[1]); ensure(v && a.user.role === 'robot' && v.robotId === a.user.robotId, 'مراجعه یافت نشد.', 404);
        send(200, { id: v.id, status: v.status, response: v.response, updatedAt: v.updatedAt }); return true;
      }
      if (pathname === '/api/inbox' && method === 'GET') {
        role(a, 'staff', 'admin');
        const workspaceId = url.searchParams.has('workspace') ? workspace(store.data, url.searchParams.get('workspace')).id : null;
        send(200, store.data.visits.filter(v => v.recipientId === a.user.id && (!workspaceId || (v.workspaceId || LEGACY) === workspaceId)).slice(-200).reverse().map(({ watchToken, ...v }) => ({ ...v, workspaceId: v.workspaceId || LEGACY }))); return true;
      }
      if (vm && method === 'POST') {
        role(a, 'staff', 'admin'); const b = await body(req), v = store.data.visits.find(v => v.id === vm[1] && v.recipientId === a.user.id);
        ensure(v, 'مراجعه یافت نشد.', 404); ensure(['delivered', 'seen', 'responded'].includes(b.status), 'وضعیت نامعتبر');
        ensure(text(b.response || '', 300) && (b.status !== 'responded' || (b.response || '').trim()), 'پاسخ معتبر نیست.');
        const rank = { registered: 0, delivered: 1, seen: 2, responded: 3 };
        store.change(d => { const x = d.visits.find(x => x.id === v.id); if (rank[b.status] > rank[x.status] || b.status === 'responded') { x.status = b.status; x.response = b.status === 'responded' ? b.response.trim() : x.response; x.updatedAt = now(); } });
        const updated = store.data.visits.find(x => x.id === v.id); publishVisit(updated); send(200, { ok: true }); return true;
      }
      if (pathname.startsWith('/api/admin/')) role(a, 'admin');
      const importLegacy = pathname.match(/^\/api\/admin\/workspaces\/([\w-]+)\/import-legacy$/);
      if (importLegacy && method === 'POST') {
        const target = workspace(store.data, importLegacy[1]);
        ensure(target.id !== LEGACY, 'مقصد انتقال باید یکی از پنج فضای کاری باشد.');
        const keys = ['floors', 'nodes', 'edges', 'rooms', 'people'];
        ensure(keys.every(key => Array.isArray(target.directory[key]) && target.directory[key].length === 0) && !store.data.robots.some(r => workspaceIdOf(r) === target.id), 'فضای مقصد خالی نیست؛ داده‌های آن جایگزین نمی‌شود.', 409);
        const robotIds = store.data.robots.filter(r => workspaceIdOf(r) === LEGACY).map(r => r.id);
        const legacyVisits = store.data.visits.filter(v => (v.workspaceId || LEGACY) === LEGACY);
        ensure(keys.some(key => store.data.directory[key].length > 0) || robotIds.length > 0 || legacyVisits.length > 0, 'داده‌ای برای انتقال از فضای قبلی وجود ندارد.', 409);
        validateDirectory(store.data.directory);
        store.change(data => {
          data.legacyArchive = { directory: structuredClone(data.directory), robotIds: [...robotIds], workspaceId: target.id, movedAt: now() };
          workspace(data, target.id).directory = data.directory;
          for (const robot of data.robots) if (workspaceIdOf(robot) === LEGACY) robot.workspaceId = target.id;
          for (const visit of data.visits) if ((visit.workspaceId || LEGACY) === LEGACY) visit.workspaceId = target.id;
          data.directory = emptyDirectory('داده‌های قبلی');
        });
        for (const robotId of robotIds) {
          for (const session of [...sessions.values()]) if (session.robotId === robotId) endSession(session, 'فضای کاری ربات تغییر کرد');
          revoke(robotId, 'فضای کاری ربات تغییر کرد');
          presence.delete(robotId);
          io.to(`robot:${robotId}`).emit('robot:changed', store.data.robots.find(r => r.id === robotId));
        }
        io.emit('directory:changed', { workspaceId: LEGACY });
        io.emit('directory:changed', { workspaceId: target.id });
        broadcastRobots();
        send(200, { ok: true, workspace: { id: target.id, name: target.name, category: target.category } }); return true;
      }
      if (pathname === '/api/admin/directory/validate' && method === 'POST') { send(200, validateDirectory(await body(req))); return true; }
      if (pathname === '/api/admin/state' && method === 'GET') {
        const selected = selectedWorkspace(a, url);
        send(200, { directory: selected.directory, robots: store.data.robots.filter(r => workspaceIdOf(r) === selected.id).map(r => ({ ...r, workspaceId: workspaceIdOf(r) })), allRobots: store.data.robots.map(r => ({ ...r, workspaceId: workspaceIdOf(r) })), users: store.data.users.map(safeUser), workspace: { id: selected.id, name: selected.name, category: selected.category } }); return true;
      }
      if (pathname === '/api/admin/directory' && method === 'PUT') {
        const selected = selectedWorkspace(a, url), d = validateDirectory(await body(req));
        ensure(d.people.every(p => !p.userId || store.data.users.some(u => u.id === p.userId && ['staff', 'admin'].includes(u.role))), 'حساب دریافت‌کننده باید از کارکنان باشد.');
        ensure(store.data.robots.filter(r => workspaceIdOf(r) === selected.id).every(r => !r.startNodeId || d.nodes.some(n => n.id === r.startNodeId)), 'ابتدا مبدأ ربات را تغییر دهید.');
        store.change(data => { if (selected.id === LEGACY) data.directory = d; else workspace(data, selected.id).directory = d; }); io.emit('directory:changed', { workspaceId: selected.id }); send(200, d); return true;
      }
      if (pathname === '/api/admin/users' && method === 'POST') {
        const b = await body(req); ensure(text(b.name) && b.name.trim() && /^[a-zA-Z0-9_.-]{3,64}$/.test(b.username) && ['admin', 'operator', 'staff', 'robot'].includes(b.role), 'اطلاعات حساب معتبر نیست.');
        ensure(!store.data.users.some(u => u.username === b.username), 'نام کاربری تکراری است.', 409);
        if (b.role === 'robot') getRobot(b.robotId);
        const u = { id: crypto.randomUUID(), name: b.name.trim(), username: b.username, role: b.role, robotId: b.role === 'robot' ? b.robotId : '', active: true, password: passwordHash(b.password) };
        store.change(d => d.users.push(u)); send(201, safeUser(u)); return true;
      }
      const um = pathname.match(/^\/api\/admin\/users\/([\w-]+)$/);
      if (um && method === 'PUT') {
        const b = await body(req), u = store.data.users.find(u => u.id === um[1]); ensure(u, 'حساب یافت نشد.', 404);
        ensure(typeof b.active === 'boolean', 'وضعیت حساب نامعتبر');
        ensure(b.active || u.id !== a.user.id, 'نمی‌توانید حساب خود را غیرفعال کنید.');
        const hash = b.password ? passwordHash(b.password) : null;
        store.change(d => { const x = d.users.find(x => x.id === u.id); x.active = b.active; if (hash) x.password = hash; });
        for (const [t, x] of auth) if (x.user.id === u.id) auth.delete(t);
        for (const s of sessions.values()) if (s.userId === u.id) endSession(s, 'حساب تغییر کرد');
        for (const socket of io.sockets.sockets.values()) { try { requireAuth(socket.handshake.auth.token); } catch { socket.disconnect(true); } }
        send(200, { ok: true }); return true;
      }
      if (pathname === '/api/admin/robots' && method === 'POST') {
        const b = await body(req), selected = workspace(store.data, b.workspaceId === undefined ? LEGACY : b.workspaceId);
        const existing = store.data.robots.find(r => r.id === b.id);
        ensure(!existing || workspaceIdOf(existing) === selected.id, 'جابجایی ربات بین فضاهای کاری نیازمند اقدام جداگانه است.', 409);
        ensure(id(b.id) && /^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$/.test(b.serial) && text(b.name) && b.name.trim() && text(b.location) && ['welcome', 'telepresence'].includes(b.mode) && (!b.startNodeId || selected.directory.nodes.some(n => n.id === b.startNodeId)), 'اطلاعات ربات معتبر نیست.');
        ensure(!store.data.robots.some(r => r.id !== b.id && r.serial === b.serial), 'شماره سریال تکراری است.', 409);
        const r = { id: b.id, workspaceId: selected.id, serial: b.serial, name: b.name.trim(), location: b.location, mode: b.mode, startNodeId: b.startNodeId || '', active: b.active !== false };
        store.change(d => { const i = d.robots.findIndex(x => x.id === r.id); if (i < 0) d.robots.push(r); else d.robots[i] = r; });
        for (const s of sessions.values()) if (s.robotId === r.id) endSession(s, 'تنظیمات ربات تغییر کرد');
        revoke(r.id, 'تنظیمات ربات تغییر کرد'); io.to(`robot:${r.id}`).emit('robot:changed', r); broadcastRobots(); send(200, r); return true;
      }
      throw new Problem(404, 'مسیر یافت نشد.');
    } catch (e) { send(e.status || 500, { error: e.status ? e.message : 'خطای ذخیره یا پردازش؛ دوباره تلاش کنید.' }); if (!e.status) console.error(e); }
    return true;
  }
  const dummyHash = passwordHash(token());
  const timer = setInterval(() => {
    for (const [robotId, l] of leases) if (l.expires <= now() || !live(robotId)) revoke(robotId, 'مجوز کنترل منقضی شد');
    for (const s of sessions.values()) { try { requireAuth(s.authToken); if (s.expires <= now() || s.disconnectedAt !== null && now() - s.disconnectedAt > 30000) endSession(s, 'جلسه منقضی شد'); } catch { endSession(s, 'ورود منقضی شد'); } }
    for (const [robotId, p] of presence) if (now() - p.at >= 4500) { presence.delete(robotId); revoke(robotId, 'ربات پاسخ نمی‌دهد'); broadcastRobots(); }
    for (const [t, a] of auth) if (a.expires <= now()) auth.delete(t);
    for (const [t, v] of invites) if (v.expires <= now()) invites.delete(t);
    for (const [key, r] of rates) if (r.until <= now()) rates.delete(key);
    for (const socket of io.sockets.sockets.values()) { try { requireAuth(socket.handshake.auth.token); } catch { socket.disconnect(true); } }
  }, 500);
  timer.unref();
  return { handle, store, io, close: () => { clearInterval(timer); io.close(); } };
}
module.exports = { createService };
