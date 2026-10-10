const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const config = fs.readFileSync(path.join(__dirname, '..', 'public/config.js'), 'utf8').replace('peerServer: {},', "peerServer: { host: '127.0.0.1', port: 9101, path: '/peerjs', secure: false },");
async function login(page, role) {
  await page.goto('/portal.html');
  await page.locator('.auth-form [name=username]').fill(role); await page.locator('.auth-form [name=password]').fill('browser-test-password');
  await page.locator('.auth-form button').click(); await expect(page.locator('#wizardScreen')).toBeVisible();
}
async function setup(page) {
  await page.locator('[data-next="2"]').click(); await page.locator('[data-next="3"]').click();
  await page.locator('#setupRobot').selectOption('r1'); await page.locator('#setupName').fill('آوا');
  await page.locator('#robotNameForm button').click(); await expect(page.locator('#setupQR svg')).toBeVisible();
  await page.locator('[data-next="5"]').click(); await page.locator('#robotAddress').fill('192.168.1.10');
  await page.locator('#connectionForm button.primary').click(); await expect(page.locator('#homeScreen')).toBeVisible();
}
test('five pages, private organization upload, minimal home, settings, reload and mobile layout', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await login(page, 'admin'); await page.locator('[data-next="2"]').click(); await page.locator('[data-next="3"]').click();
  await page.locator('#setupRobot').selectOption('r1'); await page.locator('#setupName').fill('آوا'); await page.locator('#robotNameForm button').click();
  await page.locator('#wizardOrganization').click(); await expect(page.locator('#organizationScreen')).toBeVisible();
  await page.locator('#organizationFile').setInputFiles({ name: 'organization.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ name: 'سازمان آزمون', description: 'نقشه و اطلاعات سازمان' })) });
  await expect(page.locator('#organizationName')).toHaveValue('سازمان آزمون');
  await page.locator('#organizationForm button.primary').click(); await expect(page.locator('#appStatus')).toContainText('ذخیره');
  await page.locator('#organizationBack').click(); await expect(page.locator('#step4')).toBeVisible();
  await page.locator('[data-next="5"]').click(); await page.locator('#robotAddress').fill('192.168.1.10'); await page.locator('#connectionForm button.primary').click();
  await expect(page.locator('#homeScreen')).toBeVisible(); await expect(page.locator('#homeRobotName')).toHaveText('آوا');
  await page.reload(); await expect(page.locator('#homeScreen')).toBeVisible();
  await page.screenshot({ path: 'test-results/organization-home.png', fullPage: true, animations: 'disabled' });
  await page.locator('#settingsButton').click(); await expect(page.locator('#settingsScreen .setting-row')).toHaveCount(3);
  await page.locator('#openQR').click(); await expect(page.locator('#robotQR svg')).toBeVisible();
  expect(await page.locator('#qrLink').textContent()).not.toMatch(/token|invite|password/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ['qrScreen', 'organizationScreen']) {
    if (id === 'organizationScreen') await page.locator('#qrOrganization').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/organization-mobile.png', fullPage: true, animations: 'disabled' });
  await page.evaluate(() => Platform.api('/admin/robots', { method: 'POST', body: { id: 'r2', serial: 'RB-SECOND02', name: 'ربات دوم', mode: 'telepresence', location: '', startNodeId: '', workspaceId: 'hospital' } }));
  await page.goto('/portal.html?robot=r2'); await expect(page.locator('#homeRobotName')).toHaveText('ربات دوم');
  expect(errors).toEqual([]);
});
test('real authenticated chat and expert video between two browsers', async ({ browser }) => {
  const ac = await browser.newContext(), sc = await browser.newContext(); const a = await ac.newPage(), s = await sc.newPage();
  const errors = []; for (const p of [a, s]) p.on('pageerror', e => errors.push(e.message));
  // The administrator completed setup in the preceding test; staff completes their own setup.
  await a.goto('/portal.html'); await a.locator('.auth-form [name=username]').fill('admin'); await a.locator('.auth-form [name=password]').fill('browser-test-password'); await a.locator('.auth-form button').click();
  await expect(a.locator('#homeScreen')).toBeVisible(); await login(s, 'staff'); await setup(s);
  await a.locator('#expertCard').click(); await a.locator('#expertList button').filter({ hasText: 'staff' }).click();
  await a.locator('#messageInput').fill('<img src=x onerror=alert(1)>'); await a.locator('#messageForm button').click();
  await s.locator('#expertCard').click(); await s.locator('#threadList button').first().click();
  await expect(s.locator('#messages')).toContainText('<img src=x onerror=alert(1)>'); await expect(s.locator('#messages img')).toHaveCount(0);
  await a.locator('#expertCallButton').click(); await expect(s.locator('#incomingDialog')).toBeVisible(); await s.locator('#acceptExpert').click();
  await expect(a.locator('#expertCallStatus')).toHaveText('تماس برقرار شد', { timeout: 20000 });
  await expect(s.locator('#expertCallStatus')).toHaveText('تماس برقرار شد', { timeout: 20000 });
  for (const p of [a, s]) await expect.poll(() => p.locator('#expertRemote').evaluate(v => v.readyState)).toBeGreaterThanOrEqual(2);
  await a.locator('#expertHangup').click(); await expect(s.locator('#expertCallScreen')).toBeHidden();
  expect(errors).toEqual([]); await ac.close(); await sc.close();
});
test('robot call is fullscreen, receives real video and has only one hangup control', async ({ browser }) => {
  const rc = await browser.newContext(), uc = await browser.newContext(); const r = await rc.newPage(), u = await uc.newPage();
  const errors = []; for (const p of [r, u]) { p.on('pageerror', e => errors.push(e.message)); await p.route('**/config.js', route => route.fulfill({ body: config, contentType: 'application/javascript' })); }
  await r.goto('/robot.html'); await r.locator('#stationAuth [name=username]').fill('robot'); await r.locator('#stationAuth [name=password]').fill('browser-test-password'); await r.locator('#stationAuth button').click();
  await r.locator('#cameraBtn').click(); await r.locator('#onlineBtn').click(); await expect(r.locator('#netStatus')).toContainText('Online', { timeout: 15000 });
  await u.goto('/portal.html'); await u.locator('.auth-form [name=username]').fill('admin'); await u.locator('.auth-form [name=password]').fill('browser-test-password'); await u.locator('.auth-form button').click(); await expect(u.locator('#homeScreen')).toBeVisible();
  await u.locator('#robotCard').click(); const child = u.frameLocator('#robotCallFrame');
  await expect(child.locator('#call')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => child.locator('#remote').evaluate(v => v.readyState), { timeout: 20000 }).toBeGreaterThanOrEqual(2);
  await expect(child.locator('button:visible')).toHaveCount(1);
  expect(await child.locator('body').evaluate(() => activeSession.canDrive)).toBe(false);
  await child.locator('.minimal-end').click(); await expect(u.locator('#robotCallScreen')).toBeHidden();
  expect(errors).toEqual([]); await rc.close(); await uc.close();
});
test('new expert has a visible job title and reset repeats setup while preserving accounts and robots', async ({ page, browser }) => {
  await page.goto('/portal.html'); await page.locator('.auth-form [name=username]').fill('admin'); await page.locator('.auth-form [name=password]').fill('browser-test-password'); await page.locator('.auth-form button').click(); await expect(page.locator('#homeScreen')).toBeVisible();
  await page.locator('#settingsButton').click(); await page.locator('#openPerson').click();
  const form = page.locator('#personForm'); await form.locator('[name=name]').fill('کارشناس جدید'); await form.locator('[name=jobTitle]').fill('مدیر پذیرش'); await form.locator('[name=username]').fill('new-expert'); await form.locator('[name=password]').fill('new-expert-test-password'); await form.locator('button.primary').click(); await expect(page.locator('#appStatus')).toContainText('ثبت');
  await page.locator('#personBack').click(); await page.locator('#settingsScreen [data-home]').click(); await page.locator('#expertCard').click(); await expect(page.locator('#expertList')).toContainText('مدیر پذیرش');
  const context = await browser.newContext(), expert = await context.newPage(); await expert.goto('/portal.html'); await expert.locator('.auth-form [name=username]').fill('new-expert'); await expert.locator('.auth-form [name=password]').fill('new-expert-test-password'); await expert.locator('.auth-form button').click(); await expect(expert.locator('#wizardScreen')).toBeVisible();
  await page.locator('#expertsScreen [data-home]').click(); await page.locator('#settingsButton').click(); await page.locator('#openReset').click();
  await page.locator('#resetForm [name=password]').fill('wrong-password'); await page.locator('#resetForm button.danger').click(); await expect(page.locator('#resetError')).not.toBeEmpty();
  await page.locator('#resetForm [name=password]').fill('browser-test-password'); await page.locator('#resetForm button.danger').click(); await expect(page.locator('#step1')).toBeVisible();
  await page.reload(); await expect(page.locator('#step1')).toBeVisible(); await page.locator('[data-next="2"]').click(); await page.locator('[data-next="3"]').click(); await expect(page.locator('#setupRobot')).toContainText('RB-TEST01');
  await page.locator('#setupRobot').selectOption(''); await expect(page.locator('#setupName')).toHaveValue('');
  await page.locator('#setupName').fill('ربات جدید'); await page.locator('#robotNameForm button').click(); await page.locator('[data-next="5"]').click(); await page.locator('#robotAddress').fill('192.168.1.22'); await page.locator('#connectionForm button.primary').click(); await expect(page.locator('#homeRobotName')).toHaveText('ربات جدید');
  await context.close();
});
