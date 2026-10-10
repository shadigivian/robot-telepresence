const { defineConfig } = require('@playwright/test');
const base = require('./playwright.config');
module.exports = defineConfig({ ...base, testMatch: '**/organization.spec.js' });
