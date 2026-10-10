'use strict';
const $p = id => document.getElementById(id);
let state = null, step = 1, screen = 'loginScreen', returnScreen = 'homeScreen', thread = null;
let logo = '', documentFile, importedDirectory, activeCall = null, pendingIncoming = null;
let peer = null, stream = null, remoteStream = null, iceQueue = [], signalQueue = [], signalChain = Promise.resolve(), callGeneration = 0;
const messageIds = new Set();
const admin = () => Platform.user?.role === 'admin';
function show(id) { for (const section of document.querySelectorAll('#main > .screen')) section.hidden = section.id !== id; screen = id; $p('appError').textContent = ''; $p('appStatus').textContent = ''; $p('settingsButton').hidden = id !== 'homeScreen'; }
function error(e) { $p('appError').textContent = e.message || String(e); }
async function act(fn, button) { if (button?.disabled) return; if (button) button.disabled = true; $p('appError').textContent = ''; try { await fn(); } catch (e) { error(e); } finally { if (button) button.disabled = false; } }
const api = (path, options) => Platform.api('/organization' + path, options);
function robot() { return state?.robots.find(r => r.id === ($p('setupRobot').value || state.setup.robotId)); }
function qrURL() { const url = new URL(CONFIG.publicUserPage || 'user.html', location.href); url.pathname = url.pathname.replace(/user(?:\.html)?$/, 'portal.html'); url.search = ''; url.hash = ''; if (robot()) url.searchParams.set('robot', robot().id); return url.href; }
function renderQR(id) { const code = qrcode(0, 'M'); code.addData(qrURL()); code.make(); $p(id).innerHTML = code.createSvgTag({ cellSize: 5, margin: 20, scalable: true }); }
function setStep(n) {
  step = n; show('wizardScreen');
  for (let i = 1; i <= 5; i++) $p('step' + i).hidden = i !== n;
  $p('stepIndicator').replaceChildren(...Array.from({ length: 5 }, (_, i) => { const e = document.createElement('span'); e.className = i < n ? 'active' : ''; if (i + 1 === n) e.setAttribute('aria-current', 'step'); return e; }));
  $p('wizardOrganization').hidden = !admin(); $p('wizardPerson').hidden = !admin();
  if (n === 4) renderQR('setupQR');
  history.replaceState(null, '', location.pathname + location.search + '#setup/' + n);
}
function applyBrand() {
  $p('brandName').textContent = state.profile.name || 'فضای ربات';
  $p('splashBrand').textContent = state.profile.name || 'فضای ربات';
  $p('splashLogo').src = state.profile.logo || 'robot-avatar.svg';
  $p('splashLogo').style.borderRadius = state.profile.logo ? '18px' : '';
}
async function loadState() {
  state = await api('/state'); applyBrand();
  const select = $p('setupRobot'), wanted = new URLSearchParams(location.search).get('robot') || state.setup.robotId;
  select.replaceChildren();
  for (const r of state.robots) select.add(new Option(`${r.name} · ${r.serial}`, r.id));
  if (admin()) select.add(new Option('+ ربات جدید', ''));
  if (state.robots.some(r => r.id === wanted)) select.value = wanted;
  $p('setupName').value = state.setup.name || robot()?.name || 'آوا';
  $p('robotAddress').value = state.setup.address || '';
  $p('robotAddress').required = Platform.user.role !== 'staff';
  $p('openPerson').hidden = $p('openReset').hidden = !admin();
}
function home() {
  show('homeScreen'); $p('greetingName').textContent = Platform.user.name;
  $p('organizationCaption').textContent = state.profile.name || 'فضای سازمان شما';
  $p('homeRobotName').textContent = state.setup.name || robot()?.name || 'ربات من';
  $p('homeFootnote').textContent = Platform.user.role === 'staff' ? 'برای دریافت تماس، این صفحه را باز نگه دارید.' : 'ارتباطی ساده، حضوری نزدیک.';
  $p('robotCard').disabled = !robot() || Platform.user.role === 'staff';
  history.replaceState(null, '', location.pathname + location.search + '#home');
}
async function ready(user) { if (!['admin', 'operator', 'staff'].includes(user.role)) throw new Error('با حساب عضو سازمان وارد شوید.'); await loadState(); $p('loginScreen').hidden = true; $p('logoutButton').hidden = false; if (state.setup.completed) home(); else setStep(1); }
for (const button of document.querySelectorAll('[data-next]')) button.onclick = () => setStep(Number(button.dataset.next));
for (const button of document.querySelectorAll('[data-back]')) button.onclick = () => setStep(Number(button.dataset.back));
for (const button of document.querySelectorAll('[data-home]')) button.onclick = home;
$p('setupRobot').onchange = () => { $p('setupName').value = robot()?.name || ''; };
$p('robotNameForm').onsubmit = e => { e.preventDefault(); setStep(4); };
$p('connectionForm').onsubmit = e => { e.preventDefault(); act(async () => {
  const result = await api('/setup', { method: 'POST', body: { robotId: $p('setupRobot').value, name: $p('setupName').value.trim(), address: $p('robotAddress').value.trim() } });
  await loadState(); $p('setupRobot').value = result.robotId; home();
}, e.submitter); };
$p('settingsButton').onclick = () => show('settingsScreen');
$p('logoutButton').onclick = () => act(async () => { closeRobot(); await endExpert(); await Platform.logout(); location.reload(); }, $p('logoutButton'));
function qrPage() { show('qrScreen'); renderQR('robotQR'); $p('qrRobotName').textContent = state.setup.name || robot()?.name || 'QR ربات'; $p('qrLink').href = qrURL(); $p('qrLink').textContent = qrURL(); }
$p('openQR').onclick = () => { returnScreen = 'settingsScreen'; qrPage(); };
$p('qrBack').onclick = () => show(returnScreen);
$p('copyQR').onclick = () => act(async () => { if (!navigator.clipboard) throw new Error('لینک را از متن بالای صفحه کپی کنید.'); await navigator.clipboard.writeText(qrURL()); $p('appStatus').textContent = 'لینک کپی شد.'; });
function download(data, type, name) { const url = URL.createObjectURL(new Blob([data], { type })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$p('downloadQR').onclick = () => download($p('robotQR').innerHTML, 'image/svg+xml', 'robot-qr.svg');
function organizationPage(from) {
  returnScreen = from; show('organizationScreen'); logo = state.profile.logo || ''; documentFile = undefined; importedDirectory = undefined;
  $p('organizationName').value = state.profile.name || ''; $p('organizationDescription').value = state.profile.description || '';
  $p('organizationFile').value = $p('logoFile').value = ''; $p('uploadedDocument').textContent = state.profile.document?.name || '';
  $p('organizationForm').querySelectorAll('input,textarea,button').forEach(e => e.disabled = !admin());
  $p('advancedMap').hidden = !admin(); $p('downloadDocument').hidden = !state.profile.document;
  $p('advancedMap').href = 'admin.html#/' + (robot()?.workspaceId || 'legacy') + '/welcome/map'; previewLogo();
}
function previewLogo() { const box = $p('logoPreview'); box.replaceChildren(); if (logo) { const img = document.createElement('img'); img.src = logo; img.alt = 'لوگوی سازمان'; box.append(img); } else box.textContent = 'لوگوی سازمان'; }
$p('wizardOrganization').onclick = () => organizationPage('wizardScreen');
$p('qrOrganization').onclick = () => organizationPage('qrScreen');
$p('organizationBack').onclick = () => returnScreen === 'wizardScreen' ? setStep(4) : qrPage();
function base64File(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('فایل خوانده نشد.')); reader.readAsDataURL(file); }); }
$p('logoFile').onchange = () => act(async () => {
  const file = $p('logoFile').files[0]; if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 65536) throw new Error('تصویر PNG، JPG یا WebP تا ۶۴ کیلوبایت انتخاب کنید.');
  const data = await base64File(file); const image = new Image(); image.src = data; await image.decode(); logo = data; previewLogo();
});
$p('organizationFile').onchange = () => act(async () => {
  const file = $p('organizationFile').files[0]; if (!file) return;
  if (/\.pdf$/i.test(file.name)) { if (file.size > 1048576) throw new Error('PDF باید کمتر از یک مگابایت باشد.'); const data = await base64File(file); documentFile = { name: file.name, mime: 'application/pdf', data: data.split(',')[1] }; $p('uploadedDocument').textContent = file.name; return; }
  if (file.size > 262144) throw new Error('فایل اطلاعات باید کمتر از ۲۵۶ کیلوبایت باشد.');
  if (/\.txt$/i.test(file.name)) { $p('organizationDescription').value = (await file.text()).slice(0, 3000); return; }
  const content = JSON.parse(await file.text());
  if (typeof content.name === 'string') $p('organizationName').value = content.name;
  if (typeof content.description === 'string') $p('organizationDescription').value = content.description;
  if (typeof content.logo === 'string' && content.logo.length <= 90000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(content.logo)) { logo = content.logo; previewLogo(); }
  importedDirectory = content.directory || (Array.isArray(content.floors) ? content : undefined);
  $p('uploadedDocument').textContent = file.name + ' — برای ثبت، ذخیره اطلاعات را بزنید.';
});
$p('organizationForm').onsubmit = e => { e.preventDefault(); act(async () => {
  await api('/profile', { method: 'PUT', body: { name: $p('organizationName').value.trim(), description: $p('organizationDescription').value, logo, robotId: robot()?.id || '', ...(documentFile !== undefined ? { document: documentFile } : {}), ...(importedDirectory ? { directory: importedDirectory } : {}) } });
  const result = await api('/state'); state.profile = result.profile; applyBrand(); $p('appStatus').textContent = 'اطلاعات سازمان ذخیره شد.'; importedDirectory = undefined; documentFile = undefined;
}, e.submitter); };
$p('downloadDocument').onclick = () => act(async () => { const file = await api('/document'); download(Uint8Array.from(atob(file.data), c => c.charCodeAt(0)), file.mime, file.name.replace(/[\\/]/g, '_')); });
function personPage(from) { returnScreen = from; show('personScreen'); $p('personForm').reset(); }
$p('wizardPerson').onclick = () => personPage('wizardScreen'); $p('openPerson').onclick = () => personPage('settingsScreen');
$p('personBack').onclick = () => returnScreen === 'wizardScreen' ? setStep(5) : show('settingsScreen');
$p('personForm').onsubmit = e => { e.preventDefault(); act(async () => { await Platform.api('/admin/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); $p('appStatus').textContent = 'همکار جدید با حساب و عنوان شغلی ثبت شد.'; }, e.submitter); };
$p('openReset').onclick = () => { $p('resetForm').reset(); $p('resetError').textContent = ''; $p('resetDialog').showModal(); };
$p('cancelReset').onclick = () => $p('resetDialog').close();
$p('resetForm').onsubmit = async e => { e.preventDefault(); const b = e.submitter; b.disabled = true; try { await api('/reset', { method: 'POST', body: { confirm: 'RESET', password: e.target.password.value } }); $p('resetDialog').close(); await loadState(); setStep(1); } catch (e) { $p('resetError').textContent = e.message; } finally { b.disabled = false; } };
function contactRow(contact, onClick) {
  const b = document.createElement('button'); b.className = 'glass expert-row';
  const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = contact.name.slice(0, 1);
  const copy = document.createElement('span'); copy.className = 'contact-copy'; const name = document.createElement('strong'), title = document.createElement('p'); name.textContent = contact.name; title.textContent = contact.title; copy.append(name, title);
  const status = document.createElement('span'); status.className = 'online-label'; status.textContent = contact.online ? 'آنلاین' : 'آفلاین'; b.append(avatar, copy, status); b.onclick = () => act(onClick, b); return b;
}
function empty(box, message) { const e = document.createElement('p'); e.className = 'empty'; e.textContent = message; box.append(e); }
async function expertsPage() {
  show('expertsScreen'); const result = await api('/state'); state.experts = result.experts;
  $p('expertList').replaceChildren(); for (const c of state.experts) $p('expertList').append(contactRow(c, async () => openThread(await api('/threads', { method: 'POST', body: { expertId: c.id } }))));
  if (!state.experts.length) empty($p('expertList'), 'هنوز همکاری ثبت نشده است. مدیر می‌تواند از تنظیمات فرد جدیدی اضافه کند.');
  const threads = await api('/threads'); $p('threadList').replaceChildren();
  for (const t of threads) $p('threadList').append(contactRow(t.contact, async () => openThread(await api('/threads/' + t.id))));
  if (!threads.length) empty($p('threadList'), 'گفتگوهای شما از اینجا در دسترس خواهند بود.');
}
$p('expertCard').onclick = () => act(expertsPage, $p('expertCard')); $p('chatBack').onclick = () => act(expertsPage);
function appendMessage(m) {
  if (messageIds.has(m.id)) return; messageIds.add(m.id);
  const e = document.createElement('div'); e.className = 'message' + (m.senderId === Platform.user.id ? ' mine' : '');
  const content = document.createElement('span'); content.textContent = m.text; const time = document.createElement('small'); time.textContent = new Date(m.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); e.append(content, time); $p('messages').append(e); $p('messages').scrollTop = $p('messages').scrollHeight;
}
function openThread(t) { thread = t; show('chatScreen'); $p('chatName').textContent = t.contact.name; $p('chatTitle').textContent = t.contact.title + (t.contact.online ? ' · آنلاین' : ' · آفلاین'); $p('messages').replaceChildren(); messageIds.clear(); t.messages.forEach(appendMessage); $p('messageInput').value = ''; }
$p('messageForm').onsubmit = e => { e.preventDefault(); act(async () => { if (!thread) return; const message = await api('/threads/' + thread.id + '/messages', { method: 'POST', body: { text: $p('messageInput').value } }); appendMessage(message); $p('messageInput').value = ''; }, e.submitter); };
Platform.on('expert:message', e => { if (thread?.id === e.threadId && screen === 'chatScreen') appendMessage(e.message); else $p('appStatus').textContent = 'پیام جدیدی در گفتگوهای شما ثبت شد.'; });
function closeRobot() { $p('robotCallScreen').hidden = true; $p('robotCallFrame').removeAttribute('src'); }
$p('robotCard').onclick = () => act(async () => {
  const selected = robot(); if (!selected) throw new Error('ابتدا ربات را انتخاب کنید.');
  const frame = $p('robotCallFrame'); $p('robotCallScreen').hidden = false;
  frame.onload = () => act(async () => {
    if ($p('robotCallScreen').hidden) return;
    const auth = await api('/robot-token', { method: 'POST', body: { robotId: selected.id } });
    if (!$p('robotCallScreen').hidden) frame.contentWindow.postMessage({ type: 'organization:robot-auth', auth: { ...auth, base: Platform.connection.base } }, location.origin);
  });
  frame.src = 'user.html?minimal=1&serial=' + encodeURIComponent(selected.serial);
}, $p('robotCard'));
window.addEventListener('message', e => { if (e.origin === location.origin && e.source === $p('robotCallFrame').contentWindow && e.data?.type === 'organization:robot-ended') { closeRobot(); if (e.data.error) error(new Error(e.data.error)); } });
async function media() { if (!navigator.mediaDevices?.getUserMedia) throw new Error('دوربین و میکروفن به HTTPS و مرورگر پشتیبان نیاز دارند.'); return navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
function callScreen(text) { $p('expertCallScreen').hidden = false; $p('expertCallStatus').textContent = text; if (stream) $p('expertSelf').srcObject = stream; }
async function buildPeer(c, localStream, generation) {
  const ice = await Platform.api('/ice'); if (generation !== callGeneration) { localStream?.getTracks().forEach(t => t.stop()); return; }
  await Platform.socketRequest('expert:join', { callId: c.id }); if (generation !== callGeneration) return;
  peer = new RTCPeerConnection({ iceServers: [...(CONFIG.iceServers || []), ...ice.servers] });
  remoteStream = new MediaStream(); $p('expertRemote').srcObject = remoteStream;
  for (const track of localStream.getTracks()) peer.addTrack(track, localStream);
  peer.ontrack = e => { if (generation === callGeneration) { remoteStream.addTrack(e.track); $p('expertCallStatus').textContent = 'تماس برقرار شد'; } };
  peer.onicecandidate = e => { if (generation === callGeneration) Platform.socketRequest('expert:signal', { callId: c.id, type: 'ice', candidate: e.candidate?.toJSON() || null }).catch(() => endExpert('ارتباط سیگنال قطع شد.')); };
  peer.onconnectionstatechange = () => { if (generation === callGeneration && peer?.connectionState === 'failed') endExpert('برقراری تماس ممکن نشد.'); };
  for (const item of signalQueue.splice(0)) queueSignal(item);
  if (c.from === Platform.user.id) { const offer = await peer.createOffer(); await peer.setLocalDescription(offer); await Platform.socketRequest('expert:signal', { callId: c.id, type: 'offer', description: peer.localDescription.toJSON() }); }
}
function queueSignal(e) { signalChain = signalChain.then(async () => {
  if (e.callId !== (activeCall || pendingIncoming)?.id) return;
  if (!activeCall) { signalQueue.push(e); return; }
  if (!peer) { signalQueue.push(e); return; }
  if (e.type === 'ice') { if (!peer.remoteDescription) iceQueue.push(e.candidate); else if (e.candidate) await peer.addIceCandidate(e.candidate); return; }
  await peer.setRemoteDescription(e.description); for (const candidate of iceQueue.splice(0)) if (candidate) await peer.addIceCandidate(candidate);
  if (e.type === 'offer') { const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); await Platform.socketRequest('expert:signal', { callId: activeCall.id, type: 'answer', description: peer.localDescription.toJSON() }); }
}).catch(() => endExpert('تماس قطع شد؛ دوباره تلاش کنید.')); }
async function endExpert(message, notify = true) {
  const c = activeCall || pendingIncoming; callGeneration++; activeCall = pendingIncoming = null; signalQueue = []; iceQueue = [];
  peer?.close(); peer = null; stream?.getTracks().forEach(t => t.stop()); stream = null; remoteStream = null;
  $p('expertRemote').srcObject = $p('expertSelf').srcObject = null; $p('expertCallScreen').hidden = true; $p('incomingDialog').close();
  if (c && notify) await api('/calls/' + c.id, { method: 'DELETE' }).catch(() => {});
  if (message) $p('appStatus').textContent = message;
}
$p('expertCallButton').onclick = () => act(async () => {
  if (activeCall || pendingIncoming || !thread) return;
  const generation = ++callGeneration; const obtained = await media();
  if (generation !== callGeneration) { obtained.getTracks().forEach(t => t.stop()); return; } stream = obtained;
  try { activeCall = await api('/threads/' + thread.id + '/call', { method: 'POST', body: {} }); callScreen('در انتظار پاسخ کارشناس…'); await Platform.socketRequest('expert:join', { callId: activeCall.id }); }
  catch (e) { await endExpert(); throw e; }
}, $p('expertCallButton'));
$p('expertHangup').onclick = () => act(() => endExpert());
$p('acceptExpert').onclick = () => act(async () => {
  if (!pendingIncoming || activeCall) return; const c = pendingIncoming, generation = ++callGeneration;
  const obtained = await media(); if (!pendingIncoming || generation !== callGeneration) { obtained.getTracks().forEach(t => t.stop()); return; }
  stream = obtained;
  try { activeCall = await api('/calls/' + c.id + '/accept', { method: 'POST', body: {} }); pendingIncoming = null; $p('incomingDialog').close(); callScreen('در حال اتصال…'); await buildPeer(activeCall, stream, generation); }
  catch (e) { await endExpert(); throw e; }
}, $p('acceptExpert'));
$p('rejectExpert').onclick = () => act(() => endExpert());
$p('incomingDialog').addEventListener('cancel', e => { e.preventDefault(); endExpert(); });
Platform.on('expert:signal', e => queueSignal(e));
Platform.on('expert:call', c => {
  if (c.state === 'ended') { if (activeCall?.id === c.id || pendingIncoming?.id === c.id) endExpert(c.reason, false); return; }
  if (c.state === 'ringing' && c.to === Platform.user?.id && !activeCall) { pendingIncoming = c; $p('incomingName').textContent = c.name; if (!$p('incomingDialog').open) $p('incomingDialog').showModal(); }
  if (c.state === 'active' && activeCall?.id === c.id && c.from === Platform.user?.id && !peer) { activeCall = c; callScreen('در حال اتصال…'); buildPeer(c, stream, callGeneration).catch(e => { endExpert(); error(e); }); }
});
Platform.on('organization:reset', () => act(async () => { closeRobot(); await endExpert(); await loadState(); setStep(1); }));
function connection() { const status = Platform.connection; $p('connectionStatus').dataset.state = status.state; $p('connectionStatus').textContent = status.state === 'ready' ? 'متصل' : status.state === 'checking' ? 'در حال اتصال' : 'اتصال قطع است'; }
Platform.on('backend:status', connection); Platform.on('connected', () => { connection(); if (screen === 'chatScreen' && thread) api('/threads/' + thread.id).then(openThread).catch(error); });
Platform.on('disconnected', () => { connection(); closeRobot(); endExpert('اتصال قطع شد. برای تماس دوباره تلاش کنید.', false); });
Platform.on('expired', () => { closeRobot(); endExpert(undefined, false); show('loginScreen'); $p('logoutButton').hidden = true; state = null; });
Platform.loginForm($p('portalAuth'), ready, ['admin', 'operator', 'staff']); connection();
window.addEventListener('pagehide', () => { stream?.getTracks().forEach(t => t.stop()); peer?.close(); if (activeCall) api('/calls/' + activeCall.id, { method: 'DELETE', keepalive: true }).catch(() => {}); });
