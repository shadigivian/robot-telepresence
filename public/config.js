// Connection settings shared by both apps. Both laptops must use the same values.
//
// The robot and the user can be on completely different networks
// (home Wi-Fi, phone hotspot, office...). Each laptop runs its own copy of
// this app; they find each other through a public matchmaking server using
// the robot's serial number, then connect directly or through a relay.

const CONFIG = {
  // Shared backend. Empty = same origin (npm start). GitHub Pages requires
  // an HTTPS backend here, with its Pages origin in ALLOWED_ORIGINS.
  apiBase: '',
  // Matchmaking ("signaling") server. Empty = the free public PeerJS cloud
  // (0.peerjs.com). To use your own, run `npx peer --port 9000` on a public
  // machine and set e.g. { host: 'my-server.com', port: 443, path: '/', secure: true }.
  peerServer: {},

  // Address of the user page used in invite links. Empty = the automatic
  // public link created by start-robot.bat (changes each time it starts).
  // If you host public/ permanently (GitHub Pages, Netlify...), put the full
  // address of user.html here, e.g. 'https://you.github.io/robot/user.html'.
  publicUserPage: '',

  // Prefix added to every serial number so our robots don't collide with
  // other apps on the shared public server.
  idPrefix: 'rtp-robot-v1-',

  // STUN lets the two laptops find a direct path through their routers.
  // This works on most home and office networks.
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],

  // Legacy public TURN settings. Prefer server-side TURN_CREDENTIALS_URL or
  // TURN_SERVERS; /api/ice returns relays only to authenticated clients.
  // Do not publish provider API keys in this file.
  turnCredentialsUrl: '',

  // Or list TURN servers directly instead, for example:
  // { urls: 'turn:relay.example.com:443?transport=tcp', username: '...', credential: '...' }
  turnServers: [],

  // true = always go through the relay (for testing that the relay works)
  relayOnly: false,
};
