'use strict';
const pq = selector => document.querySelector(selector);
const pa = selector => [...document.querySelectorAll(selector)];
const pe = pq('#portalError'), ps = pq('#portalStatus');
const text = (selector, value) => { const element = pq(selector); if (element) element.textContent = value; };
let adminState = null, draft = null, dirty = false, directoryDirty = false, jsonPending = false;
let workspaces = [], activeWorkspace = null, currentMode = null, currentView = 'overview', robots = [];
let loading = false, mutations = 0, routeGeneration = 0, committedHash = '', inboxLoading = false, inboxAgain = false;
let unsavedPromise = null, unsavedResolve = null, authenticatedUserId = null, authenticatedRole = null;
let loadedWorkspaceId = null, loadedMode = null;
let legacyImportWorkspaceId = null;
let pendingRobotSnapshot = null;
const formStates = new Map();
const modes = { welcome: 'Welcome Robot', telepresence: 'Telepresence Robot' };
const titles = { overview: 'نمای کلی', robots: 'ربات‌ها', map: 'نقشه و مسیرها', rooms: 'اتاق‌ها و واحدها', people: 'افراد و اعلان‌ها', inbox: 'صندوق مراجعه‌ها', accounts: 'اعضای تیم', tools: 'تنظیمات و فایل‌ها', operator: 'مرکز تماس و هدایت' };
const permitted = { admin: Object.keys(titles), staff: ['overview', 'inbox'], operator: ['overview', 'robots', 'operator'] };
function allowedViews(role = Platform.user?.role, mode = currentMode) {
  const views = permitted[role] || [];
  return role === 'admin' && mode === 'telepresence' ? views.filter(view => !['map', 'rooms', 'people'].includes(view)) : views;
}
const labels = { registered: 'ثبت‌شده', delivered: 'تحویل‌شده', seen: 'دیده‌شده', responded: 'پاسخ‌داده‌شده' };
const schemas = {
  floors: { title: 'طبقات', fields: [['id', 'شناسه'], ['name', 'نام']] },
  nodes: { title: 'نقاط نقشه', fields: [['id', 'شناسه'], ['name', 'نام'], ['floorId', 'طبقه', 'floors'], ['x', 'مختصات افقی ۰ تا ۱۰۰', 'number'], ['y', 'مختصات عمودی ۰ تا ۱۰۰', 'number']] },
  edges: { title: 'مسیرهای بین نقاط', fields: [['from', 'از نقطه', 'nodes'], ['to', 'به نقطه', 'nodes'], ['distance', 'فاصله (متر)', 'number'], ['instruction', 'راهنمای رفت'], ['reverseInstruction', 'راهنمای برگشت'], ['accessible', 'بدون پله', 'boolean'], ['bidirectional', 'دوطرفه', 'boolean']] },
  rooms: { title: 'اتاق‌ها و واحدها', fields: [['id', 'شناسه'], ['name', 'نام'], ['nodeId', 'نقطه نقشه', 'nodes'], ['number', 'شماره اتاق'], ['department', 'واحد'], ['hours', 'ساعات مراجعه'], ['aliases', 'نام‌های دیگر (با کاما جدا کنید)', 'array'], ['active', 'فعال', 'boolean']] },
  people: { title: 'افراد و دریافت‌کنندگان اعلان', fields: [['id', 'شناسه'], ['name', 'نام فرد'], ['title', 'سمت'], ['roomId', 'اتاق', 'rooms'], ['availability', 'وضعیت قابل نمایش'], ['aliases', 'نام‌های دیگر (با کاما جدا کنید)', 'array'], ['userId', 'حساب دریافت اعلان', 'staff'], ['active', 'فعال', 'boolean']] },
};
function error(e) { pe.textContent = e.message || String(e); }
const admin = () => Platform.user?.role === 'admin';
const scope = (path, id = activeWorkspace?.id) => `${path}${path.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(id || '')}`;
function current(id, generation) { return !!Platform.user && activeWorkspace?.id === id && routeGeneration === generation; }
function requireAdmin() { if (!admin() || !activeWorkspace || !draft) throw new Error('برای مدیریت این محیط، با حساب مدیر وارد شوید.'); }
function updateControls() {
  pa('[data-workspace], [data-mode], [data-view], [data-action="categories"], [data-action="modes"], #legacyWorkspace').forEach(button => { button.disabled = loading || !!mutations; });
  pa('[data-admin-only]').forEach(element => { element.hidden = !admin(); });
  pa('[data-view]').forEach(button => { button.hidden = !allowedViews().includes(button.dataset.view); button.classList.toggle('active', button.dataset.view === currentView); if (button.dataset.view === currentView) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  pa('#saveDirectory, [data-action="save-directory"]').forEach(button => { button.disabled = !admin() || !draft || loading || !!mutations; });
  if (pq('#workspaceShell')) { pq('#workspaceShell').setAttribute('aria-busy', String(loading || !!mutations)); pq('#workspaceShell').inert = loading || !!mutations; }
  refreshMigration();
}
async function action(fn, id = activeWorkspace?.id) {
  if (mutations) return;
  pe.textContent = ''; ps.textContent = ''; mutations++; updateControls();
  try { await fn(); } catch (e) { if (!id || activeWorkspace?.id === id) error(e); }
  finally { mutations--; updateControls(); }
}
function refreshDirty() {
  dirty = directoryDirty || jsonPending || [...formStates.values()].some(state => state.pending);
  if (pq('#draftBadge')) { pq('#draftBadge').hidden = !dirty; pq('#draftBadge').textContent = 'پیش‌نویس ذخیره‌نشده'; }
  refreshMigration();
}
function discardDraft() {
  if (adminState) draft = structuredClone(adminState.directory);
  directoryDirty = false; jsonPending = false; formStates.clear(); refreshDirty();
  if (draft) renderBuilder();
}
function showDialog(dialog) { if (dialog.open) return; if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); }
function closeDialog(dialog) { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); }
function finishUnsaved(accepted) {
  closeDialog(pq('#unsavedDialog')); const resolve = unsavedResolve;
  unsavedPromise = null; unsavedResolve = null; resolve?.(accepted);
}
function confirmDraft() {
  if (!dirty) return Promise.resolve(true);
  if (!unsavedPromise) {
    text('#unsavedError', ''); unsavedPromise = new Promise(resolve => { unsavedResolve = resolve; });
    showDialog(pq('#unsavedDialog'));
  }
  return unsavedPromise;
}
pa('[data-unsaved]').forEach(button => { button.onclick = async () => {
  if (mutations) return;
  if (button.dataset.unsaved === 'cancel') { finishUnsaved(false); return; }
  if (button.dataset.unsaved === 'discard') { discardDraft(); finishUnsaved(true); return; }
  pa('[data-unsaved]').forEach(item => { item.disabled = true; });
  mutations++; updateControls();
  try { await saveDirectory(); finishUnsaved(true); }
  catch (e) { text('#unsavedError', e.message); }
  finally { mutations--; pa('[data-unsaved]').forEach(item => { item.disabled = false; }); updateControls(); }
}; });
pq('#unsavedDialog').addEventListener('cancel', event => { event.preventDefault(); if (!mutations) finishUnsaved(false); });

