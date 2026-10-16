# Robot and control safety

Feedar `src/simulator/controller.ts`, `src/services/demo/service.ts` and `src/features/session.tsx` implement fictional telemetry and exclusive leases. Unit tests cover approval, sequence/replay rejection, expiration, stop/revoke and suspension; Chrome tests cover hold/release, focus loss, revocation and media-denial cleanup. These are software-simulation results only.

Legacy `public/robot.js:44-59` stops on revoked lease, disconnect and expiry; `:472-513` checks gate, board readiness, connected media, and JS watchdog; `:677-746` prioritizes serial stop and monitors board reply. `public/safety.js` validates command envelopes. Uno sketch `arduino/robot_controller_uno/robot_controller_uno.ino:13-14,129-135` documents and implements a 500 ms command watchdog; ESP32 sketch was statically inspected. Local browser WebRTC test passed with fake media and mocked Web Serial. No current test establishes physical stopping distance, relay behavior, fault tolerance or emergency-stop certification.

Before connecting physical hardware: perform independent electrical E-stop, bounded-speed and watchdog timing tests under controlled conditions; record stop latency under browser crash, OS sleep, network loss, serial unplug and power interruption. Keep the public Feedar package disconnected from these paths.
