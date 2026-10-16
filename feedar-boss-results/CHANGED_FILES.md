# Files changed for this workflow

The working tree already contained unrelated uncommitted edits before this task; they were preserved. Files edited or added specifically for Boss workflow:

- `feedar-demo/src/app/App.tsx` — Boss routes/navigation and Back to Boss.
- `feedar-demo/src/app/context.tsx` — public record filtering for new private collections.
- `feedar-demo/src/data/seed.ts` — registry seed and ledger.
- `feedar-demo/src/domain/models.ts` — registry and ledger types.
- `feedar-demo/src/domain/permissions.ts` — Boss and organization pairing actions.
- `feedar-demo/src/domain/phone.ts` — country-aware phone normalization.
- `feedar-demo/src/services/demo/store.ts` — backward-compatible snapshot upgrade/validation.
- `feedar-demo/src/services/demo/service.ts` — organization, ledger and registry mutations.
- `feedar-demo/src/features/management.tsx` — organization form/details/overview and context entry.
- `feedar-demo/src/features/fleet.tsx` — registry pairing wizard.
- `feedar-demo/src/features/boss.tsx` — overview, credit ledger, registry and monitoring views.
- `feedar-demo/src/components/QrIdentifierScanner.tsx` — optional camera scan.
- `feedar-demo/src/test/domain.test.ts` — existing creation fixture updated for required phone.
- `feedar-demo/src/test/boss.test.ts` — focused domain tests.
- `feedar-demo/e2e/management.spec.ts`, `feedar-demo/e2e/deep-audit.spec.ts` — existing create flow updated for phone.
- `feedar-demo/e2e/boss.spec.ts` — two complete browser workflows.

No CSS, legacy backend or firmware file was edited for this workflow.
