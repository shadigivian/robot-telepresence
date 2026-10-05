const { defineConfig } = require('@playwright/test');

// UI/bootstrap fallbacks are separate from Chromium's real-media product
// tests. No camera, microphone, Web Serial, or fake-device flags are required.
module.exports = defineConfig({
  testDir: './browser-tests',
  testMatch: '**/compatibility.spec.js',
  outputDir: './test-results/compatibility',
  timeout: 45000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'node browser-tests/server.js',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
