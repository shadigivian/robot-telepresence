# Boss feature inventory before cleanup

Authoritative scope: the previously attached complete Boss workflow and the cleanup request. Baseline branch `feedar-demo`, commit `b873771` with pre-existing uncommitted work. This matrix was prepared before implementation edits.

| Current feature/location | Required by Boss? | Used by other roles? | Action | Reason |
| --- | --- | --- | --- | --- |
| Sidebar Overview (`App.tsx`) | Yes | Yes | KEEP | Approved navigation |
| Sidebar Organizations | Yes | No | KEEP | Approved navigation |
| Sidebar Robot Management | Yes | No | KEEP | Approved navigation |
| Sidebar Robot Monitoring | Yes | No | KEEP | Approved navigation |
| Sidebar Settings | Yes, empty | Yes | KEEP, hide active Boss settings | Approved placeholder; Owner/Admin settings remain |
| Sidebar Robot Operations | Only inside organization workspace | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Owner/Admin and scoped Boss need fleet workflow |
| Sidebar Remote Session | Only inside organization workspace | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Owner/Admin/User sessions |
| Sidebar Robot Display | No platform section | Yes/public | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Public kiosk/demo route |
| Sidebar Members | Only inside organization workspace | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Owner/Admin members |
| Sidebar Maps & locations | Only inside organization workspace | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Organization maps |
| Sidebar Invitations | Invitation status in Organizations; management in workspace | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Owner onboarding and member invitations |
| Sidebar Knowledge | No platform section | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Organization content |
| Sidebar Activity & maintenance | Audit needed, separate nav not approved | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Owner/Admin audit; Boss audit records remain |
| Sidebar support, profile/logout, environment notice | Essential shell controls/notices | Yes | KEEP | Explicit exception outside five sections |
| Demo preview switcher | Ambiguous developer demo utility | Yes | NEEDS USER APPROVAL | Retained because shared testing/demo affordance, outside workspace navigation |
| Boss Overview six stats/recent robots/search (`boss.tsx`) | Yes | No | KEEP | Approved content |
| Boss Overview service health, recent activity, diagnostics link (`management.tsx`) | No | Shared component | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Outside allowed Boss overview |
| Boss organization list/details, Owner invitation, ledger | Yes | Parts shared | KEEP | Approved workflow |
| Boss organization detail public tour, member invite, transfer, maps/settings tabs | Only in organization workspace | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Preserve scoped Boss and Owner use |
| Organization create logo upload and quota controls | No | Existing model/settings | REMOVE BOSS-ONLY UI; PRESERVE DATA/MODEL | Form must expose exactly specified business fields |
| Boss central registry and monitoring | Yes | Pairing shared | KEEP | Approved workflow |
| Boss Settings active organization settings/preferences/reset (`management.tsx`) | No in platform mode | Yes | HIDE FROM BOSS platform; PRESERVE SHARED IMPLEMENTATION | Spec calls for empty Boss Settings |
| Direct deep routes for operations/members/maps/etc | Only scoped Boss | Yes | Guard platform Boss; keep scoped Boss and other roles | Prevent obsolete platform pages without deleting shared routes |
| Public links, onboarding, persistence, permissions, audit | Supporting infrastructure | Yes | PRESERVE SHARED IMPLEMENTATION | Security/data integrity |
