# Hardware and safety boundaries

This package never opens a COM port or sends commands to an ESP32, motor driver, or physical robot. The permanent UI indicator states: **DEMO MODE — Simulated robot; no physical hardware connected.** Simulation tests provide no certification or evidence of readiness to operate around people.

## Required production separation

Web dashboards → authenticated cloud API/realtime/media services → separate Surface Robot Agent and public kiosk → USB serial → ESP32 → correctly rated motor driver → two DC motors.

The Surface agent handles authenticated connectivity and device identity, local cache, serial I/O, health, process startup/recovery, signed updates, and independently designed safety supervision. Public kiosk rendering and privileged control are separate trust boundaries. Any loopback/IPC bridge requires origin restrictions, authentication, authorization, and bounded commands. An unauthenticated motor-control endpoint is unacceptable.

The ESP32 handles PWM/direction via a rated driver, encoders when installed, closed-loop speed control when supported, independent watchdog, sequence/deadline validation, safe startup, fault handling, and telemetry. USB-to-UART and native USB depend on the exact board. USB and TTL UART are electrically different interfaces.

## Future serial contract

Use a versioned bounded envelope containing message type, device/session/lease identity where relevant, sequence, issue/deadline/freshness information, length, and payload. Message families are `HELLO`, `HEARTBEAT`, `CMD_VEL`, `STOP`, `ESTOP`, `STATUS`, `ACK`, and `FAULT`. Negotiate protocol/capabilities at startup; unknown version/length/type fails closed. Use explicit acknowledgements, bounded frames, parser resynchronization, duplicate/out-of-order rejection, disconnect timeouts, and latched fault/stop states. A future binary framing format needs a specified CRC and corruption tests.

End-to-end freshness must survive each bridge: receiving an old command must not reset its TTL and make it new. Document clock synchronization or monotonic time translation assumptions and validate the original deadline. Watchdogs must live in the agent/device, independently of the browser/cloud. No buffered motion is replayed after reconnect. Safe boot, disconnect, restart, update, and communication loss require zero output and new explicit authorization/input before motion.

## Simulation geometry

The differential-drive simulator uses `vLeft = v − omega × trackWidth / 2` and `vRight = v + omega × trackWidth / 2` with bounded integration time steps and explicitly simulation-only geometry. Wheel angular velocity requires a documented radius. Example speed limits and watchdog values are demo settings, not validated safe limits for a real robot. No actual board pins, motor currents, gearing, wheel dimensions, encoder resolution, braking behavior, or certified stopping distance have been inferred.

## Missing prerequisites

- Rated motor driver, verified motor/battery specifications, power protection, charging and battery monitoring.
- Physical emergency-stop circuitry and hazard assessment independent of internet/cloud/web availability.
- Encoders, bumpers/obstacle sensors, localization sensors, and calibrated odometry as required.
- Wiring, electrical/interface verification, watchdog/disconnect/fault tests, stopping-distance characterization, braking behavior, and controlled physical validation.
- Secure device provisioning, credential rotation/revocation, signed agent/firmware updates, rollback, release integrity, and recovery procedures.

The software emergency-stop button only latches a simulation. Real stop architecture needs risk assessment, fail-safe circuits, hardware validation, and jurisdiction/application-specific review. Browser timers, unload callbacks, and visual acknowledgements cannot replace those safeguards.

## Real navigation prerequisites

Uploading a floor-plan image does not establish localization or obstacle avoidance. Production navigation needs calibrated geometry, odometry, coordinate frames, localization, obstacle sensing, path planning, dynamic safety constraints, and possibly ROS 2/Nav2. Multi-floor/elevator use and charging-dock return need separate integrations and site validation. Demonstration routes are not collision-free guarantees. Autonomous movement is outside the validated demo.
