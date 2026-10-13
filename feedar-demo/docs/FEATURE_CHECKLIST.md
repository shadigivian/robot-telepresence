# Feature checklist and verification

Modes: **local** means functional state persisted in this browser; **simulation** means a labeled deterministic demonstration; **permission-dependent** means a browser API requested after interaction; **external** means future backend/hardware work. This checklist describes the code's intended feature paths and explicitly separates unavailable production services. Observed test results must be recorded only after the commands have actually run.

## 1. Approved design/reference inspection

- Missing reference files: `feedar_robot_prototype.html`, `feedar_ui_overview.png`, `feedar_welcome.png`, `feedar_login.png`, `feedar_owner.png`, `feedar_organizations.png`, `feedar_admin.png`, `feedar_user.png`, `feedar_robot.png`.
- `src/styles`, shared UI, shell, auth, fleet, session, and kiosk use the specified palette/layout and temporary lowercase Feedar mark. No whole screenshot is embedded. Exact reference-image fidelity cannot be verified without the source files.
- Existing application and unrelated work remain separate. The deployable package is `feedar-demo/`.

## 2. Delivery boundaries

- Persistent demo-mode indicator; local CRUD/navigation/chat/maps/invitation forms and simulator controls: **local/simulation**.
- Optional camera/microphone, screen preview, fullscreen: **permission-dependent**, no transmission.
- Remote participants, robot telemetry/motion, assistant, MFA/email/pairing/update workflows: **simulation**.
- Secure identity, shared database, genuine invitations, signaling/media, AI inference, agent/device integration: **external**. No real COM/motor/ESP32 connection, password collection, or paid account requirement.

## 3. Technology and structure

- Strict TypeScript, React, Vite, hash Router, Tailwind styling infrastructure, Lucide, RHF/Zod validated forms, reusable dialogs/components and coherent provider state: **local**.
- Domain, service contracts/demo providers, data, simulator, i18n, tests/e2e, public/assets, docs and workflows are separated. Async local operations use the shared provider; no unnecessary query layer is required for this datastore.
- IndexedDB records/image blobs, small preference localStorage, tab identity sessionStorage, same-origin announcements and transactional leases: **local**. Storage failure/corruption recovery is covered by domain/storage tests. Real multi-device consistency is **external**.

## 4. Visual system/accessibility/responsiveness

- Dark tokens, radial glows, glass panels, approximately 255 px sidebar/76 px header, four KPI cards, map/video split, lowercase mark, breadcrumbs/profile/Support/notifications: shared shell/styles.
- Role-aware destinations and the labeled Demo preview switcher; standalone welcome/login and separate full-viewport kiosk: **local**. Persona switching explicitly impersonates demo identities.
- Visible focus, semantic buttons/fields, native dialog focus, reduced motion, mobile/tablet/Surface adaptations and minimum primary control targets: CSS/UI. Kiosk fullscreen hides management/switcher chrome. English management UI; English/Persian/Turkish robot welcome/assistant with RTL infrastructure.
- Browser screenshot coverage targets all seven persona screens plus Surface landscape/portrait/mobile. Missing source images prevent pixel-reference comparison.

## 5. Domain and authorization

- Separate tenants/users/memberships/device identities; BOSS/OWNER/ADMIN/USER and device-public screen; multi-membership schema; central default-deny checks and resource-ID tenant checks: `domain/permissions`, `services/demo` (**local**).
- Owner/Boss-only Admin changes, Admin generic escalation prevention, own-privilege restrictions, last-active-Owner protection/transfer, suspension/assignment/device invalidation: provider operations and unit tests.
- Support context banner/audit and platform-wide versus tenant-scoped views: shell/management (**local**). Frontend policy is explicitly not secure server isolation (**external**).

## 6. Welcome/login/onboarding

- Welcome mark/tagline/entry; Boss login email/password/visibility, validation/loading, public demo account buttons, MFA code, forgot-reset message, invalid credentials/suspended/expired/logout handling: `features/auth` (**local/simulation**).
- No arbitrary password persistence. .example identities and public password/MFA documented in README.
- Boss create profile/Owner → invitation preview → explicit fictitious recipient acceptance → settings → Admin/User/robot/map/knowledge workflow: management/links/provider (**local**). Secure login/MFA/email are **external**.

## 7. Boss command center

- Shared-record counts, service boundary health, scoped recent activity: Overview (**local**).
- Organization search/status filtering, branding/city/type/Owner/counts, create/edit/open/suspend/reactivate/archive/delete confirmations/dependent cleanup, quotas, profile/contact/logo/Owner data: Organizations/Organization forms (**local**).
- Owner transfer/support/lifecycle audits and global actor/tenant/robot/action/severity/time filtering: Organization/Activity (**local**). Browser audit integrity is not guaranteed.

## 8. Organization workspace

- Header/status/public link/invite actions, KPIs, Robots/Admins/Users/Maps & locations/Settings tabs, invitations and knowledge destinations: Organization (**local**).
- Robot table/details, assignment and lifecycle actions; membership role/status/details/capabilities/assignments/history, search/status/sort/page controls, empty states and removal confirmation: management/fleet/provider (**local**).
- Admins have no Admin mutation path; provider repeats checks. Branding/welcome/language/contact/hours/policy/speed, branch/floor records and quotas update shared local state. Notification preferences are local browser preferences. Logo is a validated local image. Production tenant policy remains **external**.

