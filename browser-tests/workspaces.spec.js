const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const categories = [
  ['university', 'دانشگاه'], ['hospital', 'بیمارستان'], ['office', 'اداره'], ['mall', 'مرکز خرید'], ['museum', 'موزه'],
];
const emptyDirectory = name => ({ name, floors: [], nodes: [], edges: [], rooms: [], people: [] });

// All requests in this suite are fulfilled with isolated in-memory fixtures.
// No deployment credentials, TURN provider, or actual accounts are involved.
async function workspaceFixture(page) {
  const directories = new Map(categories.map(([id, name]) => [id, emptyDirectory(name)]));
  directories.set('legacy', emptyDirectory('داده‌های قبلی'));
  const robots = [
    { id: 'h-welcome', workspaceId: 'hospital', serial: 'RB-HW01', name: 'پذیرش بیمارستان', mode: 'welcome', startNodeId: '', active: true, location: 'همکف' },
    { id: 'h-call', workspaceId: 'hospital', serial: 'RB-HT01', name: 'تماس بیمارستان', mode: 'telepresence', startNodeId: '', active: true, location: 'بخش اول' },
    { id: 'o-call', workspaceId: 'office', serial: 'RB-OT01', name: 'تماس اداره', mode: 'telepresence', startNodeId: '', active: true, location: 'پذیرش' },
    { id: 'old', serial: 'RB-OLD01', name: 'ربات قبلی', mode: 'welcome', startNodeId: '', active: true, location: 'محل قبلی' },
  ];
  const requests = [], transfers = [], auth = new Map();
  const users = ['admin', 'staff', 'operator', 'robot'].map(role => ({ id: role, username: role, name: role, role, active: true, robotId: role === 'robot' ? 'h-welcome' : '' }));
  const inbox = [{ id: 'visit-h', recipientId: 'staff', workspaceId: 'hospital', visitor: 'مراجع آزمون', destination: 'مدیر آزمون', note: 'پیام آزمون', status: 'registered', createdAt: Date.now() }];
  const hasRecords = directory => ['floors', 'nodes', 'edges', 'rooms', 'people'].some(key => directory[key].length);
  const hasLegacy = () => hasRecords(directories.get('legacy')) || robots.some(r => (r.workspaceId || 'legacy') === 'legacy') || inbox.some(v => (v.workspaceId || 'legacy') === 'legacy');
  let tokenCounter = 0;
  const issue = user => { const token = `workspace-fixture-${++tokenCounter}`; auth.set(token, user); return { token, user }; };
  await page.route('**/vendor/socket.io.min.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.io = () => {
      const handlers = new Map();
      const socket = { connected: true,
        on(name, fn) { handlers.set(name, fn); return socket; },
        disconnect() { socket.connected = false; handlers.get('disconnect')?.('io client disconnect'); },
        timeout() { return { emit(name, payload, done) { done(null, {}); } }; },
        sendEvent(name, payload) { handlers.get(name)?.(payload); }
      };
      window.workspaceSocket = socket; queueMicrotask(() => handlers.get('connect')?.()); return socket;
    };`,
  }));
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), pathname = url.pathname, method = req.method();
    const body = req.postDataJSON();
    const user = auth.get((req.headers().authorization || '').replace(/^Bearer /, ''));
    const scope = url.searchParams.get('workspace') || 'legacy';
    requests.push({ pathname, method, query: url.search, body });
    const send = (json, status = 200) => route.fulfill({ json, status });
    if (pathname === '/api/health') return send({ ok: true, version: 2, initialized: true });
    if (pathname === '/api/login') return send(issue(users.find(u => u.username === body.username) || users[0]));
    if (pathname === '/api/invites/redeem') return send(issue({ id: 'fixture-guest', username: 'guest', name: 'مهمان', role: 'operator', robotId: 'h-welcome', active: true }));
    if (pathname === '/api/logout') return send({ ok: true });
    if (pathname === '/api/me') return send({ user });
    if (!user) return send({ error: 'ورود لازم است.' }, 401);
    if (pathname.startsWith('/api/admin/') && user.role !== 'admin') return send({ error: 'دسترسی مجاز نیست.' }, 403);
    if (pathname === '/api/workspaces') return send([...categories, ...(hasLegacy() ? [['legacy', 'داده‌های قبلی']] : [])].map(([id, name]) => {
      const list = robots.filter(r => (r.workspaceId || 'legacy') === id);
      return { id, name, category: id, robotCount: list.length, welcomeCount: list.filter(r => r.mode === 'welcome').length, telepresenceCount: list.filter(r => r.mode === 'telepresence').length, roomCount: directories.get(id).rooms.length, peopleCount: directories.get(id).people.length };
    }));
    if (pathname === '/api/robots') {
      const list = user.role === 'robot' || user.username === 'guest' ? robots.filter(r => r.id === user.robotId) : robots.filter(r => (!url.searchParams.has('workspace') || (r.workspaceId || 'legacy') === scope) && (!url.searchParams.has('mode') || r.mode === url.searchParams.get('mode')));
      return send(list.map(r => ({ ...r, online: false, board: false, camera: false, busy: false })));
    }
    if (pathname === '/api/device') return send(issue({ ...user, role: 'robot', robotId: body.robotId }));
    if (pathname === '/api/robot/settings') {
      const robot = robots.find(r => r.id === user.robotId);
      Object.assign(robot, body); return send(robot);
    }
    if (pathname === '/api/directory') return send(directories.get(robots.find(r => r.id === user.robotId)?.workspaceId || scope));
    if (pathname === '/api/admin/state') return send({ directory: directories.get(scope), robots: robots.filter(r => (r.workspaceId || 'legacy') === scope), allRobots: robots, users, workspace: { id: scope, name: categories.find(([id]) => id === scope)?.[1] || 'داده‌های قبلی', category: scope } });
    if (pathname === '/api/admin/directory/validate') return send(body);
    if (pathname === '/api/admin/directory' && method === 'PUT') { directories.set(scope, structuredClone(body)); return send(body); }
    if (pathname === '/api/admin/robots' && method === 'POST') { const i = robots.findIndex(r => r.id === body.id); if (i < 0) robots.push(body); else robots[i] = body; return send(body); }
    const transferMatch = pathname.match(/^\/api\/admin\/workspaces\/(university|hospital|office|mall|museum)\/import-legacy$/);
    if (transferMatch && method === 'POST') {
      const target = transferMatch[1];
      if (!hasLegacy() || hasRecords(directories.get(target)) || robots.some(r => (r.workspaceId || 'legacy') === target)) return send({ error: 'فقط محیط خالی می‌تواند اطلاعات موجود را دریافت کند.' }, 409);
      const previous = {
        workspaceId: target,
        directory: structuredClone(directories.get('legacy')),
        robots: structuredClone(robots.filter(r => (r.workspaceId || 'legacy') === 'legacy')),
        visits: structuredClone(inbox.filter(v => (v.workspaceId || 'legacy') === 'legacy')),
      };
      transfers.push(previous);
      directories.set(target, structuredClone(previous.directory));
      directories.set('legacy', emptyDirectory('داده‌های قبلی'));
      for (const robot of robots) if ((robot.workspaceId || 'legacy') === 'legacy') robot.workspaceId = target;
      for (const visit of inbox) if ((visit.workspaceId || 'legacy') === 'legacy') visit.workspaceId = target;
      return send({ ok: true, workspaceId: target, robotCount: previous.robots.length, visitCount: previous.visits.length });
    }
    if (pathname === '/api/inbox') return send(inbox.filter(v => v.recipientId === user.id && (!url.searchParams.has('workspace') || v.workspaceId === scope)));
    if (pathname.startsWith('/api/visits/') && method === 'POST') return send({ ...inbox[0], ...body });
    return send({ ok: true });
  });
  return { directories, robots, requests, transfers, users, inbox };
}

async function login(page, role) {
  const form = page.locator('.auth-form').first();
  await form.locator('[name=username]').fill(role);
  await form.locator('[name=password]').fill('workspace-fixture-password');
  await form.getByRole('button', { name: 'ورود', exact: true }).click();
}

async function chooseWorkspace(page, workspace, mode = 'welcome') {
  await page.locator(`#categoryScreen button[data-workspace="${workspace}"]`).click();
  await expect(page.locator('#modeScreen')).toBeVisible();
  await page.locator(`#modeScreen button[data-mode="${mode}"]`).click();
  await expect(page.locator('#workspaceShell')).toBeVisible();
}

