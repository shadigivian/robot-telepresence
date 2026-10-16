# DevOps and deployment review

Feedar `vite.config.ts`, `src/app/links.ts` and `scripts/verify-static.mjs` support a configured Vite base and hash navigation. Static checks passed at `/` and `/base-check/`, including assets, direct public route, refresh and generated tour link. Existing docs `docs/DEPLOYMENT.md` describe static hosting; legacy `Dockerfile`, `render.yaml`, `docs/hosting.md` and `.github/workflows/` target separate deployment modes. No workflow was activated and no VPS contacted.

Node 24 LTS/npm 11.21.0 are project targets; local Node 26.5.1/npm 11.17.0 were used because the target versions were unavailable. Builds passed with this mismatch, which does not prove reproducibility on the target. Both `npm ci` completed. `npm audit --json` showed zero registry advisories in both trees on the audit date.

Before production: pin/test the supported toolchain in CI, decide rollback for static assets, add cache policy for hashed assets versus `index.html`, health/monitoring and backup strategy. Keep the static Feedar demo free of legacy backend/device endpoints. These are deployment gaps, not evidence of a broken live deployment.
