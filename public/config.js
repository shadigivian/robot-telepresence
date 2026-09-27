// Connection settings shared by both apps. Both laptops must use the same values.
//
// The robot and the user can be on completely different networks
// (home Wi-Fi, phone hotspot, office...). Each laptop runs its own copy of
// this app; they find each other through a public matchmaking server using
// the robot's serial number, then connect directly or through a relay.

const CONFIG = {
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

  // RELAY (TURN) SERVER: needed when no direct path exists, which is typical
  // for phone hotspots, mobile data and strict firewalls. Video then flows
  // through the relay.
  //
  // Easiest setup (free tier, about 5 minutes):
  //   1. Sign up at https://www.metered.ca/stun-turn
  //   2. Create a TURN credential in the dashboard.
  //   3. Copy the "API URL" that returns the ICE servers. It looks like
  //      https://YOUR-APP.metered.live/api/v1/turn/credentials?apiKey=XXXX
  //   4. Paste it below, on BOTH laptops.
  turnCredentialsUrl: '',

  // Or list TURN servers directly instead, for example:
  // { urls: 'turn:relay.example.com:443?transport=tcp', username: '...', credential: '...' }
  turnServers: [],

  // true = always go through the relay (for testing that the relay works)
  relayOnly: false,
};