test('Five categories keep saved maps separate and cancel/discard protect unsaved workspace navigation', async ({ page }) => {
  const fixture = await workspaceFixture(page), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/portal.html'); await login(page, 'admin');
  await expect(page.locator('#categoryScreen')).toBeVisible();
  const cards = page.locator('#categoryScreen button[data-workspace]:not([data-workspace="legacy"])');
  await expect(cards).toHaveCount(5);
  expect((await cards.evaluateAll(nodes => nodes.map(node => node.dataset.workspace))).sort()).toEqual(categories.map(([id]) => id).sort());
  await expect(page.locator('#legacyWorkspace')).toBeVisible();
  await chooseWorkspace(page, 'hospital');
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await expect(page.locator('#viewMap')).toBeVisible();
  await expect(page.locator('#directoryName')).toHaveValue('بیمارستان');
  await page.locator('#directoryName').fill('بیمارستان آزمون ذخیره‌شده');
  await page.locator('#saveDirectory').click();
  await expect.poll(() => fixture.directories.get('hospital').name).toBe('بیمارستان آزمون ذخیره‌شده');
  await page.locator('#workspaceShell .workspace-menu button[data-view="tools"]').click();
  await page.locator('#reloadDirectory').click();
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await expect(page.locator('#directoryName')).toHaveValue('بیمارستان آزمون ذخیره‌شده');
  await page.locator('#directoryName').fill('پیش‌نویس ذخیره‌نشده');
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await expect(page.locator('#unsavedDialog')).toBeVisible();
  await page.locator('#unsavedDialog [data-unsaved="cancel"]').click();
  await expect(page.locator('#unsavedDialog')).toBeHidden();
  await expect(page.locator('#directoryName')).toHaveValue('پیش‌نویس ذخیره‌نشده');
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await page.locator('#unsavedDialog [data-unsaved="discard"]').click();
  await expect(page.locator('#categoryScreen')).toBeVisible();
  await chooseWorkspace(page, 'office');
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await expect(page.locator('#directoryName')).toHaveValue('اداره');
  expect(fixture.directories.get('hospital').name).toBe('بیمارستان آزمون ذخیره‌شده');
  expect(fixture.directories.get('office').name).toBe('اداره');
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await chooseWorkspace(page, 'hospital');
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await expect(page.locator('#directoryName')).toHaveValue('بیمارستان آزمون ذخیره‌شده');
  expect(errors).toEqual([]);
});

