# Remaining work

1. Run the full browser matrix in Firefox and WebKit and at 1920×1080, 1440×900, and 768×1024; perform visual/accessibility review and retain screenshots.
2. Expand negative tests for simultaneous submissions, malformed IndexedDB data, invitation revocation/expiry/reuse, suspended members, and storage unavailable paths.
3. Run a dependency advisory audit when the registry is reachable; review findings before changing the lockfile.
4. Repeat verification with the repository-required Node 24 LTS and npm 11.21.0. This environment supplied Node 26.5.1 and npm 11.17.0; no global toolchain changes were made.
5. Production authentication, shared invitations, server tenant controls, real media and robot hardware require separate architecture and safety work. Do not treat browser simulation as hardware validation.
