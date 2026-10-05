# Welcome + Telepresence Robot Platform

Two browser apps share one authenticated backend:

- **Robot Station** (`public/robot.html`): Welcome kiosk with room/person search, floor maps, accessible routes and staff notifications; or a Telepresence display with WebRTC audio/video and an Arduino Uno USB bridge.
- **Organization app**: `public/user.html` for operators/invited callers; `public/portal.html` for staff inboxes and administration. These are role-specific pages of the same app.

The Uno sketch and motor wiring are unchanged. Navigation is **manual**. Maps guide visitors; they do not localize the robot, detect obstacles or make it drive autonomously. PWM presets are motor power, not calibrated physical speed.

## Run locally

Use Node 22 LTS (minimum 18.18), Chrome or Edge on the robot laptop and the existing Uno sketch.

```powershell
npm ci
$env:ADMIN_USERNAME = 'admin'
$env:ADMIN_PASSWORD = Read-Host 'Choose an admin password (12+ characters)'
npm run setup
Remove-Item Env:ADMIN_PASSWORD
npm start
```

Open `http://localhost:3000/portal.html`. Setup installs **no default password** or site data. To explicitly load a fictional, labelled example, run `node scripts/setup.js --demo` instead of the first setup command. Setup refuses to overwrite an initialized database.

1. Add floors, nodes, route edges, rooms and people; save the directory.
2. Register the robot's stable ID/serial, mode and starting node.
3. Create a **robot** account scoped to that robot, **operator** accounts for drivers and **staff** accounts for recipients.
4. Edit each person and select their staff account to enable notifications. A room can notify one of its associated people.
5. On the robot laptop open `/robot.html`, sign in, start the camera, connect the Uno and go online. Press **نمایش عمومی** for kiosk/display mode. Reopening settings requires a robot or administrator password; local stop remains publicly available.
6. On the other laptop open `/user.html`, sign in, select a robot, check camera/microphone and start the call. After fresh video and board readiness, press **گرفتن کنترل**. Hold arrows/WASD to drive, release to stop.

An administrator can also sign in on the station and select a device. A scoped device session is issued; the kiosk does not retain administrator privileges. Public mode clears the current visitor's name/note/route after 90 seconds of inactivity or **شروع دوباره**. This does not delete a registered staff notification.

## Welcome directory and notifications

Native forms manage floors, nodes, edges, rooms and people; JSON import/export is also available. `examples/directory.json` documents the schema. Node coordinates are schematic percentages (0–100), grouped by floor. Edges contain metre distances, explicit forward/reverse directions, `accessible` and `bidirectional` flags. Route planning chooses shortest registered distance; accessible mode excludes non-accessible edges. Missing/disconnected routes produce an error, never an invented route.

Names, aliases and departments are searchable, including normalization of Arabic/Persian ی/ک and questions such as «اتاق مدیر کجاست؟». Multiple matches require selection. Inactive destinations are hidden. Hours/availability are curated public text. The start node is configured per robot; a device operator can update it after moving the robot. This is not live localization.

Optional Persian speech input uses SpeechRecognition with text fallback; read-aloud uses installed SpeechSynthesis voices. Recognition may use the browser provider's remote service. Availability and Persian voice quality depend on the browser/device.

Notification is explicit: **اطلاع بده که در راه هستم** sends the optional visitor name/note to the selected recipient. Route display does not depend on delivery. States are **registered → delivered → seen → responded**. Delivered means the staff browser received/rendered the entry, not that the person read it. Staff acknowledge or reply. The kiosk polls its own visit while displaying the route. Stable request IDs avoid duplicate notifications on retry. Staff inboxes recover persisted visits after being offline.

## Communications and control

```text
Robot browser <--- authenticated API / Socket.IO ---> shared backend + data
      ^                                                       ^
      | WebRTC audio/video + DataChannel                     |
      v                                                       |
Operator browser <--------------------------------------------+

Robot browser ---> Web Serial ---> Arduino Uno ---> motor driver
```

PeerJS/PeerServer handles WebRTC signaling. Socket.IO handles authenticated presence, session events, leases and notifications; it does not replace PeerServer. Video does not pass through Socket.IO. Backend authorization binds session secrets to caller peer IDs; incoming video also needs a one-use proof issued only to the authenticated robot. Use a trusted/self-hosted PeerServer for a controlled deployment; its settings remain in `public/config.js`.

Remote movement requires an authorized session, active lease, connected backend, ready Uno, connected video, recently decoded frames and a visible/focused operator tab. Simulation can inspect calls but does not enable remote motors.

- Lost video, board readiness, focus or backend connectivity releases control. Reconnection does not automatically restore driving.
- Robot-issued challenges expire after 450 ms on its monotonic clock. Sequence/lease IDs reject replayed or stale movement. Slow links may prevent driving even while video is viewable.
- Serial writes coalesce pending movement and prioritize stop; commands remain `F/B/L/R <0..255>`, `S`, `?`, at 115200 baud. Board readiness requires `READY robot_controller`.
- The Uno stops after 500 ms without a command. Browser checks supplement this; physical emergency-stop hardware and obstacle sensing remain separate installation requirements.
- Local test controls cannot compete with remote control and have no global keyboard binding. Local stop ends the remote session. The operator must reconnect.
- Frame freshness and command ping are separate. Ping is a data-channel round trip, not video or motor latency.