test('Robot registration uses the selected workspace and mode and renders malicious names as text', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/portal.html'); await login(page, 'admin');
  await chooseWorkspace(page, 'hospital', 'telepresence');
  await page.locator('#workspaceShell .workspace-menu button[data-view="robots"]').click();
  const form = page.locator('#robotForm');
  await form.locator('[name=id]').fill('scoped-call');
  await form.locator('[name=serial]').fill('RB-SCOPE01');
  const maliciousName = '<img src=x onerror="window.workspaceXss=true">';
  await form.locator('[name=name]').fill(maliciousName);
  await form.locator('[name=location]').fill('بخش آزمون');
  await form.locator('[name=active]').check();
  await form.locator('button:not([type="button"])').first().click();
  await expect.poll(() => fixture.requests.filter(r => r.pathname === '/api/admin/robots').length).toBe(1);
  const registration = fixture.requests.find(r => r.pathname === '/api/admin/robots');
  expect(registration.body.workspaceId).toBe('hospital');
  expect(registration.body.mode).toBe('telepresence');
  await expect(page.locator('#robotRecords')).toContainText(maliciousName);
  await expect(page.locator('#robotRecords img')).toHaveCount(0);
  expect(await page.evaluate(() => window.workspaceXss)).toBeUndefined();
});

test('Staff sees its selected workspace inbox without admin editing or admin requests', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  fixture.inbox[0].note = '<img src=x onerror="window.workspaceXss=true">';
  await page.goto('/portal.html'); await login(page, 'staff');
  await chooseWorkspace(page, 'hospital');
  await page.locator('#workspaceShell .workspace-menu button[data-view="inbox"]').click();
  await expect(page.locator('#viewInbox')).toBeVisible();
  await expect(page.locator('#inbox')).toContainText('مراجع آزمون');
  await expect(page.locator('#inbox')).toContainText(fixture.inbox[0].note);
  await expect(page.locator('#inbox img')).toHaveCount(0);
  await expect(page.locator('#workspaceShell .workspace-menu button[data-view="map"]')).toBeHidden();
  await expect(page.locator('#workspaceShell .workspace-menu button[data-view="accounts"]')).toBeHidden();
  expect(fixture.requests.filter(r => r.pathname === '/api/inbox').at(-1).query).toContain('workspace=hospital');
  expect(fixture.requests.some(r => r.pathname.startsWith('/api/admin/'))).toBe(false);
});

