# Architecture and source inventory

Repository baseline: 155 tracked paths; 71 under `feedar-demo`, 29 under `public`, 11 under `lib`, 9 under `tests`, 5 under `browser-tests`. `evidence/source-inventory.tsv` lists each tracked path, type, size and line count. Listing and scanning a path is distinguished from close reading of its implementation.

## Dependency map

`feedar-demo/src/main.tsx` → `app/App.tsx`/`app/context.tsx` → feature screens → `services/contracts` → `services/demo/service.ts` → `domain/permissions.ts` + `services/demo/store.ts` → IndexedDB. `simulator/controller.ts` and demo media are browser-only. `data/seed.ts` supplies fictional records. Vite emits hash-routed static assets; no legacy imports were found in Feedar source.

Legacy: `server.js` → `lib/service.js`, `lib/store.js`, organization/workspace/domain modules → JSON file persistence and Socket.IO; `public/platform.js`, `public/user.js`, `public/robot.js` implement browser stations, signaling/WebRTC and Web Serial. `public/safety.js` gates command sequence; Uno and ESP32 sketches implement firmware command/watchdog paths. The projects are independent, with incompatible identity, data and motion contracts. Reuse requires a new server adapter and device protocol review.

Close-read focal paths: Feedar `context.tsx`, `auth.tsx`, `permissions.ts`, `service.ts`, `store.ts`, `simulator/controller.ts`, `management.tsx`, `session.tsx`, `maps.tsx`, `knowledge.tsx`, `App.tsx`, tests and deployment script; legacy `server.js`, `lib/store.js`, `lib/service.js`, `lib/domain.js`, `lib/local-control.js`, `public/robot.js`, `public/user.js`, `public/safety.js`, firmware sketches and browser fixtures. Other tracked files were enumerated and searched for relevant patterns, but are not claimed as line-by-line reviewed.

`service.ts` is a large central action switch. Its benefit is one transactional policy entry point; its risk is that business rules and cross-resource checks can diverge, as FDR-01/02 demonstrated. Separate validated action handlers with an explicit tenant-resource invariant test table would reduce this risk. `store.ts` has a single v1 snapshot and no migration strategy. No repository-wide circular-dependency analysis tool was run; none is claimed.
