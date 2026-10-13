import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['**/*.{ts,tsx}'], languageOptions: { globals: Object.fromEntries(['window','document','navigator','console','setTimeout','clearTimeout','setInterval','clearInterval','URL','Blob','File','FileReader','indexedDB','BroadcastChannel','sessionStorage','localStorage','crypto','structuredClone','performance','requestAnimationFrame','cancelAnimationFrame','fetch','MediaStream','HTMLElement','HTMLInputElement','HTMLVideoElement','HTMLDialogElement','AbortController','IDBDatabase','IDBTransaction','IDBRequest','IDBOpenDBRequest','IDBFactory','KeyboardEvent','PointerEvent','Event','StorageEvent','URLSearchParams','location'].map(k => [k, 'readonly'])) }, rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], '@typescript-eslint/no-explicit-any': 'error' } },
);
