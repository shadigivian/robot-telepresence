# Feedar Robot Cloud — browser demo

A stateful React/TypeScript demonstration of Feedar's robotics dashboard, role workflows, robot operations, remote session, maps, and public Surface kiosk. **DEMO MODE — Simulated robot; no physical hardware connected.** This package is isolated from the existing application in the parent repository, which remains untouched and is not required at runtime.

## Run locally

Use **Node.js 24 LTS and npm 11.21.0** (the package manager is pinned in package.json). From the repository root:

```powershell
cd feedar-demo
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173/`. The package needs no secret, external account, server database, Docker service, COM port, or paid integration. The committed lockfile supplies reproducible dependency versions.

## Fictitious accounts

Public demo password for every listed identity: **`123456`**. Public demo MFA code: **`123456`**. The demo login requires manually entering a fictitious account. Never enter a real password or private information.

- Boss: `boss@feedar.example` — platform-wide tenant operations.
- Organization Owner: `owner@futurehealth.example` — Future Health Hospital administration.
- Admin: `admin@futurehealth.example` — ordinary User/robot/session operations in Future Health.
- User: `user@futurehealth.example` — assigned robots and authorized sessions.

Identity is tab-scoped and expires after eight hours/logout. Local demo sign-in uses fictitious credentials and is not production authentication. Separate tabs can demonstrate Admin/User cooperation using same-browser records. Public robot kiosk routes carry no management login data.

After accepting a local Owner, Admin, or User invitation, return through **Demo member sign in** with the invited `.example` email and the same public demo password above. The membership is retained only in the browser profile and origin where it was accepted. This workflow does not verify a person's identity; do not use real credentials or personal data.

## Explore

Welcome → demo sign-in/MFA → Boss dashboard → create organization and Owner invitation → recipient acceptance → organization setup → Admin/User invitations and robot assignments → operations/maps/knowledge → session/chat → control request/approval/revocation → public kiosk/assistant. Seeded tenants are Future Health Hospital, Atlas Airport Services, Riva Convention Center, and Nova Hotels Group. Nola/R-07/FD-HSP-0007, Mira/R-08, Aria/R-09, and Lio/R-10 have consistent tenant ownership.

Public tours such as `/#/o/future-health` work after a fresh-browser seed. Links are built from the current origin/base. Dynamically created invitations are records in the originating browser datastore; they cannot enroll someone from another browser, and an unknown record shows an honest unavailable screen.

## What runs

- **Working locally:** navigation, validation, CRUD, scoped role policy, invitation state/QR/copy/redemption, assignments, maps/POIs/missions, knowledge, chat, notifications/support, audit filtering/export, persistence, and deterministic reset.
- **Simulated:** remote video participants/camera scene, robot telemetry and motion, control leases, MFA, pairing, updates/releases, AI replies, email outbox, connection/fault scenarios.
- **Browser permission-dependent:** optional local camera/microphone preview, screen-capture preview, fullscreen, and supported speech synthesis. Nothing is transmitted to another device by static mode. Speech recognition is not configured, even in a supporting browser; use typed input.
- **External infrastructure required:** secure authentication/MFA, server-enforced tenant isolation, shared database, real invitations/email, media/signaling, AI inference/ingestion, Surface agent, ESP32/driver/sensors, real localization/navigation, and physical safety validation.

IndexedDB stores demo records and image data. localStorage stores only small non-sensitive preferences; sessionStorage stores tab identity. BroadcastChannel refreshes local tabs; exclusive leases use transactional storage. Frontend permission checks and browser audit records are demonstrations, not secure or tamper-proof services.

## Build and verify

Run from `feedar-demo`:

```powershell
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run test:static
npm run build
npm run preview
```

`dist/` is the static artifact. Visual/browser coverage and any observed results are recorded in [FEATURE_CHECKLIST.md](docs/FEATURE_CHECKLIST.md). Hardware tests are not part of this package. Passing simulator tests must not be interpreted as physical robot readiness.

## Design references

The supplied design files were unavailable during implementation: `feedar_robot_prototype.html`, `feedar_ui_overview.png`, `feedar_welcome.png`, `feedar_login.png`, `feedar_owner.png`, `feedar_organizations.png`, `feedar_admin.png`, `feedar_user.png`, and `feedar_robot.png`. The implementation follows the exact specified dark palette, lowercase Feedar wordmark, gradient tile, sidebar/topbar, KPI cards, map/control split, session video/control split, and kiosk layout. The temporary mark is a placeholder, not an asserted official company logo. Pixel comparison with unavailable references remains impossible until they are supplied.

## Deployment and documentation

Separate CI and GitHub Pages workflows are prepared at the parent repository's `.github/workflows/`. No repository creation, visibility change, commit push, hosting activation, purchase, or publication is performed by this implementation. Review the changes and use [DEPLOYMENT.md](docs/DEPLOYMENT.md) for Pages setup and base-path commands.

- [Feature checklist and verification](docs/FEATURE_CHECKLIST.md)
- [Interactive workflows](docs/WORKFLOWS.md)
- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Role/resource/capability policy](docs/PERMISSIONS.md)
- [Service/API contracts](docs/API_CONTRACTS.md)
- [Hardware and safety](docs/HARDWARE_AND_SAFETY.md)
- [Production roadmap](docs/PRODUCTION_ROADMAP.md)

The development dependency AJV 8 explicitly satisfies the form resolver optional peer; ESLint retains its compatible nested AJV 6. npm 11 is supported for reproducible installation. On Node 24, use `npm install --global npm@11.21.0` if your npm version differs.
