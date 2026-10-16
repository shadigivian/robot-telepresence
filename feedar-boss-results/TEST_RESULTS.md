# Test results

2026-10-14, local macOS, Node 26.5.1 and npm 11.17.0 (Node 24 LTS requested by repository but unavailable locally). Chrome selected with `PLAYWRIGHT_CHANNEL=chrome` because bundled Chromium was unavailable. Localhost browser checks needed sandbox escalation.

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm test` | 67 passed, 0 failed, 0 skipped |
| `npm run build` | pass; dependency `use client` bundler warnings |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:static` | pass at `/` and `/base-check/` |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1` | 17 passed, 0 failed, 0 skipped |
| `git diff --check` | pass |

Browser tests cover organization creation/phone/invitation, Boss context edits and two-tenant isolation, ledger persistence, central robot registration and Owner pairing/test/activation, existing roles and session-control regressions, responsive views and static routes. Physical QR camera, hardware and production services were not tested.
