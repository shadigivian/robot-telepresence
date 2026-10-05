/* Shared authenticated API and real-time client. No credentials in public config. */
'use strict';
const Platform = (() => {
  const base = (CONFIG.apiBase || '').replace(/\/$/, '');
  const storageKey = `robot-platform:${base || location.origin}:${document.body.dataset.app || 'portal'}`;
  let token = sessionStorage.getItem(storageKey) || '', user = null, socket = null;
  const listeners = new Map();
  const emit = (event, value) => (listeners.get(event) || []).forEach(fn => fn(value));
  function on(event, fn) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(fn); }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(base + '/api' + path, { method: options.method || 'GET', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}), signal: controller.signal, cache: 'no-store', credentials: 'omit', keepalive: !!options.keepalive });
      const result = await response.json().catch(() => ({ error: 'سرور مشترک در این آدرس در دسترس نیست؛ تنظیم apiBase را بررسی کنید.' }));
      if (!response.ok) {
        if (response.status === 401 && token) { clear(); emit('expired'); }
        throw new Error(result.error || 'درخواست انجام نشد.');
      }
      return result;
    } catch (e) { if (e.name === 'AbortError') throw new Error('پاسخ سرور دیر شد؛ دوباره تلاش کنید.'); throw e; }
    finally { clearTimeout(timer); }
  }
  function connectSocket() {
    if (socket) socket.disconnect();
    socket = io(base || location.origin, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true });
    for (const event of ['robots', 'visit', 'directory:changed', 'robot:changed', 'control:lease', 'control:revoked', 'session:ended']) socket.on(event, v => emit(event, v));
    socket.on('connect', () => emit('connected'));
    socket.on('disconnect', reason => { emit('disconnected'); if (reason === 'io server disconnect') { clear(); emit('expired'); } });
    socket.on('connect_error', e => emit('connection:error', e.message));
  }
  function accept(result) { token = result.token; user = result.user; sessionStorage.setItem(storageKey, token); connectSocket(); emit('login', user); return user; }
  function clear() { token = ''; user = null; sessionStorage.removeItem(storageKey); if (socket) socket.disconnect(); socket = null; }
  async function restore() { if (!token) return null; try { const result = await api('/me'); user = result.user; connectSocket(); return user; } catch { clear(); return null; } }
  async function login(username, password) { return accept(await api('/login', { method: 'POST', body: { username, password } })); }
  async function logout() { try { await api('/logout', { method: 'POST' }); } finally { clear(); emit('logout'); } }
  async function device(robotId) { return accept(await api('/device', { method: 'POST', body: { robotId } })); }
  async function redeem(value) { return accept(await api('/invites/redeem', { method: 'POST', body: { token: value } })); }
  function socketRequest(event, payload) {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) return reject(new Error('ارتباط لحظه‌ای سرور قطع است.'));
      socket.timeout(2000).emit(event, payload, (err, result) => { if (err || result?.error) reject(new Error(result?.error || 'پاسخ ارتباط لحظه‌ای دریافت نشد.')); else resolve(result); });
    });
  }
  function loginForm(container, ready, allowed) {
    container.innerHTML = '<form class="auth-form"><h2>ورود به سامانه</h2><label>نام کاربری<input name="username" autocomplete="username" required></label><label>رمز عبور<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary">ورود</button><p class="form-error" role="alert"></p><p class="muted">حساب‌ها و اطلاعات مکان را مدیر سامانه ثبت می‌کند.</p></form>';
    const form = container.querySelector('form');
    const error = form.querySelector('.form-error');
    const enter = async u => { if (allowed && !allowed.includes(u.role)) throw new Error('این حساب برای این بخش دسترسی ندارد.'); await ready(u); container.hidden = true; };
    form.onsubmit = async e => {
      e.preventDefault(); const button = form.querySelector('button'); button.disabled = true; error.textContent = '';
      try { await enter(await login(form.username.value, form.password.value)); form.password.value = ''; }
      catch (e) { error.textContent = e.message; }
      finally { button.disabled = false; }
    };
    restore().then(u => u && enter(u)).catch(e => { error.textContent = e.message; });
    on('expired', () => { container.hidden = false; error.textContent = 'جلسه ورود منقضی شد؛ دوباره وارد شوید.'; });
  }
  return { api, on, login, loginForm, restore, logout, device, redeem, socketRequest, get user() { return user; }, get connected() { return !!socket?.connected; } };
})();