## 9. Links/invitations

- Distinct public `/o/:slug`, membership `/join/:token`, session `/session/:token`, kiosk `/robot/:robotId/kiosk` hash routes; actual origin/base link construction: links/management (**local**).
- Create/copy/QR/preview/outbox-message/revoke/regenerate/accept; record role/recipient/expiry/status/redemption/revocation/robot/capabilities metadata: provider + Invitations (**local**).
- Unknown/expired/revoked/used/wrong-recipient/wrong-tenant/wrong-kind/inactive screens, single-use acceptance and no driving-by-URL: links/provider/tests.
- Seeded public tours: **local**, fresh-browser seed. Dynamic links/one-time records: same-browser only; unavailable elsewhere. Real shared enrollment/email/global revocation: **external**. No trusted role/private credential URL payload.

## 10. Fleet/pairing/operations

- Approved four tenants and Nola/R-07/FD-HSP-0007, Mira/R-08, Aria/R-09, Lio/R-10; separate connectivity/mode/fault/call fields; online/offline/charging/maintenance/fault scenarios: deterministic seed (**simulation**).
- Inventory filtering/paging/details, device/location/position/assignment/battery/heartbeat/speed/wheel/latency/signal/temperature/media/Surface/serial/fault/version/capability data. Missing voltage/current are unavailable rather than fabricated.
- Add wizard organization/location/device → expiring code/QR → connection test → assignment → activation; wrong-org/expired/revoke/unpair/rotate flows: fleet/provider (**simulation/local**).
- Floor-map/control and robot-card/metric split, operations/control, mission/incident/history/maintenance/release views and scoped software stop-all: fleet/session/maps (**simulation**). Update/reboot/maintenance stop first and do not resume.

## 11. Maps/locations/missions

- Branch/floor records, versioned maps and validated size-limited PNG/JPEG/WebP blobs; upload/preview/replace/activate/delete; floor switch/pan/zoom/reset; POI CRUD and seeded Reception/Radiology/Help Desk/Elevator/Charging Dock: maps/FloorMap/provider (**local**).
- Percent map coordinates and optional calibration metadata; unknown scale warning; simulated marker/heading/dashed routes/destination/ETA and queued/running/paused/completed/canceled/failed states: maps/simulator (**simulation**).
- Real SLAM/localization/avoidance/elevator/docking are **external**. An image/route is not evidence of navigation safety.

## 12. User remote session

- Large simulated camera/PIP, call controls, manual-control card, D-pad/hold joystick and both Admin/Robot chats: session (**local/simulation**).
- Robot/tenant/status/time/quality/capability/access indicators and waiting/ringing/connecting/connected/rejected/busy/reconnecting/disconnected/expired/revoked/ended domain states; eligible join/request/control approval/revoke/release/end: provider/session/tests.
- Multiple authorized viewers and one current operator, distinct call/control states, persisted channel-author-time/pending/delivered/failed/retry/read information: domain/session. Remote media transport is **external**.

## 13. Media/screen preview

- Labeled simulated camera is default. Interaction-only `getUserMedia`/`getDisplayMedia`, local preview explanation, mute/toggle/stop, denial/unavailable/unsupported/cancel/ended/late permission cleanup and fullscreen fallback: media/session (**permission-dependent**).
- Tracks stop on stop/end/logout/unmount and late resolution. No default recording or guaranteed system audio. Contract for signaling/tokens/STUN-TURN/reconnect/participant lifecycle: `services/contracts`, API docs (**external**).

## 14. Control and simulated safety

- Explicit grant states/lease identity/generation/expiry, transactional same-browser exclusive authority, per-command scope/lease checks: domain/provider/simulator (**simulation**).
- Versioned command envelope; reject malformed/non-finite/bounds/expired/duplicate/out-of-order/tenant/session/unauthorized requests; injectable clock, deterministic differential-drive geometry and bounded integration: simulator/tests.
- Hold release/pointer cancel/key release/blur/hidden/navigation/lifecycle/access expiry/revoke/loss/stale telemetry/obstacle/fault force zero; typing ignores shortcuts; reconnect never replays; deliberate new input required: session/controller.
- Authorized Stop has no confirmation; requested/acknowledged/unavailable distinctions; latched software estop and authorized reset with no auto-motion; tenant stop-all: simulator/UI. All geometry/limits/watchdogs are demo settings. Physical safety is **external**.

## 15. Kiosk/assistant/knowledge

