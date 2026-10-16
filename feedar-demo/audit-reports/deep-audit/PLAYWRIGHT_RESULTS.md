# Browser execution results

2026-10-13, macOS arm64, installed Google Chrome 154.0.8037.98 via `PLAYWRIGHT_CHANNEL=chrome`. Feedar Playwright: **15 passed, 0 failed, 0 skipped**; legacy isolated Playwright: **24 passed, 0 failed, 0 skipped**. Feedar unit: **61 passed**; legacy unit: **46 passed**. These are distinct suites, 146 total passing test cases, without double-counting typecheck/lint/build/static checks.

`e2e/deep-audit.spec.ts` added Ali Owner→Admin→User lifecycle and seven viewport profiles. Viewports: 1920×1080, 1440×900, 1368×912, 912×1368, 768×1024, 390×844, 360×800. Welcome, login, public kiosk and operations screenshots for every viewport are in `screenshots/` (28 PNGs). Test asserted no horizontal document overflow, page exception or failed request for these routes; this is not a full accessibility audit.

Existing Feedar 13 tests exercise management, invitations, robot assignment, session control, media denial, kiosk, persistence and seven screen types. Legacy fixture browser tests exercise local WebRTC, directory/workspaces, route restrictions and fake robot serial behavior. No live robot was used.

Bundled Chromium was absent and Playwright CDN returned 403 in this location; `npm run test:static` without channel failed for that reason. With `PLAYWRIGHT_CHANNEL=chrome`, root and `/base-check/` static checks passed. Firefox and WebKit were unavailable and not run. `traces/` is empty because Playwright traces are configured for failure and final suite had none. Console/request-failure assertions are in the new viewport test; full browser console logs were not archived.
