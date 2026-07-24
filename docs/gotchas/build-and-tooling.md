# Gotchas: Build & Tooling

## App Hosting prerender: worker cap, and keep the prerender list SEO-only

The App Hosting production build prerenders ~970 routes (9 locales,
`sourceMap: true`) on a builder with ~8 GB RAM. The main build process needs
the 6 GB heap from `NODE_OPTIONS`, and each prerender worker thread adds its
own V8 isolate on top — with the default 4 workers the machine thrashes into
memory-pressure stalls late in the build, where a single route can hang for
**minutes** (observed > 120 s). One hung route aborts the **entire** build:
the log shows one `AbortError ... TimeoutError`, then a cascade of
`Error: Terminating worker thread` on every other in-flight route (those are
collateral, not root causes). The same build takes ~3 minutes on GitHub's
16 GB runners — the workload only fails on the memory-starved builder.

Even with the worker cap, the builder remains marginal: after "Application
bundle generation complete" the Node process can stall for 10+ minutes in the
finalization phase (writing the multi-locale dist, final GC near the 6 GB heap
cap), at which point the resident esbuild Go service panics with
`fatal error: all goroutines are asleep - deadlock!` and fails the build. The
structural fix is to not build there at all — the App Hosting rollout restores
`web:build:production` from the Nx Cloud remote cache seeded by CI (see
[`docs/ci-cd.md`](../ci-cd.md) → "App Hosting Build Cache Reuse").

Defenses for the case the cache misses:

1. **`NG_BUILD_MAX_WORKERS=2`** as a BUILD-time env var in `apphosting.yaml`
   and `apphosting.staging.yaml` — keeps peak memory inside the machine.
   (`@angular/build` defaults to `min(4, cores - 1)` workers.)
2. **Keep `app.routes.server.ts`'s `RenderMode.Prerender` list limited to
   routes that actually matter for SEO** (i.e. routes in `sitemap.xml` —
   see [`docs/consent-ads-seo.md`](../consent-ads-seo.md)). Every
   `getPrerenderParams()`-driven route multiplies by 9 locales, so a single
   large catalog can add thousands of routes. The wiki detail pages
   (`wiki/liegestuetz-typen/:slug`, `wiki/uebungen/:slug`) used to do exactly
   this — ~155 catalog entries × 9 locales ≈ 1400 routes — despite being
   `noindex` and excluded from the sitemap (thin content, see
   `docs/consent-ads-seo.md`). They were moved to `RenderMode.Server`
   instead, cutting the prerendered total by more than half; the CDN cache
   in `web/src/server-ssr-cache.ts` keeps the resulting per-request
   rendering cheap for those catalog-driven (not per-request) pages. If a
   catalog-backed route grows large again, prefer `RenderMode.Server` +
   a cache-path entry over adding it to the prerender list, unless the
   route is genuinely sitemap-worthy.
3. **`@angular/build` hard-codes a 30 s per-route `AbortSignal.timeout`** in
   `render-worker.js` / `routes-extractor-worker.js` with no config option
   (verified up to 22.1.0-next). This repo does not currently patch it —
   the worker cap and the reduced route count above have kept individual
   routes well under 30 s. If a future prerendered route is legitimately
   slow (e.g. a heavy data fetch in `getPrerenderParams`), patch it via
   `pnpm patch @angular/build` (raise the timeout in both worker files,
   `pnpm patch-commit <edit-dir>`) rather than working around it another
   way — re-add a guard test alongside the patch so an Angular upgrade
   can't silently drop it.

## Cloud Functions deploy: pruned lockfile can carry an irrelevant patch entry

`@nx/esbuild`'s `generatePackageJson` (used by `cloud-functions:build`) prunes
a subset `package.json` + `pnpm-lock.yaml` into `data-store/functions-dist`,
but copies the workspace's `patchedDependencies` block from the root
`pnpm-lock.yaml` verbatim — even if the patched package (e.g. a previous
`@angular/build` patch, since removed) isn't a dependency of the functions
codebase at all. Firebase's Cloud Build then runs its own
`pnpm install --frozen-lockfile` against the generated `package.json` (which
has no matching `pnpm.patchedDependencies` field), and pnpm rejects the
mismatch with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. The workspace currently
has no patches, so this is latent — the defense below stays in place for
whenever one gets added back (see point 3 above).

This only bites when Cloud Build actually rebuilds a function — an
unchanged-hash deploy is skipped entirely, so the bug can sit latent for a
long time (it first surfaced only when a brand-new function was deployed,
well after the `@angular/build` patch had been added). The fix is a
`predeploy` hook in `data-store/firebase.json` (`functions.predeploy`) that
runs `tools/src/strip-unused-lockfile-patches.mjs` against the generated
lockfile before Firebase packages it — it removes the `patchedDependencies`
block only when none of its packages actually appear in the lockfile's
`packages:` section, via a targeted text splice (not a full YAML
parse/stringify round-trip, which would reformat the entire 2000+ line file).
If a genuinely-used patch and an unused one are ever mixed in the same
lockfile, the script bails out with a warning instead of guessing.

## Cloud Functions deploy: pruned directory has no `allowBuilds` allowlist

Same root cause as the patch entry above (`data-store/functions-dist` is a
standalone pruned directory, not a member of the root pnpm workspace), but a
different symptom: pnpm 11 hard-fails `pnpm install` with
`[ERR_PNPM_IGNORED_BUILDS]` for any resolved dependency that has an
install/postinstall script and isn't allowlisted (observed:
`@firebase/util`, `protobufjs`) — exit code 1, not just a warning. The root
`pnpm-workspace.yaml`'s `allowBuilds` map never reaches Cloud Build's
`pnpm install` because that directory has no `pnpm-workspace.yaml` of its
own, and — verified against pnpm 11.17.0 — pnpm does **not** honor an
equivalent `pnpm.allowBuilds` / `pnpm.onlyBuiltDependencies` field placed
directly in `package.json` for a single-package (non-workspace) directory;
`allowBuilds` is read from `pnpm-workspace.yaml` only.

Fixed the same way as the patch entry: a `predeploy` hook
(`tools/src/write-functions-workspace-allowbuilds.mjs`) writes a minimal
`pnpm-workspace.yaml` into `functions-dist` before Firebase packages it,
containing only the root's `allowBuilds` entries that actually resolve in
the pruned lockfile (so it can't drift from the root config or over-grant).
Reproduce/verify locally without waiting on a full deploy:

```bash
pnpm nx run cloud-functions:build
cp -r data-store/functions-dist /tmp/fd-test
node tools/src/strip-unused-lockfile-patches.mjs /tmp/fd-test/pnpm-lock.yaml
node tools/src/write-functions-workspace-allowbuilds.mjs /tmp/fd-test/pnpm-lock.yaml pnpm-workspace.yaml
(cd /tmp/fd-test && pnpm install --frozen-lockfile)  # must exit 0
```

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

CI uses `corepack enable` to pick up the exact pnpm pinned in `package.json`'s `packageManager` field (currently pnpm 11.x) instead of `pnpm/action-setup@v6`, which resolves its own version independently and can drift from the pin. See `pnpm/action-setup#228`. (pnpm 11's lockfile can be a multi-document YAML file; Nx 23+ parses that fine — the risk `action-setup` posed was picking a version this repo hadn't validated yet, not the format itself.)

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
