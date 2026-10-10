'use strict';
const crypto = require('node:crypto');
const { isIP } = require('node:net');
const { ensure, text, validateDirectory } = require('./domain');
const { checkPassword } = require('./store');
const { workspace, workspaceIdOf } = require('./workspaces');

// Organization setup is durable; its completion marker is intentionally bound
// to this server boot. Restarting repeats the wizard without erasing site data.
function createOrganization({ store, io, requireAuth, issue, getRobot, body, limit, now, notifyRobots, robotList }) {
  const boot = crypto.randomUUID(), calls = new Map();
  const member = a => ensure(!a.guest && ['admin', 'operator', 'staff'].includes(a.user.role), 'این بخش مخصوص اعضای سازمان است.', 403);
  const administrator = a => { member(a); ensure(a.user.role === 'admin', 'فقط مدیر می‌تواند این تنظیمات را تغییر دهد.', 403); };
  const profile = () => store.data.organization || { name: '', description: '', logo: '', robotId: '', address: '', revision: 1 };
  const preferences = a => (store.data.organizationPreferences || {})[a.user.id] || {};
  const contact = u => ({ id: u.id, name: u.name, title: u.jobTitle || ({ admin: 'مدیر سازمان', operator: 'اپراتور', staff: 'کارشناس' })[u.role], role: u.role,
    online: [...(io.sockets.adapter.rooms.get(`user:${u.id}`) || [])].some(id => { try { return requireAuth(io.sockets.sockets.get(id)?.handshake.auth.token).user.id === u.id; } catch { return false; } }) });
  const experts = a => store.data.users.filter(u => u.active && u.id !== a.user.id && ['staff', 'operator', 'admin'].includes(u.role)).map(contact);
  function ownThread(a, id) {
    member(a); const thread = (store.data.expertThreads || []).find(t => t.id === id);
    ensure(thread && thread.members.includes(a.user.id), 'گفتگو یافت نشد.', 404); return thread;
  }
  const publicThread = (a, t) => ({ id: t.id, contact: contact(store.data.users.find(u => u.id === t.members.find(id => id !== a.user.id)) || { id: '', name: 'حساب غیرفعال', role: 'staff' }), messages: t.messages, updatedAt: t.updatedAt });
  function publicCall(c) { return { id: c.id, threadId: c.threadId, from: c.from, to: c.to, state: c.state, expires: c.expires, name: store.data.users.find(u => u.id === c.from)?.name || 'عضو سازمان' }; }
  function update(c) { for (const id of [c.from, c.to]) io.to(`user:${id}`).emit('expert:call', publicCall(c)); }
  function end(c, reason) { if (!calls.has(c.id)) return; calls.delete(c.id); c.state = 'ended'; c.reason = reason; for (const id of [c.from, c.to]) io.to(`user:${id}`).emit('expert:call', { ...publicCall(c), reason }); }
  function ownCall(a, id) {
    member(a); const c = calls.get(id);
    ensure(c && c.expires > now() && [c.from, c.to].includes(a.user.id), 'تماس یافت نشد یا پایان یافته است.', 404);
    ensure(c.tokens[a.user.id] === a.authToken, 'تماس متعلق به پنجره دیگری است.', 403); return c;
  }
  function address(value) {
    ensure(text(value, 200), 'آدرس شبکه معتبر نیست.');
    const s = value.trim(); if (!s) return '';
    let u; try { u = new URL('http://' + s); } catch { ensure(false, 'آدرس شبکه معتبر نیست.'); }
    const h = u.hostname.replace(/^\[|\]$/g, '');
    ensure(!u.username && !u.password && u.pathname === '/' && !u.search && !u.hash && (isIP(h) || /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(h)), 'IP یا نام میزبان را بدون مسیر، رمز یا پروتکل وارد کنید.');
    return s;
  }
  async function handle(req, url, a, send) {
    if (!url.pathname.startsWith('/api/organization/')) return false;
    member(a); const route = url.pathname.slice('/api/organization'.length), method = req.method;
    if (route === '/state' && method === 'GET') {
      const p = preferences(a), org = profile();
      send(200, { profile: { ...org, document: org.document ? { name: org.document.name, mime: org.document.mime } : null }, setup: { completed: p.boot === boot && p.completed === true, robotId: p.robotId || org.robotId || '', name: p.name || '', address: p.address || org.address || '' },
        robots: robotList(a), experts: experts(a), boot }); return true;
    }
    if (route === '/setup' && method === 'POST') {
      const b = await body(req); ensure(text(b.name) && b.name.trim(), 'نام ربات را وارد کنید.'); const ip = address(b.address || '');
      let robot = b.robotId ? getRobot(b.robotId) : null;
      if (!robot && a.user.role === 'admin') {
        const suffix = crypto.randomBytes(5).toString('hex').toUpperCase();
        robot = { id: 'robot-' + suffix.toLowerCase(), serial: 'RB-' + suffix, name: b.name.trim(), mode: 'telepresence', location: '', startNodeId: '', active: true, workspaceId: 'legacy' };
      }
      ensure(robot || a.user.role === 'staff', 'ابتدا مدیر باید یک ربات ثبت کند.', 409);
      store.change(d => {
        d.organizationPreferences ||= {};
        d.organizationPreferences[a.user.id] = { boot, completed: true, robotId: robot?.id || '', name: b.name.trim(), address: ip };
        if (a.user.role === 'admin') {
          if (!d.robots.some(r => r.id === robot.id)) d.robots.push(robot);
          // Name only: onboarding must not change a device's mode, serial,
          // workspace or start node, nor interrupt a live drive session.
          d.robots.find(r => r.id === robot.id).name = b.name.trim();
          d.organization = { ...profile(), robotId: robot.id, address: ip };
        }
      });
      notifyRobots(); send(200, { ok: true, robotId: robot?.id || '' }); return true;
    }
    if (route === '/profile' && method === 'PUT') {
      administrator(a); const b = await body(req, 1600000);
      ensure(text(b.name) && b.name.trim() && text(b.description || '', 3000), 'نام و توضیحات سازمان معتبر نیست.');
      const logo = b.logo || '';
      ensure(typeof logo === 'string' && logo.length <= 90000 && (!logo || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(logo)), 'لوگو باید تصویر PNG، JPG یا WebP و حداکثر ۶۴ کیلوبایت باشد.');
      let document = profile().document || null;
      if (b.document !== undefined) {
        document = b.document;
        ensure(document === null || (text(document.name, 160) && document.mime === 'application/pdf' && typeof document.data === 'string' && document.data.length <= 1400000 && /^JVBERi0[A-Za-z0-9+/]+=*$/.test(document.data)), 'فایل ضمیمه باید PDF و کمتر از یک مگابایت باشد.');
      }
      const robot = b.robotId ? getRobot(b.robotId) : null;
      const selected = workspace(store.data, robot ? workspaceIdOf(robot) : 'legacy');
      const directory = b.directory ? validateDirectory(b.directory) : null;
      if (directory) {
        ensure(directory.people.every(p => !p.userId || store.data.users.some(u => u.id === p.userId && ['staff', 'admin'].includes(u.role))), 'حساب دریافت‌کننده اعلان معتبر نیست.');
        ensure(store.data.robots.filter(r => workspaceIdOf(r) === selected.id).every(r => !r.startNodeId || directory.nodes.some(n => n.id === r.startNodeId)), 'نقشه باید نقاط شروع ربات‌های این محیط را حفظ کند.');
      }
      store.change(d => {
        d.organization = { ...profile(), name: b.name.trim(), description: b.description || '', logo, document };
        if (directory) { if (selected.id === 'legacy') d.directory = directory; else d.workspaces.find(w => w.id === selected.id).directory = directory; }
      });
      if (directory) io.emit('directory:changed', { workspaceId: selected.id });
      for (const user of store.data.users.filter(u => u.active && ['admin', 'operator', 'staff'].includes(u.role))) io.to(`user:${user.id}`).emit('organization:profile-updated', { saved: true });
      send(200, { ok: true }); return true;
    }
    if (route === '/document' && method === 'GET') { ensure(profile().document, 'فایلی ثبت نشده است.', 404); send(200, profile().document); return true; }
    if (route === '/reset' && method === 'POST') {
      administrator(a); limit(`organization-reset:${a.user.id}`, 5); const b = await body(req);
      ensure(b.confirm === 'RESET' && checkPassword(b.password, store.data.users.find(u => u.id === a.user.id)?.password), 'تأیید یا رمز مدیر صحیح نیست.', 403);
      store.change(d => { d.organization = { name: '', description: '', logo: '', address: '', robotId: '', revision: (profile().revision || 1) + 1 }; d.organizationPreferences = {}; });
      for (const c of calls.values()) end(c, 'تنظیمات پنل بازنشانی شد.');
      io.emit('organization:reset', { revision: profile().revision }); send(200, { ok: true }); return true;
    }
    if (route === '/robot-token' && method === 'POST') {
      ensure(['admin', 'operator'].includes(a.user.role), 'این نقش مجوز تماس با ربات ندارد.', 403);
      const b = await body(req), robot = getRobot(b.robotId);
      send(201, issue({ id: crypto.randomUUID(), username: 'guest', name: a.user.name, role: 'operator', robotId: robot.id, active: true }, { guest: true, canDrive: false, sourceAuthToken: a.authToken, expires: Math.min(a.expires, now() + 3600000) })); return true;
    }
    if (route === '/threads' && method === 'GET') {
      send(200, (store.data.expertThreads || []).filter(t => t.members.includes(a.user.id)).map(t => ({ ...publicThread(a, t), messages: t.messages.slice(-1) })).sort((a, b) => b.updatedAt - a.updatedAt)); return true;
    }
    if (route === '/threads' && method === 'POST') {
      const b = await body(req), expert = store.data.users.find(u => u.id === b.expertId && u.active && ['staff', 'operator', 'admin'].includes(u.role));
      ensure(expert && expert.id !== a.user.id, 'کارشناس معتبر را انتخاب کنید.');
      let thread = (store.data.expertThreads || []).find(t => t.members.includes(a.user.id) && t.members.includes(expert.id));
      if (!thread) { ensure((store.data.expertThreads || []).length < 500, 'ظرفیت گفتگوها تکمیل شده است.', 409); thread = { id: crypto.randomUUID(), members: [a.user.id, expert.id], messages: [], updatedAt: now() }; store.change(d => { d.expertThreads ||= []; d.expertThreads.push(thread); }); }
      send(200, publicThread(a, thread)); return true;
    }
    const tm = route.match(/^\/threads\/([\w-]+)(?:\/(messages|call))?$/);
    if (tm) {
      const thread = ownThread(a, tm[1]);
      if (!tm[2] && method === 'GET') { send(200, publicThread(a, thread)); return true; }
      const other = store.data.users.find(u => u.id === thread.members.find(id => id !== a.user.id));
      ensure(other?.active, 'حساب مقصد غیرفعال است.', 409);
      if (tm[2] === 'messages' && method === 'POST') {
        limit(`expert-message:${a.user.id}`, 30); const b = await body(req); ensure(text(b.text, 2000) && b.text.trim(), 'متن پیام را وارد کنید.');
        const message = { id: crypto.randomUUID(), senderId: a.user.id, text: b.text.trim(), createdAt: now() };
        store.change(d => { const t = d.expertThreads.find(t => t.id === thread.id); t.messages.push(message); t.messages = t.messages.slice(-300); t.updatedAt = now(); });
        for (const id of thread.members) io.to(`user:${id}`).emit('expert:message', { threadId: thread.id, message });
        send(201, message); return true;
      }
      if (tm[2] === 'call' && method === 'POST') {
        limit(`expert-call:${a.user.id}`, 10);
        ensure(contact(other).online, 'کارشناس آفلاین است؛ می‌توانید پیام بفرستید.', 409);
        ensure(![...calls.values()].some(c => c.expires > now() && [c.from, c.to].some(id => thread.members.includes(id))), 'یکی از افراد در تماس دیگری است.', 409);
        const c = { id: crypto.randomUUID(), threadId: thread.id, from: a.user.id, to: other.id, state: 'ringing', expires: now() + 45000, tokens: { [a.user.id]: a.authToken }, sockets: {} };
        calls.set(c.id, c); io.to(`user:${other.id}`).emit('expert:call', publicCall(c)); send(201, publicCall(c)); return true;
      }
    }
    const cm = route.match(/^\/calls\/([\w-]+)(?:\/(accept))?$/);
    if (cm && method === 'POST' && cm[2] === 'accept') {
      const c = calls.get(cm[1]);
      ensure(c && c.to === a.user.id && c.state === 'ringing' && c.expires > now(), 'تماس در انتظار پاسخ یافت نشد.', 404);
      c.tokens[a.user.id] = a.authToken; c.state = 'active'; c.expires = Math.min(now() + 3600000, a.expires); update(c); send(200, publicCall(c)); return true;
    }
    if (cm && method === 'DELETE') {
      const c = calls.get(cm[1]); ensure(c && [c.from, c.to].includes(a.user.id), 'تماس یافت نشد.', 404);
      if (c.state !== 'ringing' || c.from === a.user.id) ownCall(a, c.id);
      end(c, 'تماس پایان یافت.'); send(200, { ok: true }); return true;
    }
    ensure(false, 'مسیر یافت نشد.', 404);
  }
  function connect(socket) {
    const authenticate = () => ({ ...requireAuth(socket.handshake.auth.token), authToken: socket.handshake.auth.token });
    socket.on('expert:join', (b, cb = () => {}) => {
      try { const a = authenticate(), c = ownCall(a, b?.callId); ensure(!c.sockets[a.user.id] || c.sockets[a.user.id] === socket.id, 'تماس در پنجره دیگری باز است.', 409); c.sockets[a.user.id] = socket.id; cb({ ok: true }); } catch (e) { cb({ error: e.message }); }
    });
    socket.on('expert:signal', (b, cb = () => {}) => {
      try {
        const a = authenticate(), c = ownCall(a, b?.callId);
        ensure(c.state === 'active' && c.sockets[a.user.id] === socket.id, 'تماس فعال متعلق به این پنجره نیست.', 403);
        limit(`expert-signal:${socket.id}`, 180);
        const type = b.type; let payload;
        if (type === 'offer' || type === 'answer') {
          ensure((type === 'offer' ? c.from : c.to) === a.user.id && b.description?.type === type && text(b.description.sdp, 12000), 'پیشنهاد تماس معتبر نیست.');
          payload = { description: { type, sdp: b.description.sdp } };
        } else {
          ensure(type === 'ice' && (b.candidate === null || b.candidate && text(b.candidate.candidate, 2048) && (b.candidate.sdpMid == null || text(b.candidate.sdpMid, 100)) && (b.candidate.sdpMLineIndex == null || Number.isInteger(b.candidate.sdpMLineIndex) && b.candidate.sdpMLineIndex >= 0 && b.candidate.sdpMLineIndex < 100)), 'نامزد اتصال معتبر نیست.');
          payload = { candidate: b.candidate && { candidate: b.candidate.candidate, sdpMid: b.candidate.sdpMid ?? null, sdpMLineIndex: b.candidate.sdpMLineIndex ?? null } };
        }
        io.to(`user:${a.user.id === c.from ? c.to : c.from}`).emit('expert:signal', { callId: c.id, type, ...payload }); cb({ ok: true });
      } catch (e) { cb({ error: e.message }); }
    });
    socket.on('disconnect', () => { for (const c of calls.values()) if (Object.values(c.sockets).includes(socket.id)) end(c, 'ارتباط تماس قطع شد.'); });
  }
  const timer = setInterval(() => {
    for (const c of calls.values()) {
      try { for (const t of Object.values(c.tokens)) requireAuth(t); if (c.expires <= now()) end(c, 'زمان تماس پایان یافت.'); }
      catch { end(c, 'جلسه ورود پایان یافته است.'); }
    }
  }, 1000); timer.unref();
  return { handle, connect, close: () => { clearInterval(timer); for (const c of calls.values()) end(c, 'سرور خاموش شد.'); } };
}
module.exports = { createOrganization };
