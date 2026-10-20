import { expect, test, type Locator, type Page } from '@playwright/test';
import { signInDemo } from './helpers/demo-login';
import type { Database } from '../src/domain/models';

const ids = {
  symbol: 'FDR-BRAND-FEEDAR-SYMBOL', wordmark: 'FDR-BRAND-FEEDAR-WORDMARK', robots: 'FDR-NAV-ROBOTS',
  online: 'FDR-ROBOT-ONLINE', offline: 'FDR-ROBOT-OFFLINE', available: 'FDR-ROBOT-AVAILABLE', busy: 'FDR-ROBOT-BUSY',
  unavailable: 'FDR-ROBOT-UNAVAILABLE', battery: 'FDR-ROBOT-BATTERY', charging: 'FDR-ROBOT-CHARGING', critical: 'FDR-ROBOT-CRITICAL-BATTERY',
  current: 'FDR-CURRENT-CONNECTED-USER', last: 'FDR-LAST-CONNECTED-USER', notification: 'FDR-NOTIFICATION-BELL',
  ticket: 'FDR-TICKET-STATUS-BADGE', empty: 'FDR-SHARED-EMPTY',
} as const;
const asset = (scope: Page | Locator, id: string) => scope.locator(`svg[data-asset-id="${id}"]`);
const robotRow = (page: Page, deviceId = 'FD-HSP-0007') => page.getByRole('row').filter({ hasText: deviceId });
const open = (page: Page, route: string) => page.goto(`./#${route}`);

function browserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  return errors;
}

async function sourceGeometry(svg: Locator) {
  return svg.evaluate(element => ({
    viewBox: element.getAttribute('viewBox'),
    shapes: [...element.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse,g')].map(shape => ({
      tag: shape.tagName,
      geometry: [...shape.attributes].filter(attribute => ['d','x','y','x1','x2','y1','y2','width','height','cx','cy','r','rx','ry','points','transform','data-ticket-state','data-battery-segment'].includes(attribute.name)).map(attribute => [attribute.name, attribute.value]),
    })),
  }));
}

async function expectUsableAsset(svg: Locator, viewBox = '0 0 24 24') {
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute('viewBox', viewBox);
  await expect(svg.locator('script,foreignObject,image,animate,animateTransform,text')).toHaveCount(0);
  expect(await svg.evaluate(element => {
    const svgElement = element as SVGSVGElement;
    const bounds = svgElement.getBBox(), box = svgElement.viewBox.baseVal, style = getComputedStyle(element);
    return {
      nonempty: bounds.width > 0 && bounds.height > 0,
      insideViewBox: bounds.x >= box.x && bounds.y >= box.y && bounds.x + bounds.width <= box.x + box.width && bounds.y + bounds.height <= box.y + box.height,
      unmirrored: style.transform === 'none' || style.transform === 'matrix(1, 0, 0, 1, 0, 0)',
      runningAnimationCount: element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
    };
  })).toEqual({ nonempty: true, insideViewBox: true, unmirrored: true, runningAnimationCount: 0 });
}

