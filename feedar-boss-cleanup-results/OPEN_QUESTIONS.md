# Open questions and known boundaries

1. The floating `Demo preview` persona switcher is outside the workspace sidebar and is used by all role demos and existing browser tests. It was retained because removing this shared utility was ambiguous. Confirm separately if it should be hidden from ordinary users in a later, explicitly scoped task.
2. Existing organization logo and quota values remain in the model and scoped organization settings, but are no longer editable in the platform Create/Edit Organization form. This follows the request for exactly specified business fields without discarding historical data. If a separate Boss quota editor is required, its location needs specification.
3. The three previously reported simulator defects (`control.deny`, stale `control.revoke`, repeated `session.end`) were not changed or re-proven. They need a separate robot-control task and targeted reproduction.
4. Browser-only authorization, local IndexedDB, demo invitations, simulated telemetry and credit units retain the limitations documented in the earlier Boss implementation report. Node 24 LTS retest remains advisable before release.
