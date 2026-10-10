const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const config = fs.readFileSync(path.join(__dirname, '..', 'public', 'config.js'), 'utf8').replace('peerServer: {},', "peerServer: { host: '127.0.0.1', port: 9101, path: '/peerjs', secure: false },");
async function configure(page) {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/config.js', route => route.fulfill({ body: config, contentType: 'application/javascript' }));
  return errors;
}
async function login(page, role) {
  const form = page.locator('.auth-form').first();
  await form.locator('[name=username]').fill(role); await form.locator('[name=password]').fill('browser-test-password');
  await form.getByRole('button', { name: 'ورود', exact: true }).click();
}
async function enterLegacyWorkspace(page, view) {
  await expect(page.locator('#categoryScreen')).toBeVisible();
  await page.locator('#legacyWorkspace').click();
  await expect(page.locator('#modeScreen')).toBeVisible();
  await page.locator('#modeScreen button[data-mode="welcome"]').click();
  await expect(page.locator('#workspaceShell')).toBeVisible();
  await page.locator(`#workspaceShell .workspace-menu button[data-view="${view}"]`).click();
}
test('Welcome finds a Persian destination, maps floors, notifies staff, receives reply, and clears visitor data', async ({ browser }) => {
  const context = await browser.newContext(); const robot = await context.newPage(), staff = await context.newPage();
  const errorsR = await configure(robot), errorsS = await configure(staff);
  await robot.goto('/robot.html'); await login(robot, 'robot');
  await expect(robot.locator('#stationMain')).toBeVisible();
  await robot.locator('#publicBtn').click();
  await robot.locator('#destinationQuery').fill('اتاق مدیر کجاست؟'); await robot.locator('#destinationForm').getByRole('button', { name: 'جست‌وجو' }).click();
  await robot.locator('#destinationResults').getByRole('button').filter({ hasText: 'اتاق: اتاق مدیر' }).click();
  await expect(robot.locator('#routeSteps li')).toHaveCount(3); await expect(robot.locator('#floorMap svg')).toBeVisible();
  await robot.locator('#mapFloor').selectOption('first'); await expect(robot.locator('#floorMap')).toContainText('اتاق مدیر');
  await robot.locator('#visitorName').fill('مراجع آزمون'); await robot.locator('#visitorNote').fill('<img src=x onerror=alert(1)>');
  await robot.locator('#notifyBtn').click(); await expect(robot.locator('#visitStatus')).toContainText('ثبت شد');
  await staff.goto('/admin.html'); await login(staff, 'staff');
  await enterLegacyWorkspace(staff, 'inbox');
  await expect(staff.locator('#inbox')).toContainText('مراجع آزمون'); await expect(staff.locator('#inbox img')).toHaveCount(0);
  await staff.locator('#inbox').getByRole('button', { name: 'تشریف بیاورید', exact: true }).first().click();
  await expect(robot.locator('#visitStatus')).toContainText('تشریف بیاورید', { timeout: 12000 });
  await robot.screenshot({ path: 'test-results/welcome.png', fullPage: true });
  await robot.locator('#newVisit').click(); await expect(robot.locator('#visitorName')).toHaveValue(''); await expect(robot.locator('#destinationDetail')).toBeHidden();
  await robot.locator('#settingsBtn').click(); await expect(robot.locator('#settingsDialog')).toBeVisible();
  await robot.locator('#cancelSettings').click(); await context.close(); expect(errorsR).toEqual([]); expect(errorsS).toEqual([]);
});
test('Admin edits directory with native forms and prevents saving dangling paths', async ({ page }) => {
  const errors = await configure(page); await page.goto('/admin.html'); await login(page, 'admin');
  await expect(page.locator('#adminPanel')).toBeVisible();
  await enterLegacyWorkspace(page, 'map');
  await expect(page.locator('#viewMap')).toBeVisible();
  const floors = page.locator('#directoryBuilder details').first(); await floors.locator('summary').click();
  await floors.locator('[name=id]').fill('second'); await floors.locator('[name=name]').fill('طبقه دوم'); await floors.locator('form button').first().click();
  await page.locator('#saveDirectory').click(); await expect(page.locator('#portalStatus')).toContainText('ذخیره شد');
  await page.locator('#workspaceShell .workspace-menu button[data-view="tools"]').click();
  await page.locator('#reloadDirectory').click();
  await page.locator('#workspaceShell .workspace-menu button[data-view="map"]').click();
  await expect(page.locator('#directoryBuilder details').first().locator('summary')).toContainText(/\((?:3|۳)\)/);
  await page.locator('#workspaceShell .workspace-menu button[data-view="tools"]').click();
  await page.locator('#viewTools details summary').click();
  const invalid = JSON.parse(await page.locator('#directoryJSON').inputValue()); invalid.edges[0].to = 'missing';
  await page.locator('#directoryJSON').fill(JSON.stringify(invalid)); await page.locator('#applyJSON').click(); await expect(page.locator('#portalError')).toContainText('مسیر معتبر نیست');
  await page.screenshot({ path: 'test-results/admin.png', fullPage: true }); expect(errors).toEqual([]);
});
test('Actual local WebRTC call, authenticated movement, local takeover, and independent video failure lock', async ({ browser }) => {
  const rc = await browser.newContext(), uc = await browser.newContext();
  const robot = await rc.newPage(), user = await uc.newPage(); const errorsR = await configure(robot), errorsU = await configure(user);
  await robot.addInitScript(() => {
    const writes = []; window.serialWrites = writes; let output;
    const port = { getInfo: () => ({ usbVendorId: 0x2341 }), open: async () => {}, setSignals: async () => {}, close: async () => {}, readable: new ReadableStream({ start(c) { output = c; } }), writable: new WritableStream({ write(bytes) { const line = new TextDecoder().decode(bytes).trim(); writes.push(line); output.enqueue(new TextEncoder().encode(line === '?' ? 'READY robot_controller\n' : 'OK ' + line + '\n')); } }) };
    Object.defineProperty(navigator, 'serial', { configurable: true, value: { getPorts: async () => [port], requestPort: async () => port, addEventListener() {} } });
  });
  await robot.goto('/robot.html'); await login(robot, 'robot');
  await robot.locator('#cameraBtn').click(); await robot.locator('#onlineBtn').click();
  await expect(robot.locator('#netStatus')).toContainText('Online', { timeout: 15000 });
  await expect(robot.locator('#boardStatus')).toContainText('Arduino connected');
  await user.goto('/user.html'); await login(user, 'operator');
  await user.locator('#robotSelect').selectOption('RB-TEST01'); await user.locator('#checkMedia').click(); await user.locator('#joinBtn').click();
  await expect(user.locator('#call')).toBeVisible(); await expect(user.locator('#videoHealth')).toHaveText('تصویر زنده', { timeout: 20000 });
  await expect(user.locator('#dpad [data-cmd=F]')).toBeDisabled();
  await user.bringToFront(); await user.locator('#claimControl').click(); await expect(user.locator('#dpad [data-cmd=F]')).toBeEnabled();
  await user.waitForTimeout(300); await user.locator('#dpad [data-cmd=F]').dispatchEvent('pointerdown', { pointerId: 1 });
  await expect.poll(() => robot.evaluate(() => window.serialWrites.some(x => x.startsWith('F ')))).toBe(true);
  await user.locator('#dpad [data-cmd=F]').dispatchEvent('pointerup', { pointerId: 1 });
  await expect.poll(() => robot.evaluate(() => window.serialWrites.filter(x => x === 'S').length)).toBeGreaterThan(0);
  await user.screenshot({ path: 'test-results/telepresence.png' });
  await user.setViewportSize({ width: 360, height: 780 });
  await user.screenshot({ path: 'test-results/mobile-call.png' });
  expect(await user.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const padBox = await user.locator('#dpad').boundingBox(), barBox = await user.locator('.callbar').boundingBox();
  expect(barBox.x + barBox.width).toBeLessThan(padBox.x);
  // Fail media only; leave the command channel open. Movement must still lock.
  await user.evaluate(() => {
    const media = call, pc = media.peerConnection;
    pc.close();
    // PeerJS clears this field during cleanup, before queued browser events.
    media.peerConnection = null;
    pc.dispatchEvent(new Event('connectionstatechange'));
    window.closedMediaPc = pc;
  });
  await expect(user.locator('#dpad [data-cmd=F]')).toBeDisabled();
  await expect(user.locator('#videoHealth')).toContainText('حرکت قفل است');
  await robot.locator('#localStop').click(); await expect(user.locator('#join')).toBeVisible();
  // A late callback from the old call must not revive or mutate the session.
  await user.evaluate(() => { window.closedMediaPc.dispatchEvent(new Event('connectionstatechange')); });
  await expect(user.locator('#join')).toBeVisible();
  expect(errorsR).toEqual([]); expect(errorsU).toEqual([]); await rc.close(); await uc.close();
});
test('Mobile control and station screens fit a 360px viewport', async ({ page }) => {
  const errors = await configure(page); await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/user.html'); await login(page, 'operator');
  await expect(page.locator('#joinForm')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile.png' }); expect(errors).toEqual([]);
});

test('Invitations follow the current ready tunnel and remain hidden while it reconnects', async ({ page }) => {
  const errors = await configure(page);
  // Exercise temporary links independently of the permanent Pages deployment.
  await page.route('**/config.js', async route => {
    const response = await route.fetch();
    const config = (await response.text()).replace(/publicUserPage:\s*'[^']*'/, "publicUserPage: ''");
    await route.fulfill({ response, body: config });
  });
  let info = { state: 'off', url: null }, inviteRequests = 0;
  await page.route('**/share-info', route => route.fulfill({ json: info }));
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/invites') inviteRequests++;
  });
  await page.goto('/robot.html'); await login(page, 'robot');
  await page.locator('#inviteBtn').click();
  await expect(page.locator('#shareNote')).toContainText('آدرس عمومی');
  expect(inviteRequests).toBe(0);
  await expect(page.locator('#copyBtn')).toBeDisabled();

  info = { state: 'ready', url: 'https://first.example.test' };
  await page.evaluate(() => pollShareInfo());
  await page.locator('#inviteBtn').click();
  await expect(page.locator('#shareLink')).toContainText('https://first.example.test/user#invite=');
  const fragment = new URL(await page.locator('#shareLink').textContent()).hash;
  await expect(page.locator('#copyBtn')).toBeEnabled();
  expect(inviteRequests).toBe(1);

  info = { state: 'starting', url: 'https://first.example.test' };
  await page.evaluate(() => pollShareInfo());
  await expect(page.locator('#shareLink')).toHaveText('—');
  await expect(page.locator('#copyBtn')).toBeDisabled();
  info = { state: 'ready', url: 'https://second.example.test' };
  await page.evaluate(() => pollShareInfo());
  await expect(page.locator('#shareLink')).toHaveText(`https://second.example.test/user${fragment}`);
  await expect(page.locator('#copyBtn')).toBeEnabled();
  expect(inviteRequests).toBe(1);
  await page.locator('#revokeInvites').click();
  await expect(page.locator('#shareLink')).toHaveText('—');
  expect(errors).toEqual([]);
});

