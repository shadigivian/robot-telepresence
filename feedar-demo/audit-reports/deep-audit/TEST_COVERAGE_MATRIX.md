# Feature coverage matrix

| Feature / source | Unit | Browser | Negative and remaining gap |
|---|---|---|---|
| Roles/tenant — `domain/permissions.ts`, `demo/service.ts` | `domain.test.ts` | management + deep-audit | Foreign owner and shared profile regressions added; malicious IndexedDB remains outside demo boundary |
| Invitation/login — `auth.tsx`, `context.tsx` | domain invitation cases | Ali flow, wrong recipient, returning login | Eight-hour clock and browser restart not fully automated |
| Organization/member — `management.tsx`, `service.ts` | owner transfer, suspension, quotas | owner/admin/user journey, CRUD smoke | Unicode/concurrent edits incomplete |
| Robot/session/control — `simulator/controller.ts`, `session.tsx` | leases, command sequence, stop | two-tab lease, blur, revoke, media denial | Physical hardware and long-running soak absent |
| Maps/missions — `maps.tsx` | domain validation | POI persistence | Real localization, boundary image decoding matrix absent |
| Knowledge/assistant — `domain/assistant.ts`, `knowledge.tsx` | `public-assistant.test.ts` | public kiosk | Real LLM/voice unavailable by design; long multilingual corpus absent |
| IndexedDB — `demo/store.ts` | corruption and transaction cases | refresh/reset, two-tab control | quota and migration absent |
| Legacy backend/WebRTC/firmware | 46 legacy unit | 24 fixture Chrome | no physical robot, cross-process store or hostile-network test |

Coverage counts are executed cases, not statement coverage. Instrumented code coverage was not run; no percentage is asserted.
