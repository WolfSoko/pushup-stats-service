# Gotchas: Build & Tooling

## Prerender per-route timeout is patched (30 s → 120 s)

`@angular/build` hard-codes `AbortSignal.timeout(30_000)` per prerendered route
(`src/utils/server-rendering/render-worker.js` and
`routes-extractor-worker.js`) with no configuration option (verified up to
22.1.0-next). The App Hosting production build prerenders ~2400 routes
(9 locales, `sourceMap: true`) close to the 6 GB heap ceiling — a single GC
pause or slow route past 30 s aborts the **entire** ~30-minute build: the log
shows one `AbortError ... TimeoutError` on the first route, then a cascade of
`Error: Terminating worker thread` on every other in-flight route (those are
collateral, not root causes).

The pnpm patch `patches/@angular__build.patch` (registered in
`pnpm-workspace.yaml` under `patchedDependencies`) raises the budget to 120 s.
`tools/src/prerender-timeout-patch-guard.spec.js` fails CI if the patch is
dropped or stops applying. After an Angular upgrade, refresh it with
`pnpm patch @angular/build` + `pnpm patch-commit` (re-apply the same one-line
change in both worker files) instead of deleting it — or delete patch, guard
test, and this section together once upstream makes the timeout configurable.

## Transient build flakes

**`Inlining of fonts failed ... fonts.googleapis.com/icon?family=Material+Icons`** is a network flake during `web:build`, **not a code bug**. Retry `pnpm nx run web:build -c production` after a few seconds.

## One-shot node scripts without a CLI bin

`pnpm dlx` fails with `ERR_PNPM_DLX_NO_BIN` for packages that only expose a library API (e.g. `sharp`, `png-to-ico`). Install transiently in a scratch dir and point `NODE_PATH` at it:

```bash
mkdir /tmp/x && (cd /tmp/x && npm init -y > /dev/null && npm i --silent <pkgs>) \
  && NODE_PATH=/tmp/x/node_modules node script.js
```

See `tools/src/generate-logo-assets.js` for a real example.

## pnpm via corepack, not `pnpm/action-setup`

CI uses `corepack enable` to pick up the exact pnpm pinned in `package.json`'s `packageManager` field. Avoid `pnpm/action-setup@v6` — it can pull pnpm v11 RC, which rewrites `pnpm-lock.yaml` into a dual-YAML-document form that Nx cannot parse. See `pnpm/action-setup#228`.

## Nx Cloud dynamic agent allocation

CI uses `.nx/workflows/distribution-config.yaml` to pick an agent pool size based on the percentage of projects affected (4/6/8/10 `linux-medium-js` agents for small/medium/large/xl changesets). Referenced from `.github/workflows/ci.yml`:

```yaml
pnpm nx-cloud start-ci-run --distribute-on=".nx/workflows/distribution-config.yaml" --stop-agents-after="e2e-ci"
```

To scale further (bigger agents for e2e specifically, or higher ceilings), edit the YAML — the CI workflow doesn't need to change.

## Generated `*.generated.ts` files rewrite on `nx build web`

`pnpm nx build web` runs the `generate-content` target first, which rewrites the build-time content files (`libs/stats/src/lib/models/*-content.generated.ts`) and the sitemap from `content/**`. After a local build your working tree may show a large diff in those files — a stale committed copy or a non-deterministic generation order, **not** part of your change. Revert it (`git checkout -- libs/stats/src/lib/models/exercise-wiki-content.generated.ts`) instead of committing the churn; CI regenerates them from the committed sources. Never hand-edit a file whose header says `AUTO-GENERATED`.

## Angular SSR `NG_ALLOWED_HOSTS` must include `*.run.app`

Angular SSR (`@angular/ssr` v19+) rejects requests whose `Host` header isn't in `NG_ALLOWED_HOSTS` as an SSRF guard. Firebase App Hosting forwards traffic through Cloud Run, so during rolling deploys traffic-tag URLs like `t-<id>---<service>-<hash>-<region>.a.run.app` reach the SSR with that internal hostname — Angular returns `400: Header "host" with value "..." is not allowed`, and the affected page (most visibly `/u/:uid`, which is `RenderMode.Server`) refuses to render.

Fix: include `*.run.app` in the comma-separated `NG_ALLOWED_HOSTS` value in **both** `apphosting.yaml` and `apphosting.staging.yaml`.

**Angular's wildcard syntax requires the `*.` prefix specifically** — `isHostAllowed` in `@angular/ssr` only treats entries that start with `*.` as wildcards (it does `allowedHost.startsWith('*.')` then `hostname.endsWith(allowedHost.slice(1))`). A bare leading dot like `.run.app` is matched literally and silently fails to cover the revision URLs.

`*.run.app` is broad but acceptable: the SSR doesn't make outgoing requests based on the `Host` header — canonical / `og:url` come from a hardcoded `BASE_URL` in `SeoService` — so the SSRF risk reduces to "an attacker-controlled `*.run.app` host renders our public HTML on their domain", which doesn't expose any private state.