test('Workspace deep links restore the same view on reload and back/forward preserve its scope', async ({ page }) => {
  const fixture = await workspaceFixture(page), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/portal.html#/hospital/welcome/rooms'); await login(page, 'admin');
  await expect(page.locator('#viewRooms')).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe('#/hospital/welcome/rooms');
  await page.reload();
  await expect(page.locator('#viewRooms')).toBeVisible();
  expect(fixture.requests.filter(r => r.pathname === '/api/login')).toHaveLength(1);
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await expect(page.locator('#viewMap')).toBeVisible();
  await page.locator('#workspaceShell .workspace-menu button[data-view="people"]').click();
  await expect(page.locator('#viewPeople')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#viewMap')).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe('#/hospital/welcome/map');
  await page.goBack();
  await expect(page.locator('#viewRooms')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#viewMap')).toBeVisible();
  expect(fixture.requests.filter(r => r.pathname === '/api/admin/state').every(r => r.query.includes('workspace=hospital'))).toBe(true);
  expect(errors).toEqual([]);
});

test('Staff hash navigation and browser history cannot reveal unauthorized admin views', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/portal.html#/hospital/welcome/accounts'); await login(page, 'staff');
  await expect(page.locator('#viewInbox')).toBeVisible();
  await expect(page.locator('#viewAccounts')).toBeHidden();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/hospital/welcome/inbox');
  await page.evaluate(() => { location.hash = '#/hospital/welcome/tools'; });
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/hospital/welcome/inbox');
  await expect(page.locator('#viewTools')).toBeHidden();
  await page.evaluate(() => { location.hash = '#/unknown/welcome/map'; });
  await expect(page.locator('#categoryScreen')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#viewInbox')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#categoryScreen')).toBeVisible();
  expect(fixture.requests.some(r => r.pathname.startsWith('/api/admin/'))).toBe(false);
});

test('Dirty-dialog Save commits a valid native map draft while invalid partial fields stay pending', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/portal.html'); await login(page, 'admin'); await chooseWorkspace(page, 'hospital');
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  const floors = page.locator('#directoryBuilder details').first();
  await floors.locator('summary').click();
  await floors.locator('form [name=id]').fill('ground');
  await floors.locator('form [name=name]').fill('همکف');
  // Leave without pressing the form's "register draft" button. Save must
  // include complete native form inputs rather than silently losing them.
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await page.locator('#unsavedDialog [data-unsaved="save"]').click();
  await expect(page.locator('#categoryScreen')).toBeVisible();
  expect(fixture.directories.get('hospital').floors).toEqual([{ id: 'ground', name: 'همکف' }]);
  await chooseWorkspace(page, 'hospital');
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await floors.locator('summary').click();
  await floors.locator('form [name=id]').fill('partial');
  const writes = fixture.requests.filter(r => r.pathname === '/api/admin/directory' && r.method === 'PUT').length;
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await page.locator('#unsavedDialog [data-unsaved="save"]').click();
  await expect(page.locator('#unsavedDialog')).toBeVisible();
  await expect(page.locator('#unsavedError')).toContainText('فرم');
  expect(fixture.requests.filter(r => r.pathname === '/api/admin/directory' && r.method === 'PUT')).toHaveLength(writes);
  await page.locator('#unsavedDialog [data-unsaved="cancel"]').click();
  await expect(floors.locator('form [name=id]')).toHaveValue('partial');
  await expect(page.locator('#draftBadge')).toBeVisible();
  await floors.locator('form [name=name]').fill('طبقه دوم');
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await page.locator('#unsavedDialog [data-unsaved="save"]').click();
  await expect(page.locator('#categoryScreen')).toBeVisible();
  expect(fixture.directories.get('hospital').floors).toEqual([{ id: 'ground', name: 'همکف' }, { id: 'partial', name: 'طبقه دوم' }]);
});

test('An unsubmitted room draft survives view changes and cancel until Save commits it', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  fixture.directories.set('hospital', { ...emptyDirectory('بیمارستان'), floors: [{ id: 'ground', name: 'همکف' }], nodes: [{ id: 'reception', name: 'پذیرش', floorId: 'ground', x: 20, y: 50 }] });
  await page.goto('/portal.html'); await login(page, 'admin'); await chooseWorkspace(page, 'hospital');
  await page.locator('#workspaceShell .workspace-menu button[data-view="rooms"]').click();
  const form = page.locator('#roomBuilder form');
  await form.locator('[name=id]').fill('lab-room');
  await form.locator('[name=name]').fill('آزمایشگاه');
  await form.locator('[name=nodeId]').selectOption('reception');
  await page.locator('#workspaceShell .workspace-menu button[data-view="overview"]').click();
  await page.locator('#workspaceShell .workspace-menu button[data-view="rooms"]').click();
  await expect(form.locator('[name=name]')).toHaveValue('آزمایشگاه');
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await page.locator('#unsavedDialog [data-unsaved="cancel"]').click();
  await expect(form.locator('[name=id]')).toHaveValue('lab-room');
  expect(fixture.directories.get('hospital').rooms).toHaveLength(0);
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await page.locator('#unsavedDialog [data-unsaved="save"]').click();
  await expect(page.locator('#categoryScreen')).toBeVisible();
  expect(fixture.directories.get('hospital').rooms[0]).toMatchObject({ id: 'lab-room', name: 'آزمایشگاه', nodeId: 'reception' });
});

