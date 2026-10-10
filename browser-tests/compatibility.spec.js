const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

async function denyStorage(page) {
  await page.addInitScript(() => {
    for (const name of ['sessionStorage', 'localStorage']) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() { throw new DOMException('Browser storage is disabled', 'SecurityError'); },
      });
    }
  });
}

async function login(page, role) {
  const form = page.locator('.auth-form').first();
  await form.locator('[name=username]').fill(role);
  await form.locator('[name=password]').fill('browser-test-password');
  await form.getByRole('button', { name: 'ورود', exact: true }).click();
}
async function enterLegacyWorkspace(page, view) {
  await page.locator('#legacyWorkspace').click();
  await expect(page.locator('#modeScreen')).toBeVisible();
  await page.locator('#modeScreen button[data-mode="welcome"]').click();
  await expect(page.locator('#workspaceShell')).toBeVisible();
  await page.locator(`#workspaceShell .workspace-menu button[data-view="${view}"]`).click();
}

test('Public tunnel serves every product page and required assets while keeping private paths blocked', async ({ request }) => {
  const headers = { 'cf-ray': 'isolated-tunnel-test' };
  for (const url of ['/', '/robot', '/user', '/portal', '/robot.js', '/welcome.js', '/connection.js', '/portal.js', '/portal.css', '/admin.html', '/admin.js', '/admin.css', '/robot-avatar.svg', '/minimal-call.css', '/vendor/qrcode.js', '/organization-example.json']) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(200);
    if (url === '/') expect(await response.text()).toContain('href="robot.html"');
  }
  for (const url of ['/share-info', '/.env', '/data/site.json']) {
    const response = await request.get(url, { headers });
    expect(response.status(), url).toBe(404);
  }
});
test('organization setup and minimal home work with browser storage disabled', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await denyStorage(page);
  await page.goto('/portal.html'); await login(page, 'admin'); await expect(page.locator('#step1')).toBeVisible();
  await page.locator('[data-next="2"]').click(); await page.locator('[data-next="3"]').click(); await page.locator('#setupRobot').selectOption('r1'); await page.locator('#setupName').fill('آوا'); await page.locator('#robotNameForm button').click(); await expect(page.locator('#setupQR svg')).toBeVisible();
  await page.locator('[data-next="5"]').click(); await page.locator('#robotAddress').fill('192.168.1.10'); await page.locator('#connectionForm button.primary').click(); await expect(page.locator('#homeScreen')).toBeVisible();
  await page.locator('#settingsButton').click(); await expect(page.locator('#settingsScreen .setting-row')).toHaveCount(3); await page.locator('#logoutButton').click(); await expect(page.locator('#loginScreen')).toBeVisible(); expect(errors).toEqual([]);
});