## Accounts and invitations

The station creates **single-use, 15-minute invitations**, with call-only or call-and-drive permission. Tokens are in the URL fragment and removed after redemption. Cancellation revokes outstanding invites and guest sessions. Serial-only links do not authorize motion. Guests are scoped to one robot and cannot administer the site or read staff inboxes.

Passwords use salted scrypt. Bearer sessions are tab-scoped in sessionStorage and expire after eight hours. Calls expire after one hour or earlier with their login. Password changes, disabling accounts, logout and server restart revoke associated sessions. Realtime handlers recheck authorization. Restart preserves users/directory/visits but intentionally drops logins, invites, calls and leases.

Closing an operator page sends best-effort session cleanup. A disconnected or abandoned operator reservation is freed after a 30-second reconnect grace period, even if the browser cannot send its final request.

## Deploy the shared backend

**GitHub Pages hosts the frontend only.** It cannot run Socket.IO, authenticate users or persist visits. Both laptops must use the **same backend**; independently running `npm start` on each creates independent sites.

Deploy on a Node host or build the Dockerfile. Mount a persistent private directory at `/app/data`, initialize it once with `npm run setup`, then start. Terminate TLS at the host/proxy and forward WebSocket upgrades for `/socket.io/`. Use one server process and one data volume. Keep data outside the public document root and back it up.

Set variables in the shell/host dashboard, or copy `.env.example` to a private `.env` in the repository root. `server.js` and `scripts/setup.js` load this file automatically, regardless of the current working directory. Existing shell/host variables take priority, including empty values. `.env` is ignored by Git and must remain private. The format supports `KEY=value`, blank lines, comments, and single/double quoted values; double quotes support `\n`, `\r`, `\t`, `\"` and `\\`. Values are never expanded or executed, and multiline values are unsupported.

- `PORT`: default 3000.
- `HOST`: default 127.0.0.1; use 0.0.0.0 on a managed host/container.
- `DATA_FILE`: default `data/site.json`, persisted across deploys.
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins, e.g. `https://shadigivian.github.io`, without repository path or trailing slash. No wildcard.
- `TURN_CREDENTIALS_URL`: provider endpoint including its API key, **server-side only**. Authenticated clients obtain ICE relays from `/api/ice`.
- `TURN_SERVERS`: alternative JSON list of relays; prefer short-lived credentials.

For Metered, set `TURN_CREDENTIALS_URL` to `https://YOUR_APP.metered.live/api/v1/turn/credentials?apiKey=YOUR_CREDENTIAL_API_KEY` in the private `.env` or hosting dashboard, replacing the placeholders with the credential API endpoint from your account. Restart the backend after changing it. The dashboard address itself is not the credential endpoint. This service provides ICE relays for WebRTC; it does not host the Node backend. Remove `ADMIN_PASSWORD` from `.env` after initial setup if you chose to store it there.

STUN is configured. TURN is required when networks cannot establish direct WebRTC, including many mobile/enterprise networks. No provider credentials are fabricated or committed. `relayOnly` tests configured TURN.

For same-origin hosting leave `CONFIG.apiBase` empty. For Pages set it to the shared backend's HTTPS origin, add the Pages origin to `ALLOWED_ORIGINS`, and set `publicUserPage` to the operator page. Then run `deploy-github.bat`: it requires a backend URL, publishes only `public/` and preserves `gh-pages` history. It does not deploy the backend. `start-robot.bat` can still create a temporary Cloudflare link; it changes on restart. All frontends must point to the same API.

The data store uses atomic replacement and fsync before announcing success. It supports a small **single-process** installation. Before scaling to multiple instances, migrate data to a transactional database and share sessions/leases. The private file contains password hashes and visitor information; never publish it to GitHub/Pages.

## Verify

```text
npm run check
npm test
npm run test:browser
```

Browser tests use installed Microsoft Edge on Windows. Elsewhere run `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. CI installs Chromium automatically.

Coverage includes Persian lookup, multi-floor/accessible/reverse routes, invalid directory rejection, role isolation, invitations, persisted idempotent visits, delivery/seen/reply, media proofs, lease expiry, stale commands, frame freshness, local stop and actual local WebRTC between two browsers. Serial is **simulated** in browser tests. Physical Uno/motors, internet NAT traversal, provider TURN and production hosting must be verified on the installation.

### Optional live TURN check

After configuring `TURN_CREDENTIALS_URL` or `TURN_SERVERS` privately, run `npm run test:turn`. This opt-in command reads the root `.env`, retrieves provider credentials server-side, and requires **relay candidates on both ends**. It checks a data-channel echo and decodes a short synthetic video; a direct connection cannot make it pass. It uses installed Edge by default, or installed Playwright Chromium with `PLAYWRIGHT_CHANNEL=chromium`.

This check contacts the actual provider and consumes a small amount of TURN quota. It is excluded from CI and ordinary tests. It times out after 30 seconds of connection testing, closes the browser and peer connections, and prints only credential counts and nonsecret transport/results; it does not save credentials, IP addresses or screenshots. Passing verifies the tested relay path from this laptop, not every destination network or long-running call quality.
