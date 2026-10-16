# Executed test results

Audit date (client timezone Asia/Tehran): 2026-10-13. Branch `feedar-demo`, baseline commit `b873771`. Environment: macOS arm64, Node 26.5.1, npm 11.17.0. Repository requests Node 24 LTS and npm 11.21.0; those exact versions were unavailable locally.

| Check | Baseline | Final |
| --- | --- | --- |
| `npm ci` | pass, 197 packages | unchanged |
| `npm run typecheck` | pass | pass |
| `npm run lint` | pass | pass |
| `npm test` | 58 passed | 58 passed, 0 failed, 0 skipped |
| `npm run build` | pass | pass |
| `npm run test:static` | sandbox localhost EPERM, then missing bundled Chromium | pass with `PLAYWRIGHT_CHANNEL=chrome` (root and `/base-check/`) |
| `npm run test:e2e` | 13 unable to launch: bundled Chromium absent | 13 passed, 0 failed, 0 skipped with installed Chrome and `--workers=1` |

The Playwright CDN returned HTTP 403 with “service is not available in your location” for bundled Chromium. Installed Google Chrome was used through `PLAYWRIGHT_CHANNEL=chrome`. An intermediate run found an existing ambiguous test locator that clicked the persona switcher instead of the login card; corrected before the final run. Intermediate persistence tests also reloaded before asynchronous saves completed; they now wait for persisted state. No product data loss was confirmed.

Visual screenshots from the final Chrome run are under `audit-reports/screenshots/` (13 files). The seven demo screen types were exercised at 1440×1000, and kiosk/operations at Surface landscape 1368×912, Surface portrait 912×1368 and mobile 390×844. Firefox, WebKit, 1920×1080, 1440×900 and tablet 768×1024 were not run. No physical hardware tests were run. No production endpoint was contacted.

Static checks verified built assets, direct public route, kiosk refresh, and generated public tour link at root and a non-root deployment base.
