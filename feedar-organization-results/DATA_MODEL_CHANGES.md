# Data model and persistence

- `Database.departments`: records include tenant, name, services, existing floor ID, exact location and notes. Floor deletion and department deletion check active references.
- `Organization`: introduction, services, internal guidance, rules and latest browser-local policy PDF with monotonic version counter. Existing logo is reused.
- `Membership` and `Invitation`: organization-scoped username, department, optional phone, employee name/status and robot IDs. Username uniqueness is within an organization.
- `Robot`: optional department and last simulated connection timestamp; display name synchronized to central `RegisteredRobot`. Releasing archives the organization robot, ends active access and closes the assignment-history interval while retaining registry identity.
- `SupportTicket`: category, priority, related robot, optional attachment, replies and `new → in_review / awaiting_reply → closed` state; legacy open/resolved values are still read.
- Store upgrade initializes missing `departments` on older IndexedDB snapshots. Existing seed records and schema version remain; no destructive reset/migration was used. Uploaded Blob storage depends on browser quota/eviction policy.
- Audit records use the actor supplied to `DemoService`, including Boss acting in organization context. Cross-tab refresh uses existing store subscription/BroadcastChannel behavior.

- `ControlGrant.grantedAt` اختیاری است و هنگام تصویب کنترل نوشته می‌شود؛ آخرین کنترل‌کنندهٔ واقعی را پس از Release/End/Expiry از درخواست pending جدا می‌کند.
