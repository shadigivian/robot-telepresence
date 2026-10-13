# Feedar browser demonstration

This directory is a standalone React/TypeScript static demo. Its sibling Node application, private runtime data, and hardware firmware are separate projects; preserve their existing work.

- Use Node 24 LTS and `npm ci`; run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build` for relevant changes.
- Keep product rendering, tenant/role policy, IndexedDB provider operations, and simulation in separate modules. All mutations and motion commands must pass through the provider.
- Frontend identities and permissions demonstrate policy; they provide no production authentication or secure tenant isolation. Keep integrations explicitly labeled local, simulated, permission-dependent, or unavailable.
- Never connect the demo to Web Serial, COM ports, motor drivers, ESP32, existing backend endpoints, or physical robots. Never include private records, real passwords, API secrets, or privileged local bridges in deployable assets.
- Store records and image blobs in IndexedDB. Keep identity in sessionStorage and only small non-sensitive preferences in localStorage. Use atomic transactions for leases; BroadcastChannel only announces changes.
- Stop simulation on release/cancel/blur/hide/lifecycle/fault/expiry; never replay held motion or restart after reset/reconnection. Keep software stop distinct from physical safety.
- Use hash routes and deployment-base-aware URLs. Preserve dark tokens, temporary Feedar branding, accessible focus/dialogs, touch targets, reduced motion, RTL and responsive kiosk layouts.
- Run browser visual checks for the seven demo screens and Surface/mobile variants. Record only checks actually executed in docs/FEATURE_CHECKLIST.md.
- Keep docs and limitations accurate. Preparing workflows does not authorize committing, pushing, activating Pages, or publishing.