function routeHash(workspace, mode, view) { return workspace ? '#/' + workspace + (mode ? '/' + mode + '/' + view : '') : '#/'; }
function parseRoute(hash) {
  if (!hash || hash === '#/' || hash === '#') return { workspace: null };
  const match = hash.match(/^#\/([A-Za-z0-9_-]+)(?:\/(welcome|telepresence)(?:\/([a-z]+))?)?$/);
  if (!match || !workspaces.some(w => w.id === match[1])) return { workspace: null };
  const view = match[3] || (Platform.user?.role === 'staff' ? 'inbox' : 'overview');
  if (match[3] && !Object.hasOwn(titles, view)) return { workspace: null };
  if (match[2] && !allowedViews(Platform.user?.role, match[2]).includes(view)) return { workspace: match[1], mode: match[2], view: Platform.user?.role === 'staff' ? 'inbox' : 'overview' };
  return { workspace: match[1], mode: match[2], view };
}
function writeHash(hash, replace = false) { history[replace ? 'replaceState' : 'pushState'](null, '', location.pathname + location.search + hash); committedHash = hash; }
function showScreen(name) { for (const id of ['categoryScreen', 'modeScreen', 'workspaceShell']) pq('#' + id).hidden = id !== name; }
function clearWorkspaceContent() {
  for (const selector of ['#directoryBuilder', '#roomBuilder', '#peopleBuilder', '#inbox', '#userRecords']) pq(selector).replaceChildren();
  pq('#directoryName').value = ''; pq('#directoryJSON').value = ''; resetRobotForm();
}
function renderView(view) {
  currentView = view;
  pa('.workspace-view').forEach(section => { section.hidden = section.id !== 'view' + view.charAt(0).toUpperCase() + view.slice(1); });
  text('#viewTitle', titles[view]); updateControls();
  if (view === 'inbox') loadInbox();
}
function renderIdentity() {
  text('#workspaceName', activeWorkspace?.name || ''); text('#modeWorkspaceName', activeWorkspace?.name || '');
  text('#modeName', modes[currentMode] || ''); text('#workspaceCrumb', activeWorkspace?.name || ''); text('#modeCrumb', modes[currentMode] || '');
  text('#roomsHeading', activeWorkspace?.id === 'university' ? 'کلاس‌ها، اتاق‌ها و واحدها' : activeWorkspace?.id === 'mall' ? 'فروشگاه‌ها و واحدها' : activeWorkspace?.id === 'museum' ? 'سالن‌ها و مقصدهای بازدید' : 'اتاق‌ها و واحدها');
  const query = `?workspace=${encodeURIComponent(activeWorkspace?.id || '')}&mode=${currentMode || 'welcome'}`;
  if (pq('#launchOperator')) pq('#launchOperator').href = 'user.html' + query;
  if (pq('#launchStation')) pq('#launchStation').href = 'robot.html' + query;
}
async function navigate(hash, { browser = false, replace = false, reload = false, allowMutation = false } = {}) {
  if (!Platform.user) return;
  if (mutations && !allowMutation) { if (browser) history.replaceState(null, '', location.pathname + location.search + committedHash); return; }
  const target = parseRoute(hash), generation = ++routeGeneration;
  const leaving = activeWorkspace && (target.workspace !== activeWorkspace.id || !target.mode || reload);
  if (leaving && !await confirmDraft()) { if (generation === routeGeneration) { if (browser) history.replaceState(null, '', location.pathname + location.search + committedHash); if (currentView === 'inbox') loadInbox(); } return; }
  if (generation !== routeGeneration || !Platform.user) return;
  if (target.workspace !== activeWorkspace?.id || !target.mode) { closeDialog(pq('#legacyImportDialog')); legacyImportWorkspaceId = null; }
  pe.textContent = ''; ps.textContent = '';
  if (!target.workspace) {
    activeWorkspace = null; currentMode = null; loadedWorkspaceId = loadedMode = null; robots = []; adminState = null; draft = null; formStates.clear(); directoryDirty = jsonPending = false; refreshDirty();
    loading = false; showScreen('categoryScreen'); writeHash('#/', replace || browser); updateControls(); return;
  }
  activeWorkspace = workspaces.find(w => w.id === target.workspace); currentMode = target.mode || null; renderIdentity();
  if (!target.mode) { loading = false; showScreen('modeScreen'); writeHash(routeHash(target.workspace), replace || browser); updateControls(); return; }
  showScreen('workspaceShell');
  const nextHash = routeHash(target.workspace, target.mode, target.view);
  if (!reload && loadedWorkspaceId === target.workspace && loadedMode === target.mode && (admin() ? !!adminState : true)) {
    renderIdentity(); renderOverview(); renderRobots(); renderView(target.view); writeHash(nextHash, replace || browser); return;
  }
  const preserveDraft = !reload && loadedWorkspaceId === target.workspace && admin() && !!adminState;
  loading = true; robots = []; pendingRobotSnapshot = null;
  if (!preserveDraft) { loadedWorkspaceId = loadedMode = null; adminState = null; draft = null; formStates.clear(); directoryDirty = jsonPending = false; clearWorkspaceContent(); refreshDirty(); }
  renderView('overview'); text('#overviewRobots', 'در حال دریافت اطلاعات محیط…'); updateControls();
  try {
    const responses = await Promise.all([
      admin() && !preserveDraft ? Platform.api(scope('/admin/state', target.workspace)) : Promise.resolve(null),
      ['admin', 'operator'].includes(Platform.user.role) ? Platform.api(scope('/robots', target.workspace) + '&mode=' + target.mode) : Promise.resolve([]),
    ]);
    if (!current(target.workspace, generation)) return;
    if (!preserveDraft) adminState = responses[0];
    robots = responses[1]; loadedWorkspaceId = target.workspace; loadedMode = target.mode;
    if (pendingRobotSnapshot) { reconcileRobotSnapshot(pendingRobotSnapshot); pendingRobotSnapshot = null; }
    if (adminState) { if (!preserveDraft) { draft = structuredClone(adminState.directory); renderBuilder(); renderAccounts(); } resetRobotForm(); }
    renderOverview(); renderRobots(); renderView(target.view); writeHash(nextHash, replace || browser);
  } catch (e) { if (current(target.workspace, generation)) { error(e); renderOverview(); } }
  finally { if (generation === routeGeneration) { loading = false; updateControls(); } }
}
async function refreshWorkspaces() {
  const userId = Platform.user?.id, result = await Platform.api('/workspaces'); if (!Platform.user || Platform.user.id !== userId) return;
  workspaces = result;
  if (activeWorkspace) activeWorkspace = workspaces.find(w => w.id === activeWorkspace.id) || activeWorkspace;
  pa('[data-workspace-count]').forEach(element => {
    const workspace = workspaces.find(w => w.id === element.dataset.workspaceCount);
    element.textContent = workspace ? `${Number(workspace.robotCount || 0).toLocaleString('fa-IR')} ربات · ${Number(workspace.roomCount || 0).toLocaleString('fa-IR')} مقصد` : 'اطلاعات در دسترس نیست';
    element.closest('[data-workspace]')?.toggleAttribute('disabled', !workspace);
  });
  pq('#legacyWorkspace').hidden = !workspaces.some(w => w.id === 'legacy'); refreshMigration();
}
function node(tag, className, value) { const element = document.createElement(tag); if (className) element.className = className; if (value !== undefined) element.textContent = value; return element; }
function visibleRobots() {
  const list = adminState?.robots || robots;
  return list.filter(r => r.mode === currentMode && (r.workspaceId || 'legacy') === activeWorkspace?.id);
}
function reconcileRobotSnapshot(snapshot) {
  robots = snapshot.filter(robot => (robot.workspaceId || 'legacy') === activeWorkspace.id && robot.mode === currentMode);
  if (!admin() || !adminState) return;
  const active = new Map(snapshot.filter(robot => robot.active !== false).map(robot => [robot.id, robot]));
  const known = adminState.allRobots || adminState.robots;
  const merged = known.map(robot => {
    const latest = active.get(robot.id); active.delete(robot.id);
    return latest ? { ...robot, ...latest, workspaceId: latest.workspaceId || 'legacy' } : { ...robot, active: false };
  });
  merged.push(...[...active.values()].map(robot => ({ ...robot, workspaceId: robot.workspaceId || 'legacy' })));
  adminState.allRobots = merged;
  adminState.robots = merged.filter(robot => (robot.workspaceId || 'legacy') === activeWorkspace.id);
  for (const workspace of workspaces) {
    const records = merged.filter(robot => (robot.workspaceId || 'legacy') === workspace.id);
    Object.assign(workspace, { robotCount: records.length, welcomeCount: records.filter(robot => robot.mode === 'welcome').length, telepresenceCount: records.filter(robot => robot.mode === 'telepresence').length });
  }
  pa('[data-workspace-count]').forEach(element => {
    const workspace = workspaces.find(item => item.id === element.dataset.workspaceCount);
    if (workspace) element.textContent = `${Number(workspace.robotCount || 0).toLocaleString('fa-IR')} ربات · ${Number(workspace.roomCount || 0).toLocaleString('fa-IR')} مقصد`;
  });
}
function robotRow(robot, editable = false) {
  const row = node('div', 'record robot-record');
  const live = robots.find(r => r.id === robot.id), detail = node('div', 'record-copy');
  detail.append(node('strong', '', robot.name), node('p', 'muted', `${robot.serial} · ${robot.location || 'محل استقرار مشخص نشده'}`));
  const status = node('span', 'status-pill', robot.active === false ? 'غیرفعال' : live?.online ? live.busy ? 'در حال تماس' : 'آنلاین' : 'آفلاین');
  row.append(detail, status);
  if (editable) { const button = node('button', 'btn', 'ویرایش'); button.type = 'button'; button.onclick = () => {
    if (!admin() || mutations || loading) return;
    const form = pq('#robotForm'); for (const key of ['id', 'name', 'serial', 'location', 'mode', 'startNodeId']) form.elements[key].value = robot[key] || '';
    form.elements.id.readOnly = true; form.elements.active.checked = robot.active; form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }; row.append(button); }
  return row;
}
function renderOverview() {
  if (!activeWorkspace) return;
  text('#overviewTitle', `${activeWorkspace.name}، در یک نگاه`);
  text('#overviewDescription', currentMode === 'welcome' ? 'مقصدها، نقشه و دریافت‌کنندگان اعلان این محیط را آماده کنید.' : 'ربات‌ها را آماده کنید و از مرکز تماس به دستگاه موردنظر وصل شوید.');
  const stats = pq('#overviewStats'); stats.replaceChildren();
  const counts = [[currentMode === 'welcome' ? 'ربات Welcome' : 'ربات Telepresence', activeWorkspace[currentMode === 'welcome' ? 'welcomeCount' : 'telepresenceCount']], ['مقصد ثبت‌شده', activeWorkspace.roomCount], ['فرد ثبت‌شده', activeWorkspace.peopleCount]];
  for (const [label, value] of counts) { const card = node('div', 'stat-card'); card.append(node('span', '', label), node('strong', '', Number(value || 0).toLocaleString('fa-IR'))); stats.append(card); }
  const box = pq('#overviewRobots'); box.replaceChildren();
  const items = visibleRobots(); items.slice(0, 3).forEach(robot => box.append(robotRow(robot)));
  if (!items.length) box.append(node('p', 'empty-state', Platform.user?.role === 'staff' ? 'مراجعه‌های مربوط به شما در صندوق مراجعه‌ها نمایش داده می‌شوند.' : 'هنوز رباتی در این حالت ثبت نشده است.'));
  const checklist = pq('#setupChecklist'); checklist.replaceChildren();
  const steps = Platform.user?.role === 'staff' ? [['inbox', 'مراجعه‌های خود را ببینید', 'پیام‌ها را بخوانید و به مراجعه‌کننده پاسخ بدهید.']] : admin() ? currentMode === 'welcome' ? [['map', 'نقشه مکان را بسازید', 'طبقات و مسیرهای واقعی را ثبت کنید.'], ['rooms', 'مقصدها را معرفی کنید', 'اتاق‌ها و واحدها را به نقشه متصل کنید.'], ['people', 'دریافت‌کنندگان اعلان را مشخص کنید', 'افراد را به حساب کارکنان متصل کنید.'], ['robots', 'ربات Welcome را ثبت کنید', 'نقطه شروع دستگاه را انتخاب کنید.']] : [['robots', 'ربات Telepresence را ثبت کنید', 'نام و مشخصات دستگاه را وارد کنید.'], ['accounts', 'اپراتورها را آماده کنید', 'حساب‌های مناسب اعضای تیم را بسازید.'], ['operator', 'تماس را شروع کنید', 'دوربین و تجهیزات را در صفحه اپراتور بررسی کنید.']] : [['robots', 'وضعیت ربات‌ها را ببینید', 'یک دستگاه آماده برای تماس انتخاب کنید.'], ['operator', 'به مرکز تماس بروید', 'تماس تصویری و کنترل دستی را از صفحه اپراتور آغاز کنید.']];
  steps.forEach(([view, heading, description], index) => { const button = node('button', 'setup-step'); button.type = 'button'; button.dataset.view = view; button.append(node('span', 'step-number', (index + 1).toLocaleString('fa-IR')), node('strong', '', heading), node('span', 'muted', description)); checklist.append(button); });
  updateControls();
}
function renderRobots() {
  const box = pq('#robotRecords'); box.replaceChildren(); visibleRobots().forEach(robot => box.append(robotRow(robot, admin())));
  if (!box.childElementCount) box.append(node('p', 'empty-state', 'در این محیط و حالت، رباتی ثبت نشده است.'));
}

function syncJSON() { if (draft && !jsonPending) pq('#directoryJSON').value = JSON.stringify(draft, null, 2); }
function options(select, list, blank = true) {
  const previous = select.value; select.replaceChildren(); if (blank) select.add(new Option('انتخاب کنید', ''));
  for (const item of list) select.add(new Option(`${item.name || item.username} (${item.id})`, item.id)); select.value = previous;
}
function fieldsValue(form, schema, raw = false) {
  const values = {};
  for (const [name, , type] of schema.fields) { const field = form.elements[name]; values[name] = type === 'boolean' ? field.checked : raw ? field.value : type === 'number' ? Number(field.value) : type === 'array' ? field.value.split(/[,،]/).map(v => v.trim()).filter(Boolean) : field.value.trim(); }
  return values;
}
function captureForms() { for (const [key, state] of formStates) { if (state.form) { state.values = fieldsValue(state.form, schemas[key], true); state.open = state.form.closest('details').open; } } }
function commitForm(key, state) {
  if (!state.pending) return;
  if (!state.form.checkValidity()) throw new Error(`فرم «${schemas[key].title}» را تکمیل کنید یا تغییرات آن را کنار بگذارید.`);
  const item = fieldsValue(state.form, schemas[key]), editing = state.editing ? draft[key].indexOf(state.editing) : -1;
  if (key !== 'edges' && draft[key].some((record, index) => record.id === item.id && index !== editing)) throw new Error('شناسه تکراری است.');
  if (editing < 0) draft[key].push(item); else draft[key][editing] = item;
  state.pending = false; state.editing = null; state.values = null; state.form.reset(); directoryDirty = true;
}
function renderBuilder() {
  if (!draft || !adminState || !admin()) return;
  captureForms(); pq('#directoryName').value = draft.name;
  for (const selector of ['#directoryBuilder', '#roomBuilder', '#peopleBuilder']) pq(selector).replaceChildren();
  for (const [key, schema] of Object.entries(schemas)) {
    const state = formStates.get(key) || { editing: null, pending: false, values: null, open: ['rooms', 'people'].includes(key) }; formStates.set(key, state);
    const details = node('details', 'editor-group'); details.open = state.open;
    details.append(node('summary', '', `${schema.title} (${draft[key].length.toLocaleString('fa-IR')})`));
    const records = node('div', 'record-list'), form = node('form', 'split'); state.form = form;
    for (const [name, label, type] of schema.fields) {
      const wrapper = node('label', '', label), input = document.createElement(['floors', 'nodes', 'rooms', 'staff'].includes(type) ? 'select' : 'input'); input.name = name;
      if (input.tagName === 'SELECT') { options(input, type === 'staff' ? adminState.users.filter(user => ['staff', 'admin'].includes(user.role) && user.active) : draft[type]); input.required = ['floorId', 'nodeId', 'roomId', 'from', 'to'].includes(name); }
      else if (type === 'boolean') { input.type = 'checkbox'; input.checked = true; wrapper.className = 'check-label'; }
      else if (type === 'number') { input.type = 'number'; input.step = 'any'; input.min = name === 'distance' ? '0.01' : '0'; input.max = name === 'distance' ? '10000' : '100'; input.required = true; }
      else { input.maxLength = ['instruction', 'reverseInstruction'].includes(name) ? 500 : 160; input.required = ['id', 'name', 'instruction', 'reverseInstruction'].includes(name); }
      if (state.values) { if (type === 'boolean') input.checked = !!state.values[name]; else input.value = state.values[name] ?? ''; }
      wrapper.append(input); form.append(wrapper);
    }
    const submit = node('button', 'btn primary', 'ثبت در پیش‌نویس'); form.append(submit);
    const reset = node('button', 'btn', 'مورد جدید'); reset.type = 'button'; reset.onclick = () => { state.editing = null; state.pending = false; state.values = null; form.reset(); refreshDirty(); }; form.append(reset);
    form.addEventListener('input', () => { state.pending = true; refreshDirty(); }); form.addEventListener('change', () => { state.pending = true; refreshDirty(); });
    draft[key].forEach(item => {
      const row = node('div', 'record'), label = node('span', '', item.name || `${item.from} ← ${item.to}`), edit = node('button', 'btn', 'ویرایش'), remove = node('button', 'btn', 'حذف از پیش‌نویس');
      edit.type = remove.type = 'button'; edit.onclick = () => { state.editing = item; state.pending = false; for (const [name, , type] of schema.fields) { const input = form.elements[name]; if (type === 'boolean') input.checked = item[name]; else input.value = type === 'array' ? (item[name] || []).join(', ') : item[name] ?? ''; } refreshDirty(); };
      remove.onclick = () => { draft[key].splice(draft[key].indexOf(item), 1); if (state.editing === item) { state.pending = false; state.editing = null; state.values = null; form.reset(); } directoryDirty = true; syncJSON(); renderBuilder(); };
      row.append(label, edit, remove); records.append(row);
    });
    form.onsubmit = event => { event.preventDefault(); if (!admin() || loading || mutations) return; try { state.pending = true; commitForm(key, state); syncJSON(); renderBuilder(); text('#portalStatus', 'تغییر در پیش‌نویس ثبت شد؛ برای اعمال، ذخیره تغییرات را بزنید.'); } catch (e) { error(e); } };
    details.append(records, form); pq(key === 'rooms' ? '#roomBuilder' : key === 'people' ? '#peopleBuilder' : '#directoryBuilder').append(details);
  }
  syncJSON(); refreshSelects(); refreshDirty();
}
function refreshSelects() {
  if (!draft || !adminState) return;
  options(pq('#robotForm').elements.startNodeId, draft.nodes);
  refreshAccountRobots();
  options(pq('#passwordForm').elements.userId, adminState.users);
}
function refreshAccountRobots() {
  if (!admin() || !adminState) return;
  const all = adminState.allRobots || adminState.robots;
  options(pq('#accountForm').elements.robotId, all.filter(robot => robot.active).map(robot => ({ ...robot, name: `${robot.name} · ${workspaces.find(w => w.id === (robot.workspaceId || 'legacy'))?.name || 'داده‌های قبلی'}` })));
}
async function saveDirectory() {
  requireAdmin(); const id = activeWorkspace.id, generation = routeGeneration;
  if (jsonPending) {
    if ([...formStates.values()].some(state => state.pending)) throw new Error('ابتدا تغییرات فرم‌ها یا JSON را در پیش‌نویس ثبت کنید.');
    const data = JSON.parse(pq('#directoryJSON').value);
    const validated = await Platform.api(scope('/admin/directory/validate', id), { method: 'POST', body: data });
    if (!current(id, generation)) return;
    draft = validated; formStates.clear(); jsonPending = false; directoryDirty = true;
  }
  for (const [key, state] of formStates) commitForm(key, state);
  refreshDirty(); syncJSON(); renderBuilder();
  const saved = await Platform.api(scope('/admin/directory', id), { method: 'PUT', body: structuredClone(draft) });
  if (!current(id, generation)) return;
  draft = saved; adminState.directory = structuredClone(saved); directoryDirty = jsonPending = false; formStates.clear(); renderBuilder();
  await refreshWorkspaces(); if (current(id, generation)) { renderOverview(); text('#portalStatus', 'اطلاعات این محیط ذخیره شد.'); }
}
async function reloadAdminLists() {
  requireAdmin(); const id = activeWorkspace.id, generation = routeGeneration;
  const result = await Platform.api(scope('/admin/state', id)); if (!current(id, generation)) return;
  adminState.users = result.users; adminState.robots = result.robots; adminState.allRobots = result.allRobots;
  const live = await Platform.api(scope('/robots', id) + '&mode=' + currentMode);
  if (!current(id, generation)) return;
  robots = live;
  renderRobots(); renderAccounts(); refreshSelects(); await refreshWorkspaces(); if (current(id, generation)) renderOverview();
}
function resetRobotForm() { const form = pq('#robotForm'); form.reset(); form.elements.id.readOnly = false; form.elements.mode.value = currentMode || 'welcome'; }
function renderAccounts() {
  if (!adminState || !admin()) return;
  const box = pq('#userRecords'); box.replaceChildren();
  const roleNames = { admin: 'مدیر', staff: 'کارکنان', operator: 'اپراتور', robot: 'دستگاه ربات' };
  for (const user of adminState.users) {
    const row = node('div', 'record'), label = node('span', '', `${user.name} · ${user.username} · ${roleNames[user.role]} · ${user.active ? 'فعال' : 'غیرفعال'}`), button = node('button', 'btn', user.active ? 'غیرفعال‌کردن' : 'فعال‌کردن');
    button.type = 'button'; button.disabled = user.id === Platform.user.id;
    button.onclick = () => action(async () => { requireAdmin(); await Platform.api('/admin/users/' + user.id, { method: 'PUT', body: { active: !user.active } }); await reloadAdminLists(); }); row.append(label, button); box.append(row);
  }
}

async function loadInbox() {
  if (!activeWorkspace || currentView !== 'inbox' || !['staff', 'admin'].includes(Platform.user?.role)) return;
  if (inboxLoading) { inboxAgain = true; return; }
  inboxLoading = true; const id = activeWorkspace.id, generation = routeGeneration;
  try {
    const visits = await Platform.api(scope('/inbox', id));
    if (!current(id, generation) || currentView !== 'inbox') return;
    const box = pq('#inbox'); box.replaceChildren();
    if (!visits.length) box.append(node('p', 'empty-state', 'در این محیط، مراجعه‌ای برای شما ثبت نشده است.'));
    for (const visit of visits) {
      const article = node('article', 'inbox-card panel'), actions = node('div', 'actions');
      article.append(node('h3', '', `${visit.visitor || 'مراجعه‌کننده'} ← ${visit.destination}`), node('p', 'muted', `${new Date(visit.createdAt).toLocaleString('fa-IR')} · ${labels[visit.status]}`), node('p', '', visit.note), node('p', '', visit.response));
      const button = (label, status, response) => { const element = node('button', 'btn', label); element.type = 'button'; element.onclick = () => action(async () => {
        if (!current(id, generation)) return;
        element.disabled = true; try { await Platform.api('/visits/' + visit.id, { method: 'POST', body: { status, response } }); await loadInbox(); } finally { element.disabled = false; }
      }, id); actions.append(element); };
      if (['registered', 'delivered'].includes(visit.status)) button('دیدم', 'seen');
      button('تشریف بیاورید', 'responded', 'تشریف بیاورید'); button('لطفاً منتظر بمانید', 'responded', 'لطفاً منتظر بمانید'); button('الان در دسترس نیستم', 'responded', 'الان در دسترس نیستم');
      article.append(actions); box.append(article);
    }
    for (const visit of visits.filter(v => v.status === 'registered')) {
      if (!current(id, generation) || currentView !== 'inbox') break;
      await Platform.api('/visits/' + visit.id, { method: 'POST', body: { status: 'delivered' } });
    }
  } catch (e) { if (current(id, generation)) error(e); }
  finally { inboxLoading = false; if (inboxAgain) { inboxAgain = false; loadInbox(); } }
}
function refreshMigration() {
  const button = pq('#importLegacyBtn'); if (!button) return;
  const legacy = workspaces.some(w => w.id === 'legacy');
  const empty = !!adminState && !adminState.robots.length && ['floors', 'nodes', 'edges', 'rooms', 'people'].every(key => !adminState.directory[key].length);
  button.disabled = !admin() || !activeWorkspace || activeWorkspace.id === 'legacy' || !legacy || !empty || dirty || loading || !!mutations;
  text('#legacyImportHint', !legacy ? 'اطلاعات قبلی برای انتقال وجود ندارد.' : activeWorkspace?.id === 'legacy' ? 'برای انتقال، یکی از محیط‌های خالی را انتخاب کنید.' : !empty ? 'این محیط اطلاعات دارد؛ انتقال به آن انجام نمی‌شود.' : dirty ? 'ابتدا پیش‌نویس را ذخیره یا کنار بگذارید.' : 'انتقال فقط پس از تأیید شما انجام می‌شود.');
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-workspace], [data-mode], [data-view], [data-action]'); if (!button || button.disabled || !Platform.user) return;
  if (button.dataset.workspace) navigate(routeHash(button.dataset.workspace));
  else if (button.dataset.mode && activeWorkspace) navigate(routeHash(activeWorkspace.id, button.dataset.mode, Platform.user.role === 'staff' ? 'inbox' : 'overview'));
  else if (button.dataset.view && activeWorkspace && currentMode) navigate(routeHash(activeWorkspace.id, currentMode, button.dataset.view));
  else if (button.dataset.action === 'categories') navigate('#/');
  else if (button.dataset.action === 'modes' && activeWorkspace) navigate(routeHash(activeWorkspace.id));
  else if (button.dataset.action === 'save-directory') action(saveDirectory);
});
pq('#legacyWorkspace').onclick = () => navigate(routeHash('legacy'));
pq('#logoutBtn').onclick = async () => { if (mutations || !await confirmDraft()) return; directoryDirty = jsonPending = false; formStates.clear(); refreshDirty(); Platform.logout().finally(() => location.reload()); };
pq('#refreshInbox').onclick = loadInbox;
pq('#directoryName').oninput = event => { if (!draft || !admin()) return; draft.name = event.target.value; directoryDirty = true; syncJSON(); refreshDirty(); };
pq('#directoryJSON').oninput = () => { if (admin() && draft) { jsonPending = true; refreshDirty(); } };
pq('#saveDirectory').onclick = () => action(saveDirectory);
pq('#reloadDirectory').onclick = async () => { if (!await confirmDraft()) return; navigate(committedHash, { replace: true, reload: true }); };
pq('#applyJSON').onclick = () => action(async () => {
  requireAdmin(); const id = activeWorkspace.id, generation = routeGeneration, data = JSON.parse(pq('#directoryJSON').value);
  const validated = await Platform.api(scope('/admin/directory/validate', id), { method: 'POST', body: data }); if (!current(id, generation)) return;
  draft = validated; formStates.clear(); jsonPending = false; directoryDirty = true; renderBuilder(); text('#portalStatus', 'JSON وارد پیش‌نویس شد؛ هنوز ذخیره نشده است.');
});
pq('#importFile').onchange = event => action(async () => {
  requireAdmin(); const file = event.target.files[0]; if (!file) return;
  if (file.size > 262144) throw new Error('فایل باید کمتر از ۲۵۶ کیلوبایت باشد.');
  const id = activeWorkspace.id, generation = routeGeneration, data = JSON.parse(await file.text());
  const validated = await Platform.api(scope('/admin/directory/validate', id), { method: 'POST', body: data }); if (!current(id, generation)) return;
  draft = validated; formStates.clear(); jsonPending = false; directoryDirty = true; renderBuilder(); event.target.value = ''; text('#portalStatus', 'فایل وارد پیش‌نویس شد؛ برای اعمال، ذخیره تغییرات را بزنید.');
});
pq('#exportJSON').onclick = () => { if (!draft || !admin()) return; const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })), anchor = document.createElement('a'); anchor.href = url; anchor.download = `${activeWorkspace.id}-directory.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
pq('#loadExample').onclick = () => action(async () => {
  requireAdmin();
  draft = { name: 'ساختمان آزمایشی — اطلاعات واقعی نیست', floors: [{ id: 'ground', name: 'همکف' }], nodes: [{ id: 'reception', name: 'پذیرش', floorId: 'ground', x: 20, y: 50 }, { id: 'manager', name: 'اتاق مدیر', floorId: 'ground', x: 80, y: 50 }], edges: [{ from: 'reception', to: 'manager', distance: 12, instruction: 'راهرو را تا اتاق مدیر ادامه دهید.', reverseInstruction: 'راهرو را تا پذیرش ادامه دهید.', accessible: true, bidirectional: true }], rooms: [{ id: 'manager-room', name: 'اتاق مدیر', nodeId: 'manager', number: '۱۰۱', department: 'مدیریت', hours: '۹ تا ۱۵ — نمونه', aliases: ['مدیر'], active: true }], people: [] };
  formStates.clear(); jsonPending = false; directoryDirty = true; renderBuilder(); text('#portalStatus', 'مثال آزمایشی وارد پیش‌نویس شد؛ اطلاعات واقعی خود را جایگزین کنید.');
});
pq('#newRobot').onclick = resetRobotForm;
pq('#robotForm').onsubmit = event => { event.preventDefault(); action(async () => {
  requireAdmin(); const form = event.target, body = Object.fromEntries(new FormData(form)); body.workspaceId = activeWorkspace.id; body.active = form.elements.active.checked; body.serial = body.serial.trim().toUpperCase();
  await Platform.api('/admin/robots', { method: 'POST', body }); await reloadAdminLists(); resetRobotForm(); text('#portalStatus', 'ربات در این محیط ذخیره شد.');
}); };
pq('#accountForm').onsubmit = event => { event.preventDefault(); action(async () => { requireAdmin(); await Platform.api('/admin/users', { method: 'POST', body: Object.fromEntries(new FormData(event.target)) }); event.target.reset(); await reloadAdminLists(); renderBuilder(); text('#portalStatus', 'حساب مشترک سامانه ساخته شد. برای اعلان، آن را به فرد مقصد متصل کنید.'); }); };
pq('#passwordForm').onsubmit = event => { event.preventDefault(); action(async () => { requireAdmin(); const form = event.target, user = adminState.users.find(u => u.id === form.elements.userId.value); if (!user) throw new Error('حساب را انتخاب کنید.'); await Platform.api('/admin/users/' + user.id, { method: 'PUT', body: { active: user.active, password: form.elements.password.value } }); form.elements.password.value = ''; text('#portalStatus', 'رمز تغییر کرد و نشست‌های قبلی لغو شدند.'); }); };
pq('#importLegacyBtn').onclick = () => { if (pq('#importLegacyBtn').disabled) return; legacyImportWorkspaceId = activeWorkspace.id; text('#legacyImportName', `انتقال اطلاعات فعلی به ${activeWorkspace.name}`); showDialog(pq('#legacyImportDialog')); };
pq('#cancelLegacyImport').onclick = () => { if (!mutations) { closeDialog(pq('#legacyImportDialog')); legacyImportWorkspaceId = null; } };
pq('#legacyImportDialog').addEventListener('cancel', event => { if (mutations) event.preventDefault(); else legacyImportWorkspaceId = null; });
pq('#confirmLegacyImport').onclick = () => action(async () => {
  requireAdmin(); const id = legacyImportWorkspaceId;
  if (!id || id !== activeWorkspace.id) { closeDialog(pq('#legacyImportDialog')); legacyImportWorkspaceId = null; throw new Error('محیط انتخاب‌شده تغییر کرده است؛ انتقال را دوباره از همان محیط آغاز کنید.'); }
  pq('#confirmLegacyImport').disabled = true;
  try { await Platform.api('/admin/workspaces/' + encodeURIComponent(id) + '/import-legacy', { method: 'POST', body: {} }); closeDialog(pq('#legacyImportDialog')); legacyImportWorkspaceId = null; await refreshWorkspaces(); await navigate(committedHash, { replace: true, reload: true, allowMutation: true }); text('#portalStatus', 'اطلاعات قبلی به این محیط منتقل شد.'); }
  catch (e) { closeDialog(pq('#legacyImportDialog')); legacyImportWorkspaceId = null; throw e; }
  finally { pq('#confirmLegacyImport').disabled = false; }
});
window.addEventListener('hashchange', () => navigate(location.hash, { browser: true }));
window.addEventListener('popstate', () => { if (location.hash !== committedHash) navigate(location.hash, { browser: true }); });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
function updateConnection(connection = Platform.connection) {
  const state = connection.state === 'ready' && (!Platform.user || Platform.connected) ? 'ready' : connection.state === 'checking' ? 'checking' : 'offline';
  pq('#portalConnection').dataset.state = state;
  text('#portalConnection', state === 'ready' ? Platform.user ? 'متصل' : 'سرور آماده است' : state === 'checking' ? 'بررسی اتصال' : 'ارتباط قطع است');
}
Platform.on('expired', () => { routeGeneration++; loading = false; pq('#portalAuthed').hidden = true; pq('#authScreen').hidden = false; pq('#logoutBtn').hidden = true; pq('#adminPanel').hidden = true; text('#accountName', ''); if (unsavedResolve) finishUnsaved(false); closeDialog(pq('#legacyImportDialog')); legacyImportWorkspaceId = null; updateConnection(); });
Platform.on('backend:status', updateConnection);
Platform.on('connected', () => { updateConnection(); loadInbox(); });
Platform.on('disconnected', () => updateConnection());
Platform.on('connection:error', () => updateConnection());
Platform.on('visit', () => loadInbox());
Platform.on('robots', list => {
  if (!Array.isArray(list) || !activeWorkspace || !currentMode || !['admin', 'operator'].includes(Platform.user?.role)) return;
  if (loading) { pendingRobotSnapshot = list; return; }
  reconcileRobotSnapshot(list); refreshAccountRobots(); renderOverview(); renderRobots(); refreshMigration();
});
Platform.loginForm(pq('#portalAuth'), async user => {
  if (!permitted[user.role]) throw new Error('این پنل مخصوص اعضای تیم و مدیر سامانه است.');
  if (authenticatedUserId && (authenticatedUserId !== user.id || authenticatedRole !== user.role)) { adminState = draft = null; activeWorkspace = null; loadedWorkspaceId = loadedMode = null; robots = []; formStates.clear(); directoryDirty = jsonPending = false; refreshDirty(); }
  authenticatedUserId = user.id; authenticatedRole = user.role; text('#accountName', user.name); pq('#logoutBtn').hidden = false; pq('#adminPanel').hidden = user.role !== 'admin';
  await refreshWorkspaces(); pq('#authScreen').hidden = true; pq('#portalAuthed').hidden = false; updateConnection(); await navigate(location.hash, { replace: true });
}, ['admin', 'staff', 'operator']);
updateConnection();