- Feedar × tenant two-column welcome/map and Talk/Call/Open map/Text chat/Video help actions; full-viewport route/fullscreen fallback/minimal call/shared preview; only public paired-tenant data: kiosk (**local/simulation/permission-dependent**).
- Scoped published services/hours/policy/contact/location FAQs, referenced demo answers/missing-info/human help, English/Persian/Turkish, typed input and supported optional text-to-speech, call listening stop: assistant/kiosk/i18n (**simulation**).
- Speech recognition is not configured, even in a supporting browser; the listening UI displays unavailable and falls back to typing. Real speech recognition is **external**.
- Demo tool families find_location/show_map/notify_admin/create_support_ticket/start_video_call/check_robot_status/request_navigation go through permitted provider/mission flows, never raw motor PWM.
- FAQ/text/file metadata add/edit/publish/archive; PDF blob labeled stored locally/indexing not configured: knowledge (**local**). Real LLM/retrieval/indexing/speech and Windows kiosk lockdown are **external**.

## 16. Notifications/activity/operations/reset

- Functional profile/notifications/permitted links/Support local ticket/settings; audit actor/role/tenant/entity/action/time/outcome/sanitized summary/filter/safe CSV: shell/management/provider (**local**).
- Simulated release/update history/progress/battery diagnostics/maintenance/incidents/health and scenario panel for offline/serial-loss/low-battery/busy/revoke/latency/obstacle/update-failure/estop: maintenance/fleet/provider (**simulation**).
- Confirmed reset stops simulation/media and restores fixtures: context/provider/tests (**local**). No claim of deployed firmware, actual email, tamper-proof audit, or secure cloud health.

## 17. Data/provider/contracts

- All requested model families have types, IDs/timestamps/revisions and applicable tenant references; schema-versioned transactional IndexedDB and corruption/unavailable/quota handling: models/store/tests (**local**).
- Interchangeable service families, explicit unconfigured production fail-closed semantics; API families and scoped realtime events/validation/rate/idempotency expectations documented: contracts/API docs (**external**).
- Actual credentials and media streams are not serialized; records/data remain owned by this browser profile.

## 18. Production/hardware documentation

- Dashboard → authenticated cloud → Surface agent/kiosk → USB serial → ESP32 → driver → motors; NestJS/PostgreSQL/RLS/Redis/object/realtime/media/AI boundaries: Architecture/API docs (**external**).
- Surface identity/cache/safety/health/startup/updates and secured IPC; ESP32 driver/encoders/closed-loop/watchdog/fault/telemetry; USB-versus-UART distinctions: Hardware docs.
- Versioned HELLO/HEARTBEAT/CMD_VEL/STOP/ESTOP/STATUS/ACK/FAULT, bounds/sequence/deadline/disconnect/safe startup/future CRC/freshness clocks; missing rated driver/power/battery/physical stop/encoder/bumper/localization prerequisites; no invented pins/motor geometry/stopping distance.
- Odometry/calibration/frames/localization/obstacle/planning/ROS2-Nav2 and physical risk testing are **external**. Demo tests do not validate hardware.

## 19. Honest roadmap

- Signed OTA/rollback, maintenance/battery analytics, map approval, multilingual AI/handover, SLAM/navigation, fleet missions/coordination, dock return, multi-branch, predictive maintenance, digital twin, utilization, crowd/queue, privacy masking/retention: `PRODUCTION_ROADMAP.md`.
- Local settings/scenarios illustrate applicable workflows; advanced real services are marked **external**, not complete research/hardware functionality.

## 20. Acceptance tests/visual QA

- Unit/integration source covers roles/resource/tenant policy, escalation/last-Owner, invitations/lifecycle/assignment/KPIs, persistence/corruption, commands/exclusive contention/expiry/ordering/loss/stop-reset/no-resume, assistant scope, and media cleanup.
- Playwright source covers sign-in, organization/Owner onboarding, invitation/member policy, assignments/tenant access, session/control, chat/map/branding/persistence/reset, media/fullscreen/error/direct routes and deployment-base behavior.
- Screenshot capture targets seven persona types, Surface landscape/portrait, and mobile. Root/non-root output must be checked independently. Browser/runtime/visual issues should be fixed before reporting successful checks.
- **Observed verification:** 58 unit tests and 13 Chrome browser tests passed; strict typecheck, lint, static build, and root/project-path runtime checks passed. Screens were captured and inspected. See [VERIFICATION.md](VERIFICATION.md) for commands, browser fallback and untested hardware/external services.

## 21. Static deployment

- Dev/build/preview/lint/typecheck/test/test:e2e scripts; lockfile; Node 24 LTS; ignored generated/private/machine files; base-path config; hash routing and origin-derived links: package/config/docs (**local**).
- Separate trusted CI and Pages workflow checks then static `dist/` artifact upload/deploy, least privilege, environment/concurrency; Settings → Pages → GitHub Actions/custom-domain/base troubleshooting: workflow + Deployment docs.
- No push/repository creation/visibility/hosting activation/purchase/publication without explicit authorization. Prepared workflows are not a live deployment. No real secret is needed or suggested in VITE variables.

## 22. Handoff

- README and concise package AGENTS; this checklist plus Workflows/Mermaid, Architecture, Permissions, API Contracts, Hardware/Safety, Deployment, Production Roadmap documentation.
- Handoff must list implementation, fictitious accounts, commands, observed results/changed paths, missing references, browser-local/simulated/external boundaries, remaining limitations and reviewable deployment steps. Do not silently equate simulated operation with hardware readiness.
