# Local setup and GitHub Pages

Feedar builds to static files in `feedar-demo/dist/`. GitHub Pages runs no Node server, API route, Docker container, or database. Hash routing preserves nested views without server rewrites. [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) describes the hosting boundary.

## Local setup

Use Node 24 LTS, npm 11.21.0, and the committed npm lockfile. After installing Node 24, use `npm install --global npm@11.21.0` if needed:

```powershell
cd feedar-demo
npm ci
npm run dev
```

Run typecheck/lint/unit/browser checks and build before publishing:

```powershell
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Preview serves the compiled output locally; it is not a production server. This behavior follows [Vite's official static deployment guide](https://vite.dev/guide/static-deploy).

## Base path

`VITE_BASE_PATH` configures the Vite asset base at build time. A repository project site needs `/<repository-name>/`. A root user/organization site or custom domain normally uses `/`. Hash paths stay after that base, and generated public/invitation links derive from the actual URL rather than a hardcoded GitHub account or domain. [Vite's base-path guidance](https://vite.dev/guide/static-deploy#github-pages) covers these differences.

PowerShell project-site build (replace the example with the intended repository slug):

```powershell
$env:VITE_BASE_PATH = '/your-repository/'
npm run build
npm run preview
```

Root/custom-domain build:

```powershell
$env:VITE_BASE_PATH = '/'
npm run build
```

Shell equivalent:

```sh
VITE_BASE_PATH=/your-repository/ npm run build
```

Do not place secrets in `VITE_*`: those values become public frontend build data. `.env.example` contains only a public base setting. The demo requires no API key.

## Reviewable publishing steps

No hosting or push is authorized by preparing these files. When you decide to publish:

1. Review the local change set and preserve unrelated existing work. Commit the Feedar package, lockfile, documentation, and separate CI/Pages workflows using your normal review process.
2. Check the workflow's default-branch filter matches the repository's configured default branch. CI runs on pull requests/relevant pushes; deployment runs only on its configured trusted branch or manual dispatch after checks.
3. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. This setup is documented in [GitHub's custom workflow instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
4. Push the reviewed change through your normal process or manually run the prepared deployment workflow after review. The build uploads only `feedar-demo/dist/` as a Pages artifact; deploy uses the `github-pages` environment, least-privilege permissions, and concurrency controls. Untrusted pull-request code is never deployed with privileged secrets.
5. Find the confirmed published URL in the deploy job's environment/output or Settings → Pages. A prepared workflow is not evidence of a live deployment.
6. Test welcome, login, a direct `/#/o/future-health` tour, the public kiosk, and generated links on the confirmed URL. A custom domain also requires your own DNS/domain setup and HTTPS verification; no domain purchase is performed here.

## Common errors

- Blank page or asset 404: the build base does not match the hosting path. Rebuild with the correct `VITE_BASE_PATH`; do not patch hashed filenames manually.
- Direct path 404: use hash URLs such as `/<base>/#/organizations`, not server routes such as `/organizations`.
- Pages workflow denied: verify Pages source, trusted branch, environment permissions, and repository plan/settings. Do not add frontend secrets as a workaround.
- Unknown invitation on another browser: expected local-demo limitation. Use the originating profile/origin or a seeded public tour; real shared invitations require a backend.
- Missing browser API: use a secure context (localhost/HTTPS) and a supported browser; permission denial should leave the rest of the demonstration working.
- Older Node fails: use the supported LTS runtime before `npm ci` and build; do not use the parent application's older toolchain for this isolated package.

Set the repository variable `FEEDAR_BASE_PATH` to `/` for a custom domain/root site; otherwise the Pages workflow derives the repository base. `npm run test:static` verifies both root and project-path static builds locally. The workflows pin npm 11.21.0 before clean installation.