test('Operator portal requests only the selected workspace and mode and scopes its launch links', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/portal.html'); await login(page, 'operator'); await chooseWorkspace(page, 'hospital', 'telepresence');
  await page.locator('#workspaceShell .workspace-menu button[data-view="robots"]').click();
  await expect(page.locator('#robotRecords')).toContainText('تماس بیمارستان');
  await expect(page.locator('#robotRecords')).not.toContainText('تماس اداره');
  await expect(page.locator('#robotRecords')).not.toContainText('پذیرش بیمارستان');
  expect(fixture.requests.filter(r => r.pathname === '/api/robots').every(r => r.query.includes('workspace=hospital') && r.query.includes('mode=telepresence'))).toBe(true);
  expect(fixture.requests.some(r => r.pathname.startsWith('/api/admin/'))).toBe(false);
  await page.locator('#workspaceShell .workspace-menu button[data-view="operator"]').click();
  await expect(page.locator('#launchOperator')).toHaveAttribute('href', /user\.html\?workspace=hospital&mode=telepresence$/);
  await expect(page.locator('#launchStation')).toHaveAttribute('href', /robot\.html\?workspace=hospital&mode=telepresence$/);
});

test('Admin robot snapshots reconcile mode and disabled rows without replacing pending directory or form inputs', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  fixture.directories.set('hospital', {
    ...emptyDirectory('بیمارستان'),
    floors: [{ id: 'ground', name: 'همکف' }],
    nodes: [{ id: 'reception', name: 'پذیرش', floorId: 'ground', x: 20, y: 50 }],
  });
  await page.goto('/portal.html'); await login(page, 'admin'); await chooseWorkspace(page, 'hospital');
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await page.locator('#directoryName').fill('نقشه در حال ویرایش');
  await page.locator('#workspaceShell .workspace-menu button[data-view="rooms"]').click();
  const roomForm = page.locator('#roomBuilder form');
  await roomForm.locator('[name=id]').fill('pending-room');
  await roomForm.locator('[name=name]').fill('اتاق پیش‌نویس');
  await roomForm.locator('[name=nodeId]').selectOption('reception');
  await page.locator('#workspaceShell .workspace-menu button[data-view="accounts"]').click();
  await page.locator('#accountForm [name=robotId]').selectOption('h-call');
  await page.locator('#workspaceShell .workspace-menu button[data-view="robots"]').click();
  const robotForm = page.locator('#robotForm');
  const fillRobot = async id => {
    await robotForm.locator('[name=id]').fill(id);
    await robotForm.locator('[name=name]').fill('ربات در حال ثبت');
    await robotForm.locator('[name=serial]').fill('RB-DRAFT01');
    await robotForm.locator('[name=location]').fill('محل پیش‌نویس');
    await robotForm.locator('[name=startNodeId]').selectOption('reception');
  };
  const verifyPending = async id => {
    await expect(page.locator('#directoryName')).toHaveValue('نقشه در حال ویرایش');
    await expect(roomForm.locator('[name=id]')).toHaveValue('pending-room');
    await expect(roomForm.locator('[name=name]')).toHaveValue('اتاق پیش‌نویس');
    await expect(roomForm.locator('[name=nodeId]')).toHaveValue('reception');
    await expect(robotForm.locator('[name=id]')).toHaveValue(id);
    await expect(robotForm.locator('[name=name]')).toHaveValue('ربات در حال ثبت');
    await expect(robotForm.locator('[name=serial]')).toHaveValue('RB-DRAFT01');
    await expect(robotForm.locator('[name=location]')).toHaveValue('محل پیش‌نویس');
    await expect(robotForm.locator('[name=startNodeId]')).toHaveValue('reception');
    await expect(page.locator('#accountForm [name=robotId]')).toHaveValue('h-call');
    await expect(page.locator('#draftBadge')).toBeVisible();
  };
  const reloadCount = () => fixture.requests.filter(request => ['/api/admin/state', '/api/workspaces'].includes(request.pathname)).length;
  await fillRobot('pending-welcome');
  const firstReloadCount = reloadCount();
  fixture.robots.find(robot => robot.id === 'h-welcome').mode = 'telepresence';
  await page.evaluate(robots => window.workspaceSocket.sendEvent('robots', robots), fixture.robots);
  await expect(page.locator('#robotRecords')).not.toContainText('پذیرش بیمارستان');
  await expect(page.locator('#overviewStats .stat-card').first().locator('strong')).toHaveText('۰');
  await verifyPending('pending-welcome');
  expect(reloadCount()).toBe(firstReloadCount);
  // Changing mode within the same workspace preserves its map draft.
  await page.evaluate(() => { location.hash = '#/hospital/telepresence/overview'; });
  await expect(page.locator('#viewOverview')).toBeVisible();
  await expect(page.locator('#overviewStats .stat-card').first().locator('strong')).toHaveText('۲');
  await page.locator('#workspaceShell .workspace-menu button[data-view="robots"]').click();
  await expect(page.locator('#robotRecords')).toContainText('پذیرش بیمارستان');
  await expect(page.locator('#robotRecords')).toContainText('تماس بیمارستان');
  await fillRobot('pending-telepresence');
  const secondReloadCount = reloadCount();
  await page.evaluate(robots => window.workspaceSocket.sendEvent('robots', robots), fixture.robots.filter(robot => robot.id !== 'h-welcome'));
  const disabledRow = page.locator('#robotRecords .robot-record').filter({ hasText: 'پذیرش بیمارستان' });
  await expect(disabledRow).toContainText('غیرفعال');
  await expect(disabledRow.getByRole('button', { name: 'ویرایش', exact: true })).toBeEnabled();
  await expect(page.locator('#overviewStats .stat-card').first().locator('strong')).toHaveText('۲');
  await verifyPending('pending-telepresence');
  await expect(page.locator('#accountForm [name=robotId] option[value="h-welcome"]')).toHaveCount(0);
  expect(reloadCount()).toBe(secondReloadCount);
  expect(fixture.requests.some(request => request.pathname === '/api/admin/directory' && request.method === 'PUT')).toBe(false);
  expect(fixture.directories.get('hospital').rooms).toHaveLength(0);
  expect(fixture.directories.get('hospital').name).toBe('بیمارستان');
});

