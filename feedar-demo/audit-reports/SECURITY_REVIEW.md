# Security review

## Actual implementation observations
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` found in the reviewed `src` tree. React renders user text as text. This is a source scan, not a penetration test.
- CSV cells are quoted and strings beginning with formula operators or leading whitespace plus an operator are prefixed with an apostrophe (`src/features/csv.ts`). Unit tests exercise CSV escaping.
- The provider checks recipient email, organization, invitation state/expiry and role before acceptance (`src/services/demo/service.ts`). Ordinary cross-tenant routes were exercised in Chrome.
- Session identity lives in sessionStorage; browser records live in IndexedDB. No real credentials were added by this audit.

## Demo-only architectural limitations
- Public password/MFA and browser-held records cannot authenticate a person or enforce tenant isolation against someone who controls the browser. The returning-member flow explicitly says so.
- Dynamic invitation tokens only exist in the originating browser profile. They are not secure cross-device enrollment links.
- Local audit logs, control leases, and software stops are simulations; they are not tamper-proof or physical safety mechanisms.

## Future production requirements
Backend identity/MFA, server-enforced authorization and tenant isolation, signed/expiring invitations, shared durable storage, authenticated realtime control, audit integrity, and hardware safety validation are required before production use. Dependency vulnerability audit was not completed; no claim of dependency safety is made.