test('Fixed Pages invitations still wait for the local public backend and reuse their token after recovery', async ({ page }) => {
  const errors = await configure(page);
  const permanent = 'https://shadigivian.github.io/robot-telepresence/user.html';
  await page.route('**/config.js', route => route.fulfill({
    body: config.replace(/publicUserPage:\s*'[^']*'/, `publicUserPage: '${permanent}'`),
    contentType: 'application/javascript',
  }));
  let info = { state: 'error', url: null }, inviteRequests = 0, polls = 0;
  await page.route('**/share-info', route => { polls++; return route.fulfill({ json: info }); });
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/invites') inviteRequests++;
  });
  await page.goto('/robot.html'); await login(page, 'robot');
  await expect(page.locator('#shareNote')).toContainText('آدرس عمومی');
  await page.locator('#inviteBtn').click();
  expect(inviteRequests).toBe(0); expect(polls).toBeGreaterThan(0);
  await expect(page.locator('#copyBtn')).toBeDisabled();

  info = { state: 'ready', url: 'https://first.example.test' };
  await page.evaluate(() => pollShareInfo());
  await page.locator('#inviteBtn').click();
  await expect(page.locator('#shareLink')).toContainText(`${permanent}#invite=`);
  const fixedLink = await page.locator('#shareLink').textContent();
  await expect(page.locator('#copyBtn')).toBeEnabled();
  expect(inviteRequests).toBe(1);

  info = { state: 'error', url: null };
  await page.evaluate(() => pollShareInfo());
  await expect(page.locator('#shareNote')).toContainText('آدرس عمومی');
  await expect(page.locator('#shareLink')).toHaveText('—');
  await expect(page.locator('#copyBtn')).toBeDisabled();
  await page.locator('#inviteBtn').click();
  expect(inviteRequests).toBe(1);

  info = { state: 'ready', url: 'https://second.example.test' };
  await page.evaluate(() => pollShareInfo());
  await expect(page.locator('#shareLink')).toHaveText(fixedLink);
  await expect(page.locator('#copyBtn')).toBeEnabled();
  expect(inviteRequests).toBe(1);
  await page.locator('#revokeInvites').click();
  await expect(page.locator('#shareLink')).toHaveText('—');
  expect(errors).toEqual([]);
});
