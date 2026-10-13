# Service and API contracts

The running providers are local browser implementations. This document describes a future backend, not endpoints hosted by GitHub Pages. Unconfigured external providers must return explicit unavailable errors and fail closed.

## Models

Domain types include User, Organization, Membership, Permission, Invitation, Location, Floor, Map, MapPoint, Robot, DeviceIdentity, RobotAssignment, Session, ControlGrant, Call, CallParticipant, Conversation, Message, Telemetry, RobotCommand, Mission, Incident, AuditLog, Release, KnowledgeSource, and SupportTicket. Applicable records carry stable IDs, organization ownership, timestamps, lifecycle status, and revision/schema version. References must resolve within the same organization. Streams, passwords, and genuine credentials are excluded from serialized demo records.

Invitation records include organization, role, invitee, inviter, optional assignments/capabilities, creation/expiry, status, and redemption/revocation metadata. Session invitations add robot, participant eligibility, access window, and video/chat/screen-share/control-request permissions. URLs contain opaque record tokens, not trusted role/tenant attributes.

Control envelopes contain protocol version, organization/robot/session/operator identifiers, lease ID and generation, monotonic sequence, linear velocity (m/s), angular velocity (rad/s), issue time, deadline, and TTL. Bounds, non-finite values, malformed IDs, stale/wrong sessions, duplicate/out-of-order sequence, and unauthorized leases are rejected. Future clock assumptions must preserve end-to-end freshness across bridges.

## Provider families

Typed replaceable interfaces cover Auth, Organization, Invitation, Robot, Session, Control, Chat, Media, Map, Knowledge, AI, Audit, and Update. Real media requires authenticated signaling, scoped room tokens minted by a backend, STUN/TURN, reconnect/backoff, and participant join/leave/track lifecycle. Server secrets never enter frontend environment variables.

## Future endpoint families

- `POST /auth/login`, `/auth/mfa/verify`, `/auth/password-reset`; `GET /auth/session`; `POST /auth/logout`: secure cookies/session expiry, identity verification, rate limits, and real MFA.
- `/organizations`, `/organizations/:id/memberships`, `/quotas`, `/settings`, `/branches`: server tenant enforcement, last-Owner transaction, quota and capability checks.
- `/invitations`, `/invitations/:token/preview`, `/redeem`, `/revoke`: signed/opaque tokens, recipient binding, expiry, one-time transactional redemption, idempotent retries, real email integration.
- `/robots`, `/robots/:id/status`, `/settings`, `/assignments`; `/devices/pair`, `/rotate`, `/revoke`: device identity, scope, challenge expiry, credential lifecycle, attestation where available.
- `/sessions`, `/sessions/:id/participants`, `/media-token`, `/end`: participant eligibility and access window, scoped media room authorization.
- `/control/request`, `/approve`, `/revoke`, `/release`, `/commands`, `/stop`, `/estop`, `/reset`: exclusive authoritative leases, generation/freshness/sequence validation, watchdog integration and audited safety transitions.
- `/maps`, `/floors`, `/points`, `/missions`: validated images, object access policy, revisions/approval, calibrated coordinate metadata and authorized mission lifecycle.
- `/knowledge`, `/publish`, `/ai/query`, `/ai/tools`: tenant retrieval, ingestion status, prompt/data isolation, safe tool policy and human handover.
- `/conversations`, `/messages`, `/support-tickets`, `/incidents`, `/audits`, `/releases`, `/updates`: scope, retention, safe exports, sanitized summaries, signed artifacts and rollback status.

Every request must validate identity, role/capability, organization, resource ownership/lifecycle, payload schema, size limits, and concurrency revision. Writes use idempotency keys; control commands additionally use lease generation and sequence. Rate limits are scoped to identity, tenant, and device; read and write audit/event data must follow tenant authorization. Permission failures are explicit and must not fall back to public success.

## Future realtime events

Events include `robot.online`, `robot.offline`, `robot.telemetry`, `robot.fault`, `robot.location`, `session.started`, `session.ended`, `control.requested`, `control.granted`, `control.revoked`, `message.created`, `call.started`, `call.ended`, `invitation.accepted`, and `update.status`. Envelopes carry version, event ID, tenant/entity IDs, timestamp, revision/sequence, and sanitized payload. Authorize each subscription server-side, validate every payload, bound message size/rate, deduplicate retries, reconcile missed revisions, and revoke subscriptions when membership or access changes. The demo's BroadcastChannel messages synchronize only same-origin local records.
