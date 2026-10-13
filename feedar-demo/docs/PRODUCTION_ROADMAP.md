# Production roadmap

All hardware/cloud items below require backend/hardware integration. Their presence in a simulated screen or setting does not mean the external capability is implemented.

## Deployable public demonstration

Local organization/member/invitation operations, robot inventory, maps, knowledge, chat, sessions, control simulator, kiosk, diagnostics, update history, and release scenarios demonstrate workflows. Browser permission-dependent preview/fullscreen stays local. Production secrets, accounts, email, signaling, hardware, and AI inference are absent.

## Foundation before production access

Secure identity and MFA; server-side tenant/resource enforcement and database/RLS policies; transactional invitation redemption and real email; authoritative control leases; authenticated device provisioning; secure media signaling/tokens and STUN/TURN; scoped storage and retention; abuse/rate controls; secrets management; observability; incident response; privacy/legal review; accessibility and operational testing. Replace browser audits with server-managed evidence and appropriate integrity/retention controls.

## Capability roadmap and prerequisites

- **Signed agent/firmware OTA with rollback:** demo update state/history; needs signed manifests/artifacts, device verification, staged rollout, rollback health policy, and interruption tests.
- **Maintenance and battery analytics:** demo schedules/alerts/diagnostics; needs calibrated measurements, storage, charging integration, and validated battery models.
- **Map version approval:** local map version/publication workflow; needs server object/revision policy, approval roles, deployment provenance, and real coordinate calibration.
- **Multilingual AI and human handover:** English/Persian/Turkish local assistant/knowledge and help tools; needs tenant-scoped retrieval, real inference/speech, evaluation, consent, and staffed handover.
- **Autonomous SLAM/navigation:** only simulated routes/missions; needs sensors, odometry, localization, obstacle sensing, planning, ROS 2/Nav2 as appropriate, and physical validation.
- **Multi-robot mission allocation and fleet coordination:** demo per-robot missions/state; needs authoritative fleet planner, congestion/reservation policy, navigation integration, and failure recovery.
- **Charging-dock return:** demo dock/battery states; needs docking hardware/sensing, charge safety, navigation and reliable dock detection.
- **Multi-branch control:** local branches/floors/tenant views; needs network/device deployment, scoped operational policy, location authorization, and site commissioning.
- **Predictive maintenance:** simulated diagnostics/alerts; needs long-term quality sensor data, model validation, false-alert policy, and reviewed maintenance actions.
- **Digital twin:** local kinematic simulation; needs measured robot/scene geometry, calibrated dynamics, sensor synchronization, and validation. It is not a physical digital twin today.
- **Utilization reports:** local record counts/history/export; needs durable trusted telemetry, retention, timezone definitions, and tested aggregation.
- **Crowd/queue management:** external roadmap only; needs sensing, privacy review, site algorithms, operational limits, and independent assessment.
- **Privacy masking and configurable retention:** settings/workflow demonstration where exposed; needs actual media processing, data lifecycle enforcement, consent controls, and verification.

No advanced roadmap work blocks completion of the core static demo. A future unconfigured integration must display unavailable rather than report success.
