'use strict';
const pe = document.querySelector('#portalError'), ps = document.querySelector('#portalStatus');
let adminState = null, draft = null, dirty = false, inboxLoading = false, inboxAgain = false;
const labels = { registered: 'ثبت شده', delivered: 'تحویل شده', seen: 'دیده شده', responded: 'پاسخ داده شده' };
const schemas = {
  floors: { title: 'طبقات', fields: [['id', 'شناسه'], ['name', 'نام']] },
  nodes: { title: 'نقاط نقشه', fields: [['id', 'شناسه'], ['name', 'نام'], ['floorId', 'طبقه', 'floors'], ['x', 'مختصات افقی ۰ تا ۱۰۰', 'number'], ['y', 'مختصات عمودی ۰ تا ۱۰۰', 'number']] },
  edges: { title: 'مسیرهای بین نقاط', fields: [['from', 'از نقطه', 'nodes'], ['to', 'به نقطه', 'nodes'], ['distance', 'فاصله (متر)', 'number'], ['instruction', 'راهنمای رفت'], ['reverseInstruction', 'راهنمای برگشت'], ['accessible', 'بدون پله', 'boolean'], ['bidirectional', 'دوطرفه', 'boolean']] },
  rooms: { title: 'اتاق‌ها و واحدها', fields: [['id', 'شناسه'], ['name', 'نام'], ['nodeId', 'نقطه نقشه', 'nodes'], ['number', 'شماره اتاق'], ['department', 'واحد'], ['hours', 'ساعات مراجعه'], ['aliases', 'نام‌های دیگر (با کاما جدا کنید)', 'array'], ['active', 'فعال', 'boolean']] },
  people: { title: 'افراد و دریافت‌کننده اعلان', fields: [['id', 'شناسه'], ['name', 'نام فرد'], ['title', 'سمت'], ['roomId', 'اتاق', 'rooms'], ['availability', 'وضعیت قابل نمایش'], ['aliases', 'نام‌های دیگر (با کاما جدا کنید)', 'array'], ['userId', 'حساب دریافت اعلان', 'staff'], ['active', 'فعال', 'boolean']] },
};
function error(e) { pe.textContent = e.message || String(e); }
async function action(fn) { pe.textContent = ''; ps.textContent = ''; try { await fn(); } catch (e) { error(e); } }
document.querySelector('#logoutBtn').onclick = () => Platform.logout().finally(() => location.reload());
Platform.on('expired', () => { document.querySelector('#staffPanel').hidden = true; document.querySelector('#adminPanel').hidden = true; });
Platform.on('connected', () => { ps.textContent = 'ارتباط لحظه‌ای برقرار است'; if (['staff', 'admin'].includes(Platform.user?.role)) loadInbox(); });
Platform.on('disconnected', () => { ps.textContent = 'ارتباط لحظه‌ای قطع است؛ مراجعه‌ها در سرور ذخیره می‌شوند.'; });
Platform.on('visit', () => loadInbox());
document.querySelector('#refreshInbox').onclick = loadInbox;
async function loadInbox() {
  if (!['staff', 'admin'].includes(Platform.user?.role)) return;
  if (inboxLoading) { inboxAgain = true; return; }
  inboxLoading = true;
  try {
    const visits = await Platform.api('/inbox'), box = document.querySelector('#inbox'); box.replaceChildren();
    if (!visits.length) { const p = document.createElement('p'); p.textContent = 'مراجعه‌ای برای شما ثبت نشده است.'; box.append(p); }
    for (const v of visits) {
      const article = document.createElement('article'); article.className = 'panel';
      const heading = document.createElement('h3'); heading.textContent = `${v.visitor || 'مراجعه‌کننده'} ← ${v.destination}`;
      const time = document.createElement('p'); time.className = 'muted'; time.textContent = `${new Date(v.createdAt).toLocaleString('fa-IR')} · ${labels[v.status]}`;
      const note = document.createElement('p'); note.textContent = v.note;
      const response = document.createElement('p'); response.textContent = v.response;
      const actions = document.createElement('div'); actions.className = 'actions';
      const button = (label, status, response) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.onclick = () => action(async () => { b.disabled = true; await Platform.api('/visits/' + v.id, { method: 'POST', body: { status, response } }); await loadInbox(); }); actions.append(b); };
      if (['registered', 'delivered'].includes(v.status)) button('دیدم', 'seen');
      button('تشریف بیاورید', 'responded', 'تشریف بیاورید'); button('لطفاً منتظر بمانید', 'responded', 'لطفاً منتظر بمانید'); button('الان در دسترس نیستم', 'responded', 'الان در دسترس نیستم');
      article.append(heading, time, note, response, actions); box.append(article);
      if (v.status === 'registered') await Platform.api('/visits/' + v.id, { method: 'POST', body: { status: 'delivered' } });
    }
  } catch (e) { error(e); }
  finally { inboxLoading = false; if (inboxAgain) { inboxAgain = false; loadInbox(); } }
}
function syncJSON() { document.querySelector('#directoryJSON').value = JSON.stringify(draft, null, 2); }
function options(select, list, blank = true) {
  const previous = select.value; select.replaceChildren();
  if (blank) select.add(new Option('انتخاب کنید', ''));
  for (const item of list) select.add(new Option(`${item.name || item.username} (${item.id})`, item.id));
  select.value = previous;
}
function renderBuilder() {
  document.querySelector('#directoryName').value = draft.name;
  const box = document.querySelector('#directoryBuilder'); box.replaceChildren();
  for (const [key, schema] of Object.entries(schemas)) {
    const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = `${schema.title} (${draft[key].length})`; details.append(summary);
    const records = document.createElement('div'); records.className = 'record-list';
    const form = document.createElement('form'); form.className = 'split'; let editing = -1;
    for (const [name, label, type] of schema.fields) {
      const wrapper = document.createElement('label'); wrapper.textContent = label;
      const input = document.createElement(type && ['floors', 'nodes', 'rooms', 'staff'].includes(type) ? 'select' : 'input'); input.name = name;
      if (input.tagName === 'SELECT') options(input, type === 'staff' ? adminState.users.filter(u => ['staff', 'admin'].includes(u.role) && u.active) : draft[type]);
      else if (type === 'boolean') { input.type = 'checkbox'; input.checked = true; wrapper.className = 'check-label'; }
      else if (type === 'number') { input.type = 'number'; input.step = 'any'; input.min = name === 'distance' ? '0.01' : '0'; input.max = name === 'distance' ? '10000' : '100'; input.required = true; }
      else { input.maxLength = name.includes('Instruction') || name === 'instruction' ? 500 : 160; input.required = ['id', 'name', 'instruction', 'reverseInstruction'].includes(name); }
      wrapper.append(input); form.append(wrapper);
    }
    const submit = document.createElement('button'); submit.className = 'btn primary'; submit.textContent = 'افزودن / ثبت در پیش‌نویس'; form.append(submit);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn'; reset.textContent = 'مورد جدید'; reset.onclick = () => { editing = -1; form.reset(); }; form.append(reset);
    draft[key].forEach((item, index) => {
      const row = document.createElement('div'); row.className = 'record'; const label = document.createElement('span'); label.textContent = item.name || `${item.from} → ${item.to}`;
      const edit = document.createElement('button'); edit.className = 'btn'; edit.textContent = 'ویرایش'; edit.onclick = () => { editing = index; for (const [name, , type] of schema.fields) { const input = form.elements[name]; if (type === 'boolean') input.checked = item[name]; else input.value = type === 'array' ? item[name].join(', ') : item[name] ?? ''; } };
      const remove = document.createElement('button'); remove.className = 'btn'; remove.textContent = 'حذف از پیش‌نویس'; remove.onclick = () => { draft[key].splice(index, 1); dirty = true; syncJSON(); renderBuilder(); };
      row.append(label, edit, remove); records.append(row);
    });
    form.onsubmit = e => {
      e.preventDefault(); const item = {};
      for (const [name, , type] of schema.fields) { const field = form.elements[name]; item[name] = type === 'boolean' ? field.checked : type === 'number' ? Number(field.value) : type === 'array' ? field.value.split(/[,،]/).map(x => x.trim()).filter(Boolean) : field.value.trim(); }
      if (key !== 'edges' && draft[key].some((r, i) => r.id === item.id && i !== editing)) { error(new Error('شناسه تکراری است.')); return; }
      if (editing < 0) draft[key].push(item); else draft[key][editing] = item;
      dirty = true; syncJSON(); renderBuilder();
    };
    details.append(records, form); box.append(details);
  }
  syncJSON(); refreshSelects();
}
document.querySelector('#directoryName').oninput = e => { draft.name = e.target.value; dirty = true; syncJSON(); };
function refreshSelects() {
  options(document.querySelector('#robotForm').elements.startNodeId, draft.nodes);
  options(document.querySelector('#accountForm').elements.robotId, adminState.robots);
  options(document.querySelector('#passwordForm').elements.userId, adminState.users);
}
async function loadAdmin() {
  adminState = await Platform.api('/admin/state'); draft = structuredClone(adminState.directory); dirty = false;
  renderBuilder(); renderAccounts(); renderRobots();
}
document.querySelector('#saveDirectory').onclick = () => action(async () => {
  document.querySelector('#saveDirectory').disabled = true;
  try { draft = await Platform.api('/admin/directory', { method: 'PUT', body: draft }); dirty = false; ps.textContent = 'اطلاعات مکان ذخیره شد.'; syncJSON(); } finally { document.querySelector('#saveDirectory').disabled = false; }
});
document.querySelector('#reloadDirectory').onclick = () => action(loadAdmin);
document.querySelector('#applyJSON').onclick = () => action(async () => {
  const data = JSON.parse(document.querySelector('#directoryJSON').value);
  if (!data || !['floors', 'nodes', 'edges', 'rooms', 'people'].every(k => Array.isArray(data[k])) || typeof data.name !== 'string') throw new Error('ساختار JSON نقشه معتبر نیست.');
  draft = await Platform.api('/admin/directory/validate', { method: 'POST', body: data }); dirty = true; renderBuilder(); ps.textContent = 'JSON وارد پیش‌نویس شد؛ هنوز ذخیره نشده است.';
});
document.querySelector('#importFile').onchange = e => action(async () => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 262144) throw new Error('فایل باید کمتر از ۲۵۶ کیلوبایت باشد.');
  document.querySelector('#directoryJSON').value = await file.text(); document.querySelector('#applyJSON').click(); e.target.value = '';
});
document.querySelector('#exportJSON').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'directory.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.querySelector('#loadExample').onclick = () => action(async () => {
  draft = { name: 'ساختمان آزمایشی — اطلاعات واقعی نیست', floors: [{ id: 'ground', name: 'همکف' }], nodes: [{ id: 'reception', name: 'پذیرش', floorId: 'ground', x: 20, y: 50 }, { id: 'manager', name: 'اتاق مدیر', floorId: 'ground', x: 80, y: 50 }], edges: [{ from: 'reception', to: 'manager', distance: 12, instruction: 'راهرو را تا اتاق مدیر ادامه دهید.', reverseInstruction: 'راهرو را تا پذیرش ادامه دهید.', accessible: true, bidirectional: true }], rooms: [{ id: 'manager-room', name: 'اتاق مدیر', nodeId: 'manager', number: '۱۰۱', department: 'مدیریت', hours: '۹ تا ۱۵ — نمونه', aliases: ['مدیر'], active: true }], people: [] };
  dirty = true; renderBuilder(); ps.textContent = 'مثال در پیش‌نویس وارد شد؛ برای اطلاعات واقعی ویرایش کنید.';
});
function renderRobots() {
  const box = document.querySelector('#robotRecords'); box.replaceChildren();
  for (const r of adminState.robots) {
    const row = document.createElement('div'); row.className = 'record'; const name = document.createElement('span'); name.textContent = `${r.name} · ${r.serial} · ${r.active ? 'فعال' : 'غیرفعال'}`;
    const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'ویرایش'; button.onclick = () => { const form = document.querySelector('#robotForm'); for (const k of ['id', 'name', 'serial', 'location', 'mode', 'startNodeId']) form.elements[k].value = r[k]; form.elements.active.checked = r.active; };
    row.append(name, button); box.append(row);
  }
}
document.querySelector('#newRobot').onclick = () => document.querySelector('#robotForm').reset();
document.querySelector('#robotForm').onsubmit = e => { e.preventDefault(); action(async () => {
  const form = e.target, b = Object.fromEntries(new FormData(form)); b.active = form.elements.active.checked; b.serial = b.serial.trim().toUpperCase();
  await Platform.api('/admin/robots', { method: 'POST', body: b }); adminState.robots = (await Platform.api('/admin/state')).robots; renderRobots(); refreshSelects(); ps.textContent = 'ربات ذخیره شد؛ دستگاه تنظیمات جدید را دریافت می‌کند.';
}); };
function renderAccounts() {
  const box = document.querySelector('#userRecords'); box.replaceChildren();
  for (const u of adminState.users) {
    const row = document.createElement('div'); row.className = 'record'; const name = document.createElement('span'); name.textContent = `${u.name} · ${u.username} · ${u.role} · ${u.active ? 'فعال' : 'غیرفعال'}`;
    const button = document.createElement('button'); button.className = 'btn'; button.textContent = u.active ? 'غیرفعال‌کردن' : 'فعال‌کردن'; button.disabled = u.id === Platform.user.id;
    button.onclick = () => action(async () => { await Platform.api('/admin/users/' + u.id, { method: 'PUT', body: { active: !u.active } }); adminState.users = (await Platform.api('/admin/state')).users; renderAccounts(); renderBuilder(); }); row.append(name, button); box.append(row);
  }
}
document.querySelector('#accountForm').onsubmit = e => { e.preventDefault(); action(async () => { await Platform.api('/admin/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); adminState.users = (await Platform.api('/admin/state')).users; renderAccounts(); renderBuilder(); ps.textContent = 'حساب ساخته شد. برای اعلان، حساب را به فرد مقصد متصل کنید.'; }); };
document.querySelector('#passwordForm').onsubmit = e => { e.preventDefault(); action(async () => { const form = e.target, u = adminState.users.find(u => u.id === form.elements.userId.value); if (!u) throw new Error('حساب را انتخاب کنید.'); await Platform.api('/admin/users/' + u.id, { method: 'PUT', body: { active: u.active, password: form.elements.password.value } }); form.elements.password.value = ''; ps.textContent = 'رمز تغییر کرد و جلسه‌های قبلی لغو شدند.'; }); };
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
Platform.loginForm(document.querySelector('#portalAuth'), async user => {
  if (!['admin', 'staff', 'operator'].includes(user.role)) throw new Error('این بخش مخصوص کارکنان و مدیر سازمان است.');
  document.querySelector('#accountName').textContent = user.name; document.querySelector('#logoutBtn').hidden = false;
  document.querySelector('#staffPanel').hidden = !['staff', 'admin'].includes(user.role); document.querySelector('#adminPanel').hidden = user.role !== 'admin';
  if (user.role === 'admin') await loadAdmin();
  await loadInbox();
}, ['admin', 'staff', 'operator']);
