/* Shared authenticated API and real-time client. No credentials in public config. */
'use strict';
const Platform = (() => {
  const fixedBase = (CONFIG.apiBase || '').replace(/\/$/, '');
  const discoveryUrl = CONFIG.apiDiscoveryUrl || '';
  let base = fixedBase, epoch = 0, backendState = 'checking', refreshPromise = null, tokenLoaded = false;
  const storageKey = () => `robot-platform:${base || location.origin}:${document.body.dataset.app || 'portal'}`;
  // Some private or embedded browsers deny storage. The current tab can still
  // authenticate; only restoring its session after a reload is unavailable.
  let token = '', user = null, socket = null;
  function loadToken() {
    if (tokenLoaded) return;
    tokenLoaded = true;
    try { token = window.sessionStorage.getItem(storageKey()) || ''; } catch {}
  }
  function persistToken() {
    try {
      if (token) window.sessionStorage.setItem(storageKey(), token);
      else window.sessionStorage.removeItem(storageKey());
    } catch {}
  }
  const listeners = new Map();
  const emit = (event, value) => (listeners.get(event) || []).forEach(fn => fn(value));
  function on(event, fn) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(fn); }
  const connection = () => ({ state: backendState, base, discovery: !!discoveryUrl });
  function setBackendState(state) { backendState = state; emit('backend:status', connection()); }
  function discoveredBase(registry) {
    if (registry?.version !== 1 || typeof registry.apiBase !== 'string') throw new Error('آدرس سرور فعال ثبت نشده است.');
    const url = new URL(registry.apiBase);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || registry.apiBase !== url.origin || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:lhr\.life|trycloudflare\.com)$/.test(url.hostname)) throw new Error('آدرس سرور فعال معتبر نیست.');
    return url.origin;
  }
  async function fetchJSON(url, timeout = 8000) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
      if (!response.ok) throw new Error('سرور پاسخ نداد.');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function closeSocket() { const current = socket; socket = null; if (current) current.disconnect(); }
  async function checkBackend() {
    // A background health check should not interrupt an active call each time.
    if (backendState !== 'ready') setBackendState('checking');
    try {
      let candidate = fixedBase;
      if (discoveryUrl) {
        const registryUrl = new URL(discoveryUrl);
        if (registryUrl.protocol !== 'https:' || registryUrl.username || registryUrl.password) throw new Error('آدرس دریافت سرور معتبر نیست.');
        registryUrl.searchParams.set('_', String(Date.now()));
        candidate = discoveredBase(await fetchJSON(registryUrl.href));
      }
      if (candidate !== base) {
        // Remove the old host's token before selecting a new host. A moving
        // tunnel never carries an existing authenticated session to its new URL.
        clear(); epoch++; base = candidate;
        setBackendState('checking');
        if (tokenLoaded) emit('expired');
      }
      const health = await fetchJSON(candidate + '/api/health');
      if (health?.ok !== true || health.version !== 2) throw new Error('سرور سازگار در دسترس نیست.');
      loadToken();
      setBackendState('ready');
      if (user && token && !socket) connectSocket();
      return connection();
    } catch {
      if (backendState !== 'offline') epoch++;
      closeSocket(); setBackendState('offline'); emit('disconnected');
      throw new Error('سرور ربات در دسترس نیست. لپ‌تاپ ربات و برنامه راه‌انداز باید روشن باشند؛ سپس «بررسی دوباره» را بزنید.');
    }
  }
  function refreshBackend() {
    if (!refreshPromise) refreshPromise = checkBackend().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  async function ensureBackend() {
    if (backendState !== 'ready') await refreshBackend();
    if (backendState !== 'ready') throw new Error('سرور ربات در دسترس نیست.');
  }
  function checkEpoch(expected) {
    if (epoch !== expected || backendState !== 'ready') throw new Error('آدرس یا ارتباط سرور تغییر کرد؛ دوباره وارد شوید.');
  }
  async function request(path, options, authorization, expected) {
    checkEpoch(expected);
    const requestBase = base;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(requestBase + '/api' + path, { method: options.method || 'GET', headers: { ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}), ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}), signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error', keepalive: !!options.keepalive });
      const result = await response.json().catch(() => ({ error: 'سرور مشترک در این آدرس در دسترس نیست؛ تنظیم apiBase را بررسی کنید.' }));
      checkEpoch(expected);
      if (!response.ok) {
        if (response.status === 401 && authorization && authorization === token) { clear(); emit('expired'); }
        throw new Error(result.error || 'درخواست انجام نشد.');
      }
      return result;
    } catch (e) { if (e.name === 'AbortError') throw new Error('پاسخ سرور دیر شد؛ دوباره تلاش کنید.'); throw e; }
    finally { clearTimeout(timer); }
  }
  async function api(path, options = {}) {
    await ensureBackend();
    return request(path, options, token, epoch);
  }
  function connectSocket() {
    closeSocket();
    if (!token || backendState !== 'ready') return;
    const current = io(base || location.origin, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true }); socket = current;
    for (const event of ['robots', 'visit', 'directory:changed', 'robot:changed', 'control:lease', 'control:revoked', 'session:ended']) current.on(event, v => { if (socket === current) emit(event, v); });
    current.on('connect', () => { if (socket === current) emit('connected'); });
    current.on('disconnect', reason => { if (socket !== current) return; emit('disconnected'); if (reason === 'io server disconnect') { clear(); emit('expired'); } });
    current.on('connect_error', e => { if (socket === current) emit('connection:error', e.message); });
  }
  function accept(result, expected) { checkEpoch(expected); token = result.token; user = result.user; persistToken(); connectSocket(); emit('login', user); return user; }
  function clear() { token = ''; user = null; persistToken(); closeSocket(); }
  async function restore() {
    try { await ensureBackend(); if (!token) return null; const expected = epoch; const result = await request('/me', {}, token, expected); checkEpoch(expected); user = result.user; connectSocket(); return user; }
    catch { clear(); return null; }
  }
  async function authenticate(path, body, withToken = false) {
    await ensureBackend(); const expected = epoch;
    return accept(await request(path, { method: 'POST', body }, withToken ? token : '', expected), expected);
  }
  async function login(username, password) { return authenticate('/login', { username, password }); }
  async function logout() { try { await api('/logout', { method: 'POST' }); } finally { clear(); emit('logout'); } }
  async function device(robotId) { return authenticate('/device', { robotId }, true); }
  async function redeem(value) { return authenticate('/invites/redeem', { token: value }); }
  async function temporaryAuth(username, password) {
    await ensureBackend(); const expected = epoch;
    const result = await request('/login', { method: 'POST', body: { username, password } }, '', expected);
    await request('/logout', { method: 'POST' }, result.token, expected);
    checkEpoch(expected); return result.user;
  }
  function socketRequest(event, payload) {
    return new Promise((resolve, reject) => {
      if (backendState !== 'ready' || !socket?.connected) return reject(new Error('ارتباط لحظه‌ای سرور قطع است.'));
      const expected = epoch;
      socket.timeout(2000).emit(event, payload, (err, result) => {
        try { checkEpoch(expected); } catch (e) { reject(e); return; }
        if (err || result?.error) reject(new Error(result?.error || 'پاسخ ارتباط لحظه‌ای دریافت نشد.')); else resolve(result);
      });
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
  refreshBackend().catch(() => {});
  setInterval(() => refreshBackend().catch(() => {}), 30000);
  return { api, on, login, loginForm, restore, logout, device, redeem, temporaryAuth, refreshBackend, socketRequest, get connection() { return connection(); }, get user() { return user; }, get connected() { return backendState === 'ready' && !!socket?.connected; } };
})();