test('Legacy transfer requires confirmation and closes on workspace history navigation before moving records', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  const source = {
    ...emptyDirectory('نقشه موجود آزمون'),
    floors: [{ id: 'old-ground', name: 'همکف قبلی' }],
    nodes: [{ id: 'old-desk', name: 'پذیرش قبلی', floorId: 'old-ground', x: 20, y: 50 }],
    rooms: [{ id: 'old-room', name: 'اتاق موجود', nodeId: 'old-desk', active: true }],
  };
  fixture.directories.set('legacy', source);
  fixture.robots.find(robot => robot.id === 'old').startNodeId = 'old-desk';
  fixture.inbox.push({ id: 'visit-old', robotId: 'old', recipientId: 'staff', visitor: 'مراجع قبلی', destination: 'اتاق موجود', status: 'registered', createdAt: 1 });
  const imports = () => fixture.requests.filter(request => request.pathname.endsWith('/import-legacy'));
  await page.goto('/portal.html'); await login(page, 'admin');
  await chooseWorkspace(page, 'museum');
  await page.locator('#workspaceShell .workspace-menu button[data-view="tools"]').click();
  await expect(page.locator('#importLegacyBtn')).toBeEnabled();
  await page.locator('#importLegacyBtn').click();
  await expect(page.locator('#legacyImportDialog')).toBeVisible();
  await expect(page.locator('#legacyImportName')).toContainText('موزه');
  expect(imports()).toHaveLength(0);
  await page.locator('#cancelLegacyImport').click();
  await expect(page.locator('#legacyImportDialog')).toBeHidden();
  expect(imports()).toHaveLength(0);
  await page.locator('#importLegacyBtn').click();
  await page.evaluate(() => { location.hash = '#/office/welcome/overview'; });
  await expect(page.locator('#legacyImportDialog')).toBeHidden();
  await expect(page.locator('#workspaceName')).toHaveText('اداره');
  await expect(page.locator('#workspaceShell')).toHaveAttribute('aria-busy', 'false');
  // A stale confirmation event must not move the prior source to the new
  // destination after the visible dialog was closed by hash navigation.
  await page.evaluate(() => document.querySelector('#confirmLegacyImport').click());
  await expect(page.locator('#portalError')).toContainText('محیط انتخاب‌شده تغییر کرده');
  expect(imports()).toHaveLength(0);
  await page.goBack();
  await expect(page.locator('#viewTools')).toBeVisible();
  await expect(page.locator('#workspaceName')).toHaveText('موزه');
  await expect(page.locator('#legacyImportDialog')).toBeHidden();
  await page.locator('#importLegacyBtn').click();
  expect(imports()).toHaveLength(0);
  await page.locator('#confirmLegacyImport').click();
  await expect.poll(() => imports().length).toBe(1);
  expect(imports()[0]).toMatchObject({ pathname: '/api/admin/workspaces/museum/import-legacy', method: 'POST', body: {} });
  await expect(page.locator('#legacyImportDialog')).toBeHidden();
  await expect(page.locator('#portalStatus')).toContainText('اطلاعات قبلی به این محیط منتقل شد');
  expect(fixture.transfers).toHaveLength(1);
  expect(fixture.transfers[0].directory).toEqual(source);
  expect(fixture.transfers[0].robots.map(robot => robot.id)).toEqual(['old']);
  expect(fixture.transfers[0].visits.map(visit => visit.id)).toEqual(['visit-old']);
  expect(fixture.directories.get('museum')).toEqual(source);
  expect(fixture.robots.find(robot => robot.id === 'old').workspaceId).toBe('museum');
  expect(fixture.inbox.find(visit => visit.id === 'visit-old').workspaceId).toBe('museum');
  await expect(page.locator('#importLegacyBtn')).toBeDisabled();
  await page.locator('#workspaceShell .workspace-menu button[data-view="robots"]').click();
  await expect(page.locator('#robotRecords')).toContainText('ربات قبلی');
  await page.locator('#workspaceShell .sidebar-bottom [data-action="categories"]').click();
  await expect(page.locator('#legacyWorkspace')).toBeHidden();
  await expect(page.locator('[data-workspace-count="museum"]')).toHaveText('۱ ربات · ۱ مقصد');
  await expect(page.locator('[data-workspace-count="hospital"]')).toHaveText('۲ ربات · ۰ مقصد');
});

