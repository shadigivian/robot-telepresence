# Changed files and regression record

This deep audit changed `src/services/demo/service.ts` (same-org active member owner transfer; guard global shared identity), `src/app/context.tsx` (login success result), `src/features/auth.tsx` (show denial in form), `src/test/domain.test.ts` (three regression cases), `e2e/deep-audit.spec.ts` (Ali journey and viewport evidence), and legacy `browser-tests/product.spec.js` (wait for online fixture state). Prior uncommitted changes in README, feature checklist, management/session tests, static verifier and UI/features were preserved. Reports/screenshots are new untracked audit artifacts.

Final Feedar: `npm run typecheck` pass; `npm run lint` pass; `npm test` 61/61; `npm run build` pass; `PLAYWRIGHT_CHANNEL=chrome npm run test:static` pass at two bases; `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1` 15/15. Legacy: `npm run check` pass, `npm test` 46/46, isolated Chrome Playwright 24/24. Plain static script without channel failed solely because bundled Chromium was missing; recorded in `PLAYWRIGHT_RESULTS.md`.

No firmware, private runtime config/data, live server or physical robot was modified. Final `git diff --check` and status were checked before handoff; see `evidence/final-status.txt` for captured status and `evidence/source-inventory.tsv` for tracked-path inventory.
