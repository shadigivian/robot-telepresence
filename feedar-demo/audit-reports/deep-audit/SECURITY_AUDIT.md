# Security audit

Scope: local static Feedar and read-only legacy source plus disposable local tests. No internet endpoint or real device was probed.

**Confirmed and fixed:** provider-level owner transfer accepted an active user outside the organization (`src/services/demo/service.ts:154`); provider-level member edit modified a globally shared identity (`service.ts:163`). Negative regression tests are at `src/test/domain.test.ts:27-28`.

**Architectural boundary:** Feedar `src/services/demo/store.ts:41-116` persists all fictional records in client IndexedDB. `src/domain/permissions.ts:18-48` is a simulation policy, not a server security boundary. `src/features/auth.tsx:15-49` uses a public password and a public MFA example. Treat all browser data as readable and writable by that browser user. Do not use real accounts, PHI, credentials or physical robot commands. A production backend must independently authorize every resource and mutation.

**Controls inspected:** tenant scoping and role rules (`permissions.ts`); synchronous IndexedDB transactions and corruption checks (`store.ts`); invitation lifecycle, session/grant invalidation and command sequence in `service.ts`; upload MIME/size checks in `src/features/maps.tsx:42`, `management.tsx:96`, `knowledge.tsx:21`; CSV escaping in `src/features/csv.ts`; text rendering in React. A targeted malicious robot-name legacy browser test passed. No exhaustive fuzzing or CSP/header scan of a deployed site was done.

**Legacy boundary:** `lib/store.js` hashes passwords with scrypt and atomically renames its JSON snapshot; `lib/local-control.js` requires loopback and a random key. Socket and WebRTC paths were exercised only with local fixture credentials and fake media. No penetration test or real network adversary test was done. Its JSON file store assumes one writer/process; concurrent processes and crash recovery remain deployment risks.

`npm audit --json` reported 0 advisories for both dependency trees on the audit date. This is a registry advisory snapshot, not proof of absence of vulnerabilities. Secrets, live `.env` and runtime data were not opened or copied.
