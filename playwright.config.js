const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './browser-tests', testMatch: ['**/product.spec.js', '**/workspaces.spec.js'], timeout: 60000, workers: 1, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3100', headless: true, channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge', launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] }, screenshot: 'only-on-failure' },
  webServer: { command: 'node browser-tests/server.js', url: 'http://127.0.0.1:3100/api/health', reuseExistingServer: false, timeout: 30000 },
});
