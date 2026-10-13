import { defineConfig } from '@playwright/test';
const base = process.env.VITE_BASE_PATH ?? '/';
export default defineConfig({
 testDir: './e2e', timeout: 30000, expect: { timeout: 8000 }, fullyParallel:false,
 reporter: [['list'], ['html', {open:'never'}]],
 use: {baseURL:`http://127.0.0.1:5173${base}`,channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer: {command:`"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1`,url:`http://127.0.0.1:5173${base}`,reuseExistingServer:!process.env.CI,timeout:60000},
 projects: [{name:'chromium',use:{browserName:'chromium'}}],
});