async function expectUniqueSvgIds(page: Page) {
  const duplicates = await page.locator('svg [id]').evaluateAll(elements => {
    const ids = elements.map(element => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicates).toEqual([]);
}

test('Feedar brand, robot navigation and notification assets retain geometry and keyboard behavior across themes', async ({ page }) => {
  const errors = browserErrors(page);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await open(page, '/login');
  await expectUsableAsset(asset(page, ids.symbol).first(), '0 0 64 64');
  await expectUsableAsset(asset(page, ids.wordmark).first(), '0 0 280 72');
  const initialSymbol = await sourceGeometry(asset(page, ids.symbol).first());
  const initialWordmark = await sourceGeometry(asset(page, ids.wordmark).first());
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await sourceGeometry(asset(page, ids.symbol).first())).toEqual(initialSymbol);
  expect(await sourceGeometry(asset(page, ids.wordmark).first())).toEqual(initialWordmark);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Public demo password')).toHaveAttribute('type', 'password');
  await signInDemo(page, 'Boss');
  const navigation = page.getByRole('navigation', { name: 'Workspace navigation' });
  const robots = navigation.getByRole('link', { name: 'Robot Management', exact: true });
  await expectUsableAsset(asset(robots, ids.robots));
  await robots.click();
  await expect(page.getByRole('heading', { name: 'Robot Management', exact: true })).toBeVisible();
  const notifications = page.getByRole('button', { name: 'Notifications', exact: true });
  await expectUsableAsset(asset(notifications, ids.notification));
  await expect(asset(notifications, ids.notification)).toHaveAttribute('aria-hidden', 'true');
  await notifications.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toHaveCount(0);
  await open(page, '/robot-monitoring');
  await expect(page.getByRole('heading', { name: 'Robot Monitoring', exact: true })).toBeVisible();
  const monitoringRows = page.locator('tbody tr');
  await expect(monitoringRows).toHaveCount(6);
  for (const row of await monitoringRows.all()) {
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(110);
  }
  await expectUniqueSvgIds(page);
  expect(errors).toEqual([]);
});

test('real robot rows distinguish connection, availability, battery and current or last controller without changing control policy', async ({ page, context }) => {
  const errors = browserErrors(page);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await signInDemo(page, 'Org');
  // Only fictional provider data changes: expose existing critical/offline render branches.
  await page.evaluate(async () => {
    const modulePath = new URL('src/app/context.tsx', location.href.split('#')[0]).pathname;
    const module = await import(modulePath);
    await module.store.transaction((db: Database) => {
      const robot = db.robots.find(record => record.id === 'robot-11')!;
      robot.battery = 7; robot.connectivity = 'offline';
    });
  });
  await open(page, '/org/status');
  const available = robotRow(page);
  const unavailable = robotRow(page, 'FD-HSP-0011');
  const charging = robotRow(page, 'FD-HSP-0012');
  const expectedAssets = [ids.online, ids.offline, ids.available, ids.unavailable, ids.battery, ids.charging, ids.critical];
  const lightGeometry: Record<string, Awaited<ReturnType<typeof sourceGeometry>>> = {};
  for (const id of expectedAssets) { await expectUsableAsset(asset(page, id).first()); lightGeometry[id] = await sourceGeometry(asset(page, id).first()); }
  await expect(available.locator('[data-label="Availability"]')).toContainText('Available');
  await expect(available.locator('[data-label="Battery"]')).toContainText('87%');
  await expect(unavailable.locator('[data-label="Connection"]')).toContainText('offline');
  await expect(unavailable.locator('[data-label="Availability"]')).toContainText('Unavailable');
  await expect(unavailable.locator('[data-label="Battery"]')).toContainText('7%');
  await expect(charging.locator('[data-label="Battery"]')).toContainText('38%');
  await expect(asset(unavailable.locator('[data-label="Connection"]'), ids.offline)).toBeVisible();
  await expect(asset(unavailable.locator('[data-label="Availability"]'), ids.unavailable)).toBeVisible();
  await expect(asset(unavailable.locator('[data-label="Battery"]'), ids.critical)).toBeVisible();
  await expect(asset(charging.locator('[data-label="Battery"]'), ids.charging)).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  for (const id of expectedAssets) { await expectUsableAsset(asset(page, id).first()); expect(await sourceGeometry(asset(page, id).first())).toEqual(lightGeometry[id]); }
  await expectUniqueSvgIds(page);

  const user = await context.newPage();
  user.on('pageerror', error => errors.push(error.message));
  await signInDemo(user, 'User');
  await user.getByRole('button', { name: 'Request session', exact: true }).click();
  await user.getByRole('button', { name: 'Join demo session', exact: true }).click();
  await user.getByRole('button', { name: 'Request control', exact: true }).click();
  await open(page, '/org/status');
  await expect(available).toContainText('No active user');
  await expect(asset(available, ids.current)).toHaveCount(0);
  await open(page, '/org/telepresence');
  await page.getByRole('button', { name: 'Approve control', exact: true }).click();
  await open(page, '/org/status');
  await expect(available.locator('[data-label="Current Connected User"]')).toContainText('Daniel Foster');
  await expect(available.locator('[data-label="Availability"]')).toContainText('Busy');
  await expectUsableAsset(asset(available, ids.current));
  await expectUsableAsset(asset(available, ids.busy));
  await user.getByRole('button', { name: 'Release control', exact: true }).click();
  await expect(available.locator('[data-label="Current Connected User"]')).toContainText('No active user');
  await expect(asset(available, ids.current)).toHaveCount(0);
  await expect(available.locator('[data-label="Last Connected User"]')).toContainText('Daniel Foster');
  await expectUsableAsset(asset(available, ids.last));
  await expect(available.locator('[data-label="Availability"]')).toContainText('Available');
  await user.getByRole('button', { name: 'End call', exact: true }).click();
  await page.reload();
  await expect(available.locator('[data-label="Last Connected User"]')).toContainText('Daniel Foster');
  await expectUniqueSvgIds(page);
  expect(errors).toEqual([]);
});

test('ticket glyphs render five real states and the new alias while empty and unavailable or denied routes stay distinct', async ({ page }) => {
  const errors = browserErrors(page);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await signInDemo(page, 'Boss');
  await open(page, '/boss/support');
  await expect(page.getByRole('heading', { name: 'No matching tickets' })).toBeVisible();
  await expectUsableAsset(asset(page, ids.empty), '0 0 96 96');
  await page.evaluate(async () => {
    const modulePath = new URL('src/app/context.tsx', location.href.split('#')[0]).pathname;
    const module = await import(modulePath);
    await module.store.transaction((db: Database) => {
      const now = Date.now();
      db.tickets = (['open','new','in_review','awaiting_reply','resolved','closed'] as const).map((status, index) => ({
        id: `asset-regression-${status}`, createdAt: now + index, updatedAt: now + index, revision: 1,
        organizationId: 'org-hospital', userId: 'user', robotId: 'robot-7', subject: `Asset fixture ${status}`,
        text: 'Fictional SVG regression fixture.', status, category: 'technical', priority: 'normal', replies: [], creatorRole: 'USER',
      }));
    });
  });
  await expect(page.locator('tbody tr')).toHaveCount(6);
  const geometry: Record<string, Awaited<ReturnType<typeof sourceGeometry>>> = {};
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    for (const status of ['open','new','in_review','awaiting_reply','resolved','closed']) {
      const row = page.getByRole('row').filter({ hasText: `Asset fixture ${status}` });
      const glyph = asset(row, ids.ticket);
      await expectUsableAsset(glyph);
      const selected = await glyph.locator('[data-ticket-state]').evaluateAll(elements => elements.filter(element => getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0).map(element => element.getAttribute('data-ticket-state')));
      expect(selected).toEqual([status === 'new' ? 'open' : status]);
      const labels: Record<string, RegExp> = { open: /^open$/i, new: /^open$/i, in_review: /^In Progress$/, awaiting_reply: /^Waiting for User$/, resolved: /^resolved$/i, closed: /^closed$/i };
      await expect(row.locator('td').nth(6)).toHaveText(labels[status]);
      if (theme === 'light') geometry[status] = await sourceGeometry(glyph);
      else expect(await sourceGeometry(glyph)).toEqual(geometry[status]);
    }
    expect(await sourceGeometry(asset(page.getByRole('row').filter({ hasText: 'Asset fixture new' }), ids.ticket))).toEqual(await sourceGeometry(asset(page.getByRole('row').filter({ hasText: 'Asset fixture open' }), ids.ticket)));
    await expectUniqueSvgIds(page);
  }
  await open(page, '/operations');
  await expect(page.getByRole('heading', { name: 'Organization workspace required' })).toBeVisible();
  await expect(asset(page, ids.empty)).toHaveCount(0);
  await expect(page.locator('.empty svg')).toHaveClass(/lucide-circle-help/);
  await signInDemo(page, 'User');
  await open(page, '/organizations');
  await expect(page.getByRole('heading', { name: 'Access unavailable' })).toBeVisible();
  await expect(asset(page, ids.empty)).toHaveCount(0);
  await expect(page.locator('.empty svg')).toHaveClass(/lucide-circle-alert/);
  await open(page, '/asset-regression-unknown-route');
  await expect(page.getByRole('heading', { name: 'This demo page is unavailable' })).toBeVisible();
  await expect(asset(page, ids.empty)).toHaveCount(0);
  await expect(page.locator('.empty svg')).toHaveClass(/lucide-circle-alert/);
  expect(errors).toEqual([]);
});

