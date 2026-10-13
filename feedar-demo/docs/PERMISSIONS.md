# Permissions and tenant policy

An Organization is a tenant. Human users, memberships, assignments, and robot device identities are separate records. A person can hold different memberships in different tenants. The selected identity is tab-scoped for Boss/Admin/User demonstrations. Persona preview is a deliberate demonstration switch, not authentication or privilege escalation in a real service.

All provider actions default-deny unknown actions and validate resources by ID, including their organization and current lifecycle. Route guards and hidden buttons supplement provider checks. These frontend checks are not secure backend enforcement.

## Role/resource/capability matrix

- **BOSS / PLATFORM_OWNER:** Platform-wide organization, member, robot, session, incident, release, quota, and audit visibility. Create/edit/suspend/reactivate/archive/delete organizations; assign/transfer Owners; override Owner-only Admin management. Entering tenant support context requires an explicit action/banner and an audit record. A global stop context is explicitly platform-wide.
- **ORGANIZATION_OWNER:** Organization-scoped profile, branding, contacts, languages, hours, branches/floors/maps, knowledge, session policy, reports, and notification settings. Manage that tenant's Admin and User memberships, robots, assignments, invitations, missions, sessions, telemetry, takeover, and stop. Cannot create tenants or inspect unrelated tenants.
- **ADMIN:** View/edit permitted tenant robots; manage ordinary Users and assignments; issue User and session invitations; manage authorized sessions, chat, telemetry, control approvals/revocations, stops, and maintenance. Maps and missions require the applicable membership capability. Cannot invite/create/edit/suspend/remove/promote/demote an Admin or Owner, change their own privileges, change tenant quotas, or create an organization.
- **USER:** View assigned robots and authorized sessions/maps; request/join a call, send session chat, preview screen sharing, and request manual control subject to session capabilities. Driving requires an approved current lease. Stop is allowed for their authorized session robot. Cannot manage members, robot/device settings, knowledge, maps, tenants, or other assignments.
- **ROBOT_DEVICE:** Paired device identity scoped to one tenant and location. Public kiosk exposes only approved public organization information, active map/POIs, assistant, and public help flows. It is not a human login and never exposes management credentials or Admin data.

## Resource checks

Every mutation validates the actor's effective membership, active organization, entity ownership, current capability, and revision/lifecycle. A sidebar tenant selection alone is insufficient authorization. Exported records are filtered with the same scope as visible records; CSV cells beginning with formula-triggering characters are escaped.

Only an Owner or explicit Boss override may modify Admin memberships. Generic User edit paths cannot change a membership's role to Admin/Owner. Removal/suspension/demotion of the last active Owner fails until a valid ownership transfer creates another active Owner. Transfers and privileged changes create audit events.

Organization suspension, membership suspension, assignment removal, and device suspension revoke affected simulated sessions/grants and stop motion. They cannot leave an old lease usable. A public session token authorizes only the stated access window and participant capabilities; it never grants driving by possession alone.

## Control policy

Each grant binds organization, robot, session, operator, lease ID, expiry, ownership generation, and allowed capabilities. A central transactional authority allows one current driving operator per robot. Authorized viewers may share a session without receiving control. Every command rechecks permission, active lease, lifecycle, freshness, session, generation, sequence, and simulator fault/stop state.

Stops do not require a data-deletion confirmation. Simulated emergency stop is latched until an authorized reset. Reset clears the latch but does not start motion. Real hardware needs a separately validated physical safety architecture.
