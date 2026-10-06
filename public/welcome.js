'use strict';
let directory = null, selectedDestination = null, selectedRoute = null, currentVisit = null;
let activityAt = Date.now(), visitTimer = null, lookupGeneration = 0;
const welcome = document.querySelector('#welcomeScreen');
const wm = document.querySelector('#welcomeMessage');
const detail = document.querySelector('#destinationDetail');
// Keep kiosk preferences usable for this page even when browser storage is
// disabled. These values contain only display preferences, never credentials.
const stationPreferences = new Map();
function readStationPreference(key) {
  if (stationPreferences.has(key)) return stationPreferences.get(key);
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStationPreference(key, value) {
  stationPreferences.set(key, value);
  try { window.localStorage.setItem(key, value); } catch {}
}
const statusLabels = { registered: 'مراجعه ثبت شد؛ منتظر دریافت کارکنان', delivered: 'اعلان به دستگاه مقصد تحویل شد', seen: 'فرد مقصد اعلان را دید', responded: 'فرد مقصد پاسخ داد' };
function resetVisit() {
  lookupGeneration++;
  selectedDestination = null; selectedRoute = null; currentVisit = null;
  clearInterval(visitTimer); visitTimer = null;
  detail.hidden = true; document.querySelector('#destinationResults').replaceChildren();
  for (const id of ['destinationQuery', 'visitorName', 'visitorNote']) document.querySelector('#' + id).value = '';
  document.querySelector('#visitStatus').textContent = ''; wm.textContent = '';
  document.querySelector('#notifyBtn').disabled = false;
  window.speechSynthesis?.cancel(); activityAt = Date.now();
}
document.querySelector('#newVisit').onclick = resetVisit;
Platform.on('expired', () => { resetVisit(); welcome.hidden = true; document.querySelector('#stationMain').hidden = true; });
for (const event of ['pointerdown', 'keydown', 'input']) welcome.addEventListener(event, () => { activityAt = Date.now(); });
setInterval(() => { if (Date.now() - activityAt > 90000 && !welcome.hidden) resetVisit(); }, 5000);
async function loadDirectory() {
  directory = await Platform.api('/directory');
  document.querySelector('#siteName').textContent = directory.name;
  const nodeSelect = document.querySelector('#startNode'), prior = nodeSelect.value;
  nodeSelect.replaceChildren(new Option('انتخاب محل شروع', ''));
  for (const n of directory.nodes) nodeSelect.add(new Option(n.name, n.id));
  nodeSelect.value = prior || boundRobot?.startNodeId || '';
}
Platform.on('directory:changed', change => {
  if (!boundRobot || (change?.workspaceId || 'legacy') !== (boundRobot.workspaceId || 'legacy')) return;
  resetVisit(); loadDirectory().catch(e => { wm.textContent = e.message; });
});
document.querySelector('#startNode').onchange = resetVisit;
document.querySelector('#destinationForm').onsubmit = async e => {
  e.preventDefault(); const generation = ++lookupGeneration;
  detail.hidden = true; clearInterval(visitTimer); currentVisit = null;
  wm.textContent = 'در حال جست‌وجو…';
  try {
    const list = await Platform.api('/search?q=' + encodeURIComponent(document.querySelector('#destinationQuery').value));
    if (generation !== lookupGeneration) return;
    const results = document.querySelector('#destinationResults'); results.replaceChildren();
    for (const destination of list) {
      const button = document.createElement('button'); button.className = 'btn';
      button.textContent = `${destination.kind === 'person' ? 'فرد' : 'اتاق'}: ${destination.label}${destination.title ? ' — ' + destination.title : ''}`;
      button.onclick = () => showDestination(destination); results.append(button);
    }
    wm.textContent = list.length ? 'مقصد موردنظر را انتخاب کنید.' : 'مقصد پیدا نشد؛ نام دیگری امتحان کنید یا از پذیرش کمک بگیرید.';
  } catch (e) { if (generation === lookupGeneration) wm.textContent = e.message; }
};
async function showDestination(destination) {
  const generation = ++lookupGeneration;
  selectedDestination = destination; selectedRoute = null; currentVisit = null; clearInterval(visitTimer);
  detail.hidden = false; document.querySelector('#routeSteps').replaceChildren(); document.querySelector('#floorMap').replaceChildren();
  document.querySelector('#visitStatus').textContent = ''; document.querySelector('#routeDistance').textContent = '';
  document.querySelector('#visitorName').value = ''; document.querySelector('#visitorNote').value = '';
  document.querySelector('#notifyBtn').disabled = false;
  document.querySelector('#destinationName').textContent = destination.label;
  const room = directory.rooms.find(r => r.id === destination.roomId);
  const node = directory.nodes.find(n => n.id === room?.nodeId);
  const floor = directory.floors.find(f => f.id === node?.floorId);
  document.querySelector('#destinationInfo').textContent = [room?.name, room?.number && 'شماره ' + room.number, floor?.name, room?.hours, destination.availability].filter(Boolean).join(' · ');
  const contacts = directory.people.filter(p => p.active && p.canNotify && (destination.kind === 'person' ? p.id === destination.id : p.roomId === destination.roomId));
  const contactSelect = document.querySelector('#notifyPerson'); contactSelect.replaceChildren();
  for (const p of contacts) contactSelect.add(new Option(p.name, p.id));
  document.querySelector('#notifyForm').hidden = !contacts.length;
  const start = document.querySelector('#startNode').value;
  if (!start) { wm.textContent = 'محل شروع ربات ثبت نشده؛ از مسئول دستگاه کمک بگیرید.'; return; }
  try {
    const route = await Platform.api(`/route?from=${encodeURIComponent(start)}&room=${encodeURIComponent(destination.roomId)}&accessible=${document.querySelector('#accessibleRoute').checked}`);
    if (generation !== lookupGeneration) return;
    selectedRoute = route;
    const steps = document.querySelector('#routeSteps');
    for (const step of route.steps) { const li = document.createElement('li'); li.textContent = step.instruction || directory.nodes.find(n => n.id === step.to)?.name; steps.append(li); }
    if (!route.steps.length) { const li = document.createElement('li'); li.textContent = 'مقصد در محل شروع ثبت‌شده قرار دارد.'; steps.append(li); }
    document.querySelector('#routeDistance').textContent = `طول مسیر ثبت‌شده: ${Math.round(route.distance)} متر`;
    const floorSelect = document.querySelector('#mapFloor'); floorSelect.replaceChildren();
    for (const f of directory.floors.filter(f => route.nodes.some(id => directory.nodes.find(n => n.id === id)?.floorId === f.id))) floorSelect.add(new Option(f.name, f.id));
    renderMap(); wm.textContent = 'مسیر آماده است. ربات در این حالت حرکت خودکار ندارد.';
  } catch (e) { if (generation === lookupGeneration) wm.textContent = e.message; }
}
document.querySelector('#accessibleRoute').onchange = () => { if (selectedDestination) showDestination(selectedDestination); };
document.querySelector('#mapFloor').onchange = renderMap;
function renderMap() {
  if (!selectedRoute) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '-10 -10 120 120'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'نقشه شماتیک مسیر و نقاط طبقه'); svg.classList.add('map');
  const nodes = directory.nodes.filter(n => n.floorId === document.querySelector('#mapFloor').value);
  function shape(type, attrs, route) { const el = document.createElementNS(svgNS, type); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); if (route) el.classList.add('route'); svg.append(el); return el; }
  for (const edge of directory.edges) {
    const a = nodes.find(n => n.id === edge.from), b = nodes.find(n => n.id === edge.to); if (!a || !b) continue;
    const route = selectedRoute.steps.some(s => s.from === a.id && s.to === b.id || s.from === b.id && s.to === a.id);
    shape('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, route);
  }
  for (const n of nodes) { shape('circle', { cx: n.x, cy: n.y, r: 1.8 }, selectedRoute.nodes.includes(n.id)); shape('text', { x: n.x, y: n.y - 4, 'text-anchor': 'middle', direction: 'rtl' }).textContent = n.name; }
  document.querySelector('#floorMap').replaceChildren(svg);
}
document.querySelector('#notifyBtn').onclick = async () => {
  if (!selectedDestination || currentVisit) return;
  const button = document.querySelector('#notifyBtn'); button.disabled = true;
  const generation = lookupGeneration;
  const requestId = selectedDestination.requestId || (selectedDestination.requestId = crypto.randomUUID());
  try {
    const v = await Platform.api('/visits', { method: 'POST', body: { requestId, personId: document.querySelector('#notifyPerson').value, visitor: document.querySelector('#visitorName').value, note: document.querySelector('#visitorNote').value } });
    if (generation !== lookupGeneration) return;
    currentVisit = v.id; showVisit(v);
    visitTimer = setInterval(async () => { if (!currentVisit) return; const target = currentVisit; try { const v = await Platform.api('/visits/' + target); if (target === currentVisit) showVisit(v); } catch { if (target === currentVisit) document.querySelector('#visitStatus').textContent = 'پیگیری اعلان موقتاً قطع است؛ مسیر همچنان در دسترس است.'; } }, 3000);
  } catch (e) { if (generation === lookupGeneration) { document.querySelector('#visitStatus').textContent = e.message; button.disabled = false; } }
};
function showVisit(v) { document.querySelector('#visitStatus').textContent = `${statusLabels[v.status] || v.status}${v.response ? ' — ' + v.response : ''}`; }
document.querySelector('#humanHelp').onclick = () => { wm.textContent = 'لطفاً از مسئول پذیرش کمک بگیرید. مسئول دستگاه می‌تواند برای همراهی دستی، تماس اپراتور را برقرار کند.'; };
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Recognition) {
  const button = document.querySelector('#voiceBtn'); button.hidden = false;
  button.onclick = () => {
    const recognition = new Recognition(); recognition.lang = 'fa-IR'; recognition.interimResults = false;
    recognition.onresult = e => { document.querySelector('#destinationQuery').value = e.results[0][0].transcript; document.querySelector('#destinationForm').requestSubmit(); };
    recognition.onerror = () => { wm.textContent = 'پرسش صوتی در دسترس نیست؛ سؤال را تایپ کنید.'; };
    recognition.onend = () => { button.disabled = false; }; button.disabled = true;
    try { recognition.start(); wm.textContent = 'در حال شنیدن…'; } catch { button.disabled = false; }
  };
}
if ('speechSynthesis' in window) {
  const button = document.querySelector('#speakRoute'); button.hidden = false;
  button.onclick = () => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(document.querySelector('#destinationInfo').textContent + '. ' + [...document.querySelector('#routeSteps').children].map(x => x.textContent).join('. ')); u.lang = 'fa-IR'; speechSynthesis.speak(u); };
}

