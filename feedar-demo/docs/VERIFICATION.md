# Observed verification — 13 October 2026

The Feedar package was assembled and verified using a temporary Node 24.21.0 toolchain. The machine's pre-existing Node 18 installation was left unchanged. Use Node 24 LTS for this package.

- TypeScript strict check: passed.
- ESLint: passed with no errors or warnings on the final source.
- Vitest: **58 tests passed** in four files (policy/invitations/storage/simulator, public assistant, media lifecycle, CSV).
- Playwright: **13 tests passed** in installed Chrome, including separate User/Admin tabs, approval/revocation/renewed control, pointer release and blur, local emergency-stop/reset, organization and recipient onboarding, Admin escalation restrictions, chat persistence, POI/branding/reset, retained profile drafts, unknown/foreign routes, permission denial/cancellation/late camera cleanup, fullscreen fallback, and responsive screens.
- Static runtime checks: **root `/` and project `/base-check/` passed** for compiled asset loading, direct public tour, refreshed kiosk, and generated deployment-base-aware links.
- Static Vite build: passed. The initial bundle was split into route modules; the largest main chunk is below 500 KB. Vite reports informational third-party `use client` directive warnings; this app is a client-only static build.
- All seven desktop screen types and kiosk/operations at Surface landscape, Surface portrait, and mobile were captured. Representative captures were visually inspected and layout issues repaired. Captures are in `docs/screenshots/`; these are evidence of rendered demo states, not reference-image comparison baselines.

Commands from `feedar-demo/`:

```powershell
npm ci
npm run typecheck
npm run lint
npm test
# Standard CI uses the installed Playwright Chromium browser.
npx playwright install chromium
npm run test:e2e
npm run test:static
npm run build
```

Here the Playwright Chromium CDN download returned a region-access 403. Installed Chrome provided browser validation instead:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
npm run test:static
```

No Firefox/WebKit, real media device, real screen picker, firmware compilation, motor/serial, remote WebRTC, real invitation email, secure backend, or hosted GitHub Actions deployment was tested. The seven approved screen images and prototype HTML were unavailable. Browser APIs were tested with controlled denial/cancellation/cleanup fixtures. Passing these tests is not evidence that a physical robot is ready to operate around people.

A clean npm ci using npm 11.21.0 and the regenerated lockfile passed in the delivered repository package, followed by npm run build. The project pins npm 11.21.0; the original system Node/npm installation was preserved.

Final navigation cleanup was additionally verified with the control and delayed-media browser tests, collecting no page errors. Viewer cleanup preserves another operator lease; explicit Stop remains available for an authorized session. Final lint and build passed after these refinements.
