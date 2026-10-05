# Browser dependencies

`peerjs.min.js` is the checked-in **PeerJS 1.5.4** browser distribution, including its adapter.js compatibility shims. The version is embedded in the bundle. It is served locally rather than loaded from a CDN. Upstream project: https://github.com/peers/peerjs.

One narrow local guard is applied to adapter.js's Firefox `shimGetUserMedia` function (named `G` in this minified bundle). Before installing legacy media shims, it returns when `navigator`, `mediaDevices`, `getUserMedia`, or `getSupportedConstraints` is unavailable. The upstream shim otherwise dereferences the missing API during script initialization and prevents the bundle from exporting `Peer`.

The guard preserves the PeerJS export and normal media behavior. It does not provide missing camera/microphone APIs; the product's existing media fallback and movement locks handle unavailable features. No other bundled code is changed or reformatted. When replacing this dependency, verify that the upstream distribution handles this case before dropping the guard.

`npm run test:compat` checks unavailable media APIs and page bootstrap across Chromium, Firefox and WebKit with a fresh backend per engine. The product browser tests separately exercise actual local WebRTC media and safe motion control in Chromium/Edge.