function showPublic() {
  writeStationPreference('robotPublic', '1');
  resetVisit(); document.body.classList.add('station-public');
  welcome.hidden = document.querySelector('#stationMode').value !== 'welcome';
  document.querySelector('#stationMain').hidden = !welcome.hidden;
  document.querySelector('#settingsBtn').hidden = false;
}
document.querySelector('#publicBtn').onclick = async () => {
  try {
    boundRobot = await Platform.api('/robot/settings', { method: 'POST', body: { mode: document.querySelector('#stationMode').value, startNodeId: document.querySelector('#startNode').value } });
    showPublic();
  } catch (e) { wm.textContent = e.message; alert(e.message); }
};
document.querySelector('#settingsBtn').onclick = async () => {
  if (!document.body.classList.contains('station-public')) { showPublic(); return; }
  // Public kiosk access never grants device configuration access.
  const modal = document.querySelector('#settingsDialog'); modal.showModal();
};
document.querySelector('#unlockSettings').onsubmit = async e => {
  e.preventDefault(); const form = e.target;
  try {
    const verifiedUser = await Platform.temporaryAuth(form.username.value, form.password.value);
    const permitted = verifiedUser.role === 'admin' || verifiedUser.role === 'robot' && verifiedUser.robotId === boundRobot.id;
    if (!permitted) throw new Error('این حساب مجوز تنظیمات دستگاه ندارد.');
    form.password.value = ''; document.querySelector('#settingsDialog').close(); document.body.classList.remove('station-public'); welcome.hidden = true; document.querySelector('#stationMain').hidden = false; document.querySelector('#settingsBtn').hidden = true; writeStationPreference('robotPublic', '0');
  } catch (e) { form.querySelector('[role="alert"]').textContent = e.message; }
};
document.querySelector('#cancelSettings').onclick = () => document.querySelector('#settingsDialog').close();
document.querySelector('#localStop').onclick = async () => {
  const session = remoteSession;
  emergencyStop('توقف محلی'); dropUser('تماس از کنار ربات پایان یافت', true);
  if (session) Platform.api(`/sessions/${session.id}`, { method: 'DELETE' }).catch(() => {});
};
document.querySelector('#stationLogout').onclick = () => { goOffline(); Platform.logout().finally(() => location.reload()); };
async function stationLogin(user) {
  if (user.role === 'admin') {
    const view = new URLSearchParams(location.search), query = new URLSearchParams();
    const workspace = view.get('workspace'), mode = view.get('mode');
    if (['university', 'hospital', 'office', 'mall', 'museum', 'legacy'].includes(workspace)) query.set('workspace', workspace);
    if (['welcome', 'telepresence'].includes(mode)) query.set('mode', mode);
    const list = await Platform.api('/robots' + (query.size ? '?' + query.toString() : ''));
    const box = document.querySelector('#devicePicker'); box.hidden = false;
    const select = box.querySelector('select'); select.replaceChildren(new Option('انتخاب ربات', ''));
    for (const r of list) select.add(new Option(r.name, r.id));
    const button = box.querySelector('button'), error = box.querySelector('[role="alert"]');
    button.disabled = true;
    error.textContent = list.length ? '' : 'در این فضای کاری و حالت هنوز رباتی ثبت نشده است. ابتدا ربات را در پنل سازمان ثبت کنید.';
    select.onchange = () => { button.disabled = !select.value; if (select.value) error.textContent = ''; };
    button.onclick = async () => {
      if (!select.value) return;
      button.disabled = true; error.textContent = '';
      try { const deviceUser = await Platform.device(select.value); await stationLogin(deviceUser); box.hidden = true; }
      catch (e) { error.textContent = e.message; }
      finally { button.disabled = !select.value; }
    };
    return;
  }
  if (user.role !== 'robot') throw new Error('با حساب دستگاه یا مدیر وارد شوید.');
  const [robot] = await Platform.api('/robots');
  if (!robot || robot.id !== user.robotId) throw new Error('ربات مربوط به این حساب در دسترس نیست.');
  await loadDirectory(); bindStation(robot);
  document.querySelector('#stationHeader').hidden = false; document.querySelector('#stationMain').hidden = false;
  document.querySelector('#stationAuth').hidden = true;
  document.querySelector('#settingsBtn').hidden = true;
  if (readStationPreference('robotPublic') === '1') showPublic();
  if (readStationPreference('robotAutoOnline') === '1') { await startCamera(); if (stream) goOnline(); }
}
Platform.loginForm(document.querySelector('#stationAuth'), stationLogin, ['admin', 'robot']);
