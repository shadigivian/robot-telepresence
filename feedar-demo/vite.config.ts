import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const rawBase = process.env.VITE_BASE_PATH ?? '/';
const base = `/${rawBase.split('/').filter(Boolean).join('/')}${rawBase === '/' ? '' : '/'}`;
export default defineConfig({
  base,
  plugins: [tailwindcss()],
  build: { target: 'es2022' },
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/.qa/**','**/test-results/**','**/playwright-report/**','**/audit-reports/**'] } },
  preview: { port: 4173, strictPort: true },
});
