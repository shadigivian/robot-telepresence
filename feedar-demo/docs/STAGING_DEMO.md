# Protected staging demo

The static Feedar package has no production identity service. Its staging mode runs the existing browser-local simulator behind a **server-side access gate**. Do not publish a staging bundle through a public static host or Vite preview.

## Build and host separation

Use separate staging origins, for example `https://staging-boss.example.com` and `https://staging-app.example.com`. Both origins must be present and different in the same build:

```sh
VITE_STAGING_DEMO=true \
VITE_BOSS_ORIGIN=https://staging-boss.example.com \
VITE_APP_ORIGIN=https://staging-app.example.com \
npm run build
```

Serve this build only behind VPN, an IP allowlist, or independent server authentication. `VITE_STAGING_DEMO` is a build selector, **not an access control**. The gate must cover HTML, JS, CSS and all other assets on both origins. The included `scripts/serve-staging.mjs` is a loopback-only static server with HTTP Basic Auth for local verification or use behind a TLS reverse proxy. It refuses to start without a separate gate username and a password of at least 16 characters. Give each staging origin its own gate credential in deployment. Configure TLS and network restrictions at the reverse proxy; never expose this loopback service directly over plain HTTP to the internet.

Example reverse proxy policy for each staging hostname (replace the address and TLS configuration):

```nginx
location / {
    allow 203.0.113.10;
    deny all;
    proxy_pass http://127.0.0.1:4183;
    proxy_set_header Host $host;
}
```

Use port 4184 for the App staging origin. The server's Basic Auth still applies after the IP rule. Do not commit real gate credentials, an htpasswd file or private URLs. Check unauthenticated requests to both `/` and an asset return 401/403 from outside the gate before inviting testers.

For local build verification, set the two origins to `http://127.0.0.1:4183` and `http://127.0.0.1:4184`, build with `VITE_STAGING_DEMO=true`, then run `STAGING_PORT=4183 node scripts/serve-staging.mjs` and `STAGING_PORT=4184 node scripts/serve-staging.mjs` in separate shells. Set `STAGING_GATE_USERNAME` and `STAGING_GATE_PASSWORD` in each shell without writing them to source files. With the same test gate credentials, run `PLAYWRIGHT_CHANNEL=chrome node scripts/verify-staging.mjs`. The verifier checks that HTML and JS require the gate and exercises all four fixture roles. Use different gate credentials per origin in a real deployment; the local verifier uses one credential only to simplify repeatable testing.

## Behavior and limits

The Boss form accepts only the existing Boss fixture; the App form accepts existing Owner, Admin and User fixtures. The demo password is `123456`; the demo verification code is also `123456`. The form determines role from the stored account, with no role selector or quick-login controls. Refresh restores the browser's tab-scoped session. Logout clears it. A mismatched account is rejected on the opposite origin.

These checks demonstrate frontend routing, not secure user authentication or tenant authorization. Browser storage and JavaScript fixtures can be edited by anyone who passes the server gate. Boss and App have separate IndexedDB stores because they are different origins. Tickets, robot sessions, credits and other data do not synchronize between them. A cross-origin Boss transfer remains unavailable; do not mimic one with URL tokens or browser storage. A shared backend is required for real identity, permission enforcement and shared data.

For a public build, leave `VITE_STAGING_DEMO=false` (or unset it), build again and deploy that output. Public builds show the separate Boss/App forms but reject demo sign-in. Never copy the staging `dist/` into the public deployment. No DNS, TLS, VPS or real online staging access was configured in this repository task; the verification used two local origins and a protected server matching the deployment boundary.