test('Admin Telepresence hides Welcome editors and redirects editor deep links to overview', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/portal.html#/hospital/telepresence/map'); await login(page, 'admin');
  await expect(page.locator('#viewOverview')).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/hospital/telepresence/overview');
  for (const view of ['map', 'rooms', 'people']) {
    await expect(page.locator(`#workspaceShell .workspace-menu button[data-view="${view}"]`)).toBeHidden();
    await page.evaluate(name => { location.hash = '#/hospital/telepresence/' + name; }, view);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/hospital/telepresence/overview');
    await expect(page.locator('#view' + view.charAt(0).toUpperCase() + view.slice(1))).toBeHidden();
  }
  expect(fixture.requests.some(request => request.pathname === '/api/admin/directory' && request.method === 'PUT')).toBe(false);
  await page.locator('#workspaceShell .sidebar-bottom [data-action="modes"]').click();
  await page.locator('#modeScreen button[data-mode="welcome"]').click();
  for (const view of ['map', 'rooms', 'people']) await expect(page.locator(`#workspaceShell .workspace-menu button[data-view="${view}"]`)).toBeVisible();
});

test('Portal layouts fit desktop and mobile widths and provide fixture-only visual snapshots', async ({ page }) => {
  await workspaceFixture(page);
  const screenshotDirectory = path.join(__dirname, '..', '.qa');
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const screenshot = name => page.screenshot({ path: path.join(screenshotDirectory, name), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/portal.html'); await fits(); await screenshot('portal-auth.png');
  await page.setViewportSize({ width: 390, height: 844 }); await fits();
  await page.setViewportSize({ width: 1440, height: 960 }); await login(page, 'admin');
  await expect(page.locator('#categoryScreen')).toBeVisible(); await fits(); await screenshot('portal-hub.png');
  await page.setViewportSize({ width: 390, height: 844 }); await fits();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator('#categoryScreen button[data-workspace="hospital"]').click();
  await expect(page.locator('#modeScreen')).toBeVisible(); await fits(); await screenshot('portal-mode.png');
  await page.setViewportSize({ width: 390, height: 844 }); await fits();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator('#modeScreen button[data-mode="welcome"]').click();
  await expect(page.locator('#viewOverview')).toBeVisible(); await fits(); await screenshot('portal-overview.png');
  await page.setViewportSize({ width: 390, height: 844 }); await fits(); await screenshot('portal-mobile.png');
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await expect(page.locator('#viewMap')).toBeVisible(); await fits();
  await page.setViewportSize({ width: 1440, height: 960 }); await fits();
});

test('Operator launch filters API and socket robots and clears a robot stored for another workspace', async ({ page }) => {
  const fixture = await workspaceFixture(page), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('lastRobot', 'RB-OT01'));
  await page.goto('/user.html?workspace=hospital&mode=telepresence');
  await login(page, 'operator');
  await expect(page.locator('#joinForm')).toBeVisible();
  await expect(page.locator('#robotSelect option')).toHaveCount(2);
  await expect(page.locator('#robotSelect')).toContainText('تماس بیمارستان');
  await expect(page.locator('#serialInput')).toHaveValue('');
  const calls = fixture.requests.filter(r => r.pathname === '/api/robots');
  expect(calls.every(r => r.query.includes('workspace=hospital') && r.query.includes('mode=telepresence'))).toBe(true);
  await page.evaluate(robots => window.workspaceSocket.sendEvent('robots', robots), fixture.robots);
  await expect(page.locator('#robotSelect option')).toHaveCount(2);
  await page.locator('#robotSelect').selectOption('RB-HT01');
  await expect(page.locator('#serialInput')).toHaveValue('RB-HT01');
  await page.evaluate(() => window.workspaceSocket.sendEvent('robots', []));
  await expect(page.locator('#serialInput')).toHaveValue('');
  expect(fixture.requests.some(r => r.pathname === '/api/sessions')).toBe(false);
  expect(errors).toEqual([]);
});

test('Legacy robot rows remain selectable and invalid view filters are not forwarded to the API', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/user.html?workspace=legacy&mode=welcome');
  await login(page, 'operator');
  await expect(page.locator('#robotSelect option')).toHaveCount(2);
  await expect(page.locator('#robotSelect')).toContainText('ربات قبلی');
  await page.evaluate(robots => window.workspaceSocket.sendEvent('robots', robots), fixture.robots);
  await expect(page.locator('#robotSelect option')).toHaveCount(2);
  fixture.requests.length = 0;
  await page.goto('/user.html?workspace=not-a-workspace&mode=not-a-mode');
  await expect(page.locator('#joinForm')).toBeVisible();
  await expect(page.locator('#robotSelect option')).toHaveCount(5);
  expect(fixture.requests.filter(r => r.pathname === '/api/robots').every(r => r.query === '')).toBe(true);
});