test('organization logo, uploaded map, invitation QR and RTL branding preserve their own runtime content', async ({ page }) => {
  const errors = browserErrors(page);
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await signInDemo(page, 'Org');
  const originalLogo = await page.evaluate(async () => {
    const modulePath = new URL('src/app/context.tsx', location.href.split('#')[0]).pathname;
    const module = await import(modulePath);
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#117980'; ctx.fillRect(0, 0, 64, 64); ctx.fillStyle = '#faf8f5'; ctx.fillRect(12, 26, 40, 12); ctx.fillRect(26, 12, 12, 40);
    const logo = canvas.toDataURL('image/png');
    const mapCanvas = document.createElement('canvas'); mapCanvas.width = 320; mapCanvas.height = 200;
    const mc = mapCanvas.getContext('2d')!; mc.fillStyle = '#10243a'; mc.fillRect(0, 0, 320, 200); mc.strokeStyle = '#617d99'; mc.lineWidth = 4; mc.strokeRect(20, 20, 280, 160);
    const mapBlob = await new Promise<Blob>(resolve => mapCanvas.toBlob(blob => resolve(blob!), 'image/png'));
    await module.store.transaction((db: Database) => {
      const now = Date.now(); db.organizations.find(org => org.id === 'org-hospital')!.logo = logo;
      db.maps.find(map => map.id === 'map-floor-org-hospital-0')!.blob = mapBlob;
      db.invitations.push({ id: 'asset-invitation', createdAt: now, updatedAt: now, revision: 1, organizationId: 'org-hospital', kind: 'membership', token: 'asset-synthetic-recipient', role: 'USER', invitee: 'asset.recipient@futurehealth.example', inviterId: 'owner', robotIds: ['robot-7'], capabilities: ['video','chat'], expiresAt: now + 7 * 86400000, status: 'pending' });
    });
    return logo;
  });
  await open(page, '/org/info');
  await expect(page.getByRole('img', { name: /logo preview/ })).toHaveAttribute('src', originalLogo);
  await open(page, '/maps');
  const mapImage = page.getByRole('img', { name: 'Ground floor uploaded floor plan' });
  await expect(mapImage).toBeVisible();
  await expect(mapImage).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => mapImage.evaluate(element => ({ width: (element as HTMLImageElement).naturalWidth, height: (element as HTMLImageElement).naturalHeight }))).toEqual({ width: 320, height: 200 });
  await open(page, '/invitations');
  await page.getByRole('row').filter({ hasText: 'asset.recipient@futurehealth.example' }).getByRole('button', { name: 'QR', exact: true }).click();
  const qr = page.getByRole('img', { name: 'QR code for the displayed demo URL' });
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/);
  const originalQr = await qr.getAttribute('src');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('row').filter({ hasText: 'asset.recipient@futurehealth.example' }).getByRole('button', { name: 'QR', exact: true }).click();
  await expect(qr).toHaveAttribute('src', originalQr!);
  await page.keyboard.press('Escape');
  await open(page, '/robot/robot-7/kiosk');
  await expect(page.getByRole('img', { name: 'Future Health Hospital demo organization logo' })).toHaveAttribute('src', originalLogo);
  const symbolGeometry = await sourceGeometry(asset(page, ids.symbol).first());
  const wordmarkGeometry = await sourceGeometry(asset(page, ids.wordmark).first());
  await page.getByLabel('Kiosk language').selectOption('fa');
  await expect(page.locator('.kiosk-screen')).toHaveAttribute('dir', 'rtl');
  await expectUsableAsset(asset(page, ids.symbol).first(), '0 0 64 64');
  await expectUsableAsset(asset(page, ids.wordmark).first(), '0 0 280 72');
  expect(await sourceGeometry(asset(page, ids.symbol).first())).toEqual(symbolGeometry);
  expect(await sourceGeometry(asset(page, ids.wordmark).first())).toEqual(wordmarkGeometry);
  await expectUniqueSvgIds(page);
  expect(errors).toEqual([]);
});