for (const scenario of [
  { role: 'admin', route: '/admin.html', ready: '#categoryScreen', logout: '#logoutBtn' },
  { role: 'staff', route: '/admin.html', ready: '#categoryScreen', logout: '#logoutBtn' },
  { role: 'operator', route: '/user.html', ready: '#joinForm', logout: '#userLogout' },
  { role: 'robot', route: '/robot.html', ready: '#stationMain', logout: '#stationLogout' },
]) {
  test(`${scenario.role} can log in and log out when browser storage access throws`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await denyStorage(page);
    await page.goto(scenario.route);
    await login(page, scenario.role);
    await expect(page.locator(scenario.ready)).toBeVisible();
    // A second authenticated request must work with the token held in memory.
    expect(await page.evaluate(async () => (await Platform.api('/me')).user.role)).toBe(scenario.role);

    if (scenario.role === 'admin') {
      await expect(page.locator('#adminPanel')).toBeVisible();
      await enterLegacyWorkspace(page, 'map');
      await expect(page.locator('#viewMap')).toBeVisible();
    } else if (scenario.role === 'staff') {
      await enterLegacyWorkspace(page, 'inbox');
      await expect(page.locator('#staffPanel')).toBeVisible();
    }

    if (scenario.role === 'robot') {
      await page.locator('#publicBtn').click();
      await expect(page.locator('#welcomeScreen')).toBeVisible();
      await page.locator('#destinationQuery').fill('اتاق مدیر کجاست؟');
      await page.locator('#destinationForm').getByRole('button', { name: 'جست‌وجو' }).click();
      await expect(page.locator('#destinationResults')).toContainText('اتاق مدیر');
      await page.locator('#settingsBtn').click();
      const form = page.locator('#unlockSettings');
      await form.locator('[name=username]').fill('robot');
      await form.locator('[name=password]').fill('browser-test-password');
      await form.getByRole('button', { name: 'باز کردن تنظیمات', exact: true }).click();
      await expect(page.locator('#settingsDialog')).toBeHidden();
      await expect(page.locator('#stationMain')).toBeVisible();
    }

    await page.locator(scenario.logout).click();
    await expect(page.locator('.auth-form').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('Operator UI and media preflight stay usable when mediaDevices is unavailable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  });
  await page.goto('/user.html');
  await login(page, 'operator');
  await expect(page.locator('#joinForm')).toBeVisible();
  await page.locator('#checkMedia').click();
  await expect(page.locator('#preflight')).toBeVisible();
  await expect(page.locator('#mediaSummary')).toContainText('دوربین و میکروفن در این مرورگر در دسترس نیستند');
  await expect(page.locator('#shareBtn')).toBeHidden();
  await expect(page.locator('#dpad button[data-cmd=F]')).toBeDisabled();
  expect(errors).toEqual([]);
});

// These HTTPS hosts never receive requests: Playwright supplies the complete
// registry/API fixtures below. Tokens and passwords are synthetic test values.
async function discoveryFixture(page, holdLogin = false) {
  let registry = { version: 1, apiBase: 'https://first-test.lhr.life' };
  let healthVersion = 2, pendingLogin = null;
  const requests = [];
  const registryUrl = 'https://registry.test/connection.json';
  let config = fs.readFileSync(path.join(__dirname, '..', 'public', 'config.js'), 'utf8');
  if (/apiDiscoveryUrl\s*:/.test(config)) config = config.replace(/apiDiscoveryUrl\s*:\s*'[^']*'/, `apiDiscoveryUrl: '${registryUrl}'`);
  else config = config.replace("apiBase: '',", `apiBase: '', apiDiscoveryUrl: '${registryUrl}',`);
  await page.route('**/config.js', route => route.fulfill({ body: config, contentType: 'application/javascript' }));
  await page.route('**/vendor/socket.io.min.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.io = () => {
      const handlers = new Map();
      const socket = { connected: true, on(name, fn) { handlers.set(name, fn); return socket; }, disconnect() { socket.connected = false; handlers.get('disconnect')?.('io client disconnect'); }, timeout() { return { emit(name, payload, done) { done(null, {}); } }; } };
      queueMicrotask(() => handlers.get('connect')?.()); return socket;
    };`,
  }));
  await page.route('https://registry.test/connection.json*', route => route.fulfill({ json: registry }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    requests.push({ url: url.href, pathname: url.pathname, method: request.method(), authorization: request.headers().authorization || '' });
    if (url.pathname === '/api/health') return route.fulfill({ json: { ok: true, version: healthVersion } });
    if (url.pathname === '/api/login') {
      const result = { token: `fixture-token-${url.host}`, user: { id: 'operator', role: 'operator', name: 'operator' } };
      if (holdLogin) { pendingLogin = () => route.fulfill({ json: result }); return; }
      return route.fulfill({ json: result });
    }
    if (url.pathname === '/api/robots') return route.fulfill({ json: [] });
    if (url.pathname === '/api/me') return route.fulfill({ json: { user: { id: 'operator', role: 'operator' } } });
    return route.fulfill({ json: {} });
  });
  return {
    requests,
    registry(value) { registry = value; },
    healthVersion(value) { healthVersion = value; },
    get loginPending() { return !!pendingLogin; },
    async releaseLogin() { await pendingLogin(); pendingLogin = null; },
  };
}

test('Discovery checks health before login and invalidates auth when the tunnel host changes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const fixture = await discoveryFixture(page);
  await page.goto('/user.html');
  await expect.poll(() => page.evaluate(() => Platform.connection.state)).toBe('ready');
  await login(page, 'operator');
  await expect(page.locator('#joinForm')).toBeVisible();
  expect(fixture.requests[0].pathname).toBe('/api/health');
  expect(fixture.requests[0].authorization).toBe('');
  expect(fixture.requests.find(r => r.pathname === '/api/login').url).toBe('https://first-test.lhr.life/api/login');
  fixture.registry({ version: 1, apiBase: 'https://second-test.trycloudflare.com' });
  await page.evaluate(() => Platform.refreshBackend());
  await expect(page.locator('.auth-form').first()).toBeVisible();
  expect(await page.evaluate(() => Platform.user)).toBeNull();
  expect(await page.evaluate(() => Platform.connected)).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('robot-platform:https://first-test.lhr.life:user'))).toBeNull();
  await login(page, 'operator');
  await expect(page.locator('#userAuth')).toBeHidden();
  expect(fixture.requests.filter(r => r.url.startsWith('https://second-test.trycloudflare.com')).some(r => r.authorization.includes('first-test'))).toBe(false);
  // Discovering a replacement immediately locks the old session, including
  // when its replacement has not passed the health check.
  fixture.registry({ version: 1, apiBase: 'https://third-test.lhr.life' }); fixture.healthVersion(1);
  expect(await page.evaluate(() => Platform.refreshBackend().then(() => false, () => true))).toBe(true);
  expect(await page.evaluate(() => Platform.user)).toBeNull();
  await expect(page.locator('.auth-form').first()).toBeVisible();
  fixture.healthVersion(2);
  await page.evaluate(() => Platform.refreshBackend());
  expect(await page.evaluate(() => Platform.user)).toBeNull();
  expect(errors).toEqual([]);
});

test('A registry outage preserves a healthy verified server and still locks an unavailable backend', async ({ page }) => {
  const fixture = await discoveryFixture(page);
  await page.goto('/user.html'); await expect.poll(() => page.evaluate(() => Platform.connection.state)).toBe('ready');
  await login(page, 'operator'); await expect(page.locator('#joinForm')).toBeVisible();
  await page.route('https://registry.test/connection.json*', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.evaluate(() => Platform.refreshBackend());
  expect(await page.evaluate(() => Platform.user?.role)).toBe('operator');
  expect(await page.evaluate(() => Platform.connected)).toBe(true);
  await expect(page.locator('#userAuth')).toBeHidden();
  expect(fixture.requests.every(r => new URL(r.url).hostname === 'first-test.lhr.life')).toBe(true);
  fixture.healthVersion(1);
  expect(await page.evaluate(() => Platform.refreshBackend().then(() => false, () => true))).toBe(true);
  expect(await page.evaluate(() => Platform.connected)).toBe(false);
  fixture.healthVersion(2); await page.evaluate(() => Platform.refreshBackend());
  expect(await page.evaluate(() => Platform.connected)).toBe(true);
});

test('Discovery refuses invalid registries and incompatible health without sending login credentials', async ({ page }) => {
  const fixture = await discoveryFixture(page);
  fixture.registry({ version: 1, apiBase: 'https://attacker.test' });
  await page.goto('/user.html');
  await expect.poll(() => page.evaluate(() => Platform.connection.state)).toBe('offline');
  await expect(page.locator('.connection-notice')).toBeVisible();
  await expect(page.locator('.connection-notice')).toContainText('لپ‌تاپ ربات باید روشن');
  await login(page, 'operator');
  await expect(page.locator('.auth-form .form-error')).toContainText('سرور ربات در دسترس نیست');
  for (const registry of [
    { version: 2, apiBase: 'https://first-test.lhr.life' },
    { version: 1, apiBase: 'http://first-test.lhr.life' },
    { version: 1, apiBase: 'https://user:password@first-test.lhr.life' },
    { version: 1, apiBase: 'https://first-test.lhr.life/api' },
    { version: 1, apiBase: 'https://first-test.lhr.life?key=value' },
    { version: 1, apiBase: 'https://first-test.lhr.life.evil.test' },
  ]) {
    fixture.registry(registry);
    expect(await page.evaluate(() => Platform.refreshBackend().then(() => false, () => true))).toBe(true);
  }
  expect(fixture.requests).toEqual([]);
  fixture.registry({ version: 1, apiBase: 'https://first-test.lhr.life' }); fixture.healthVersion(1);
  expect(await page.evaluate(() => Platform.refreshBackend().then(() => false, () => true))).toBe(true);
  expect(fixture.requests.every(r => r.pathname === '/api/health' && !r.authorization)).toBe(true);
  expect(await page.evaluate(() => Platform.user)).toBeNull();
  fixture.healthVersion(2);
  await page.locator('.connection-notice').getByRole('button', { name: 'تلاش دوباره', exact: true }).click();
  await expect(page.locator('.connection-notice')).toBeHidden();
  expect(await page.evaluate(() => Platform.connection.state)).toBe('ready');
});

test('A login response from a previous backend cannot grant a session after discovery changes', async ({ page }) => {
  const fixture = await discoveryFixture(page, true);
  await page.goto('/user.html');
  await expect.poll(() => page.evaluate(() => Platform.connection.state)).toBe('ready');
  await login(page, 'operator');
  await expect.poll(() => fixture.loginPending).toBe(true);
  fixture.registry({ version: 1, apiBase: 'https://second-test.trycloudflare.com' });
  await page.evaluate(() => Platform.refreshBackend());
  await fixture.releaseLogin();
  await expect(page.locator('.auth-form .form-error')).toContainText('سرور تغییر کرد');
  expect(await page.evaluate(() => Platform.user)).toBeNull();
  await expect(page.locator('#joinForm')).toBeHidden();
});