test('An invited guest sees the bound robot despite incompatible workspace and mode view filters', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/user.html?workspace=museum&mode=telepresence#invite=fixture-single-use-invite');
  await expect(page.locator('#joinForm')).toBeVisible();
  await expect(page.locator('#robotSelect')).toContainText('پذیرش بیمارستان');
  await expect(page.locator('#robotSelect option')).toHaveCount(2);
  expect(fixture.requests.filter(r => r.pathname === '/api/robots').every(r => r.query === '')).toBe(true);
  expect(fixture.requests.some(r => r.pathname === '/api/sessions')).toBe(false);
});

test('Admin station picker uses workspace and mode while a device account always stays bound to its own robot', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/robot.html?workspace=hospital&mode=telepresence');
  await login(page, 'admin');
  const picker = page.locator('#devicePicker');
  await expect(picker).toBeVisible();
  await expect(picker.locator('select option')).toHaveCount(2);
  await expect(picker.locator('button')).toBeDisabled();
  await picker.locator('select').selectOption('h-call');
  await picker.locator('button').click();
  await expect(page.locator('#stationName')).toContainText('تماس بیمارستان');
  expect(fixture.requests.find(r => r.pathname === '/api/device').body.robotId).toBe('h-call');
  const ownRequests = fixture.requests.filter(r => r.pathname === '/api/robots');
  expect(ownRequests[0].query).toContain('workspace=hospital');
  expect(ownRequests[0].query).toContain('mode=telepresence');
  expect(ownRequests[ownRequests.length - 1].query).toBe('');
});

test('Empty station picker gives registration guidance and never sends an empty device activation', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/robot.html?workspace=museum&mode=welcome');
  await login(page, 'admin');
  const picker = page.locator('#devicePicker');
  await expect(picker).toBeVisible();
  await expect(picker.locator('button')).toBeDisabled();
  await expect(picker).toContainText('هنوز رباتی ثبت نشده');
  expect(fixture.requests.some(r => r.pathname === '/api/device')).toBe(false);
});

test('Device directory events ignore other workspaces and reload only the bound workspace', async ({ page }) => {
  const fixture = await workspaceFixture(page);
  await page.goto('/robot.html?workspace=museum&mode=telepresence');
  await login(page, 'robot');
  await expect(page.locator('#stationName')).toContainText('پذیرش بیمارستان');
  const initial = fixture.requests.filter(r => r.pathname === '/api/directory').length;
  await page.locator('#publicBtn').click();
  await expect(page.locator('#welcomeScreen')).toBeVisible();
  await page.locator('#destinationQuery').fill('پرسش مراجع');
  await page.evaluate(() => window.workspaceSocket.sendEvent('directory:changed', { workspaceId: 'office' }));
  await expect(page.locator('#destinationQuery')).toHaveValue('پرسش مراجع');
  expect(fixture.requests.filter(r => r.pathname === '/api/directory')).toHaveLength(initial);
  await page.evaluate(() => window.workspaceSocket.sendEvent('directory:changed', { workspaceId: 'hospital' }));
  await expect(page.locator('#destinationQuery')).toHaveValue('');
  await expect.poll(() => fixture.requests.filter(r => r.pathname === '/api/directory').length).toBe(initial + 1);
});
