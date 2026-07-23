# Gotchas: Build & Tooling

## App Hosting prerender: worker cap + patched per-route timeout

The App Hosting production build prerenders ~2400 routes (9 locales,
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

Defenses for the case the cache misses, locked in by
`tools/src/prerender-timeout-patch-guard.spec.js`:

1. **`NG_BUILD_MAX_WORKERS=2`** as a BUILD-time env var in `apphosting.yaml`
   and `apphosting.staging.yaml` — the primary fix; keeps peak memory inside
   the machine. (`@angular/build` defaults to `min(4, cores - 1)` workers.)
2. **`patches/@angular__build.patch`** (registered in `pnpm-workspace.yaml`
   under `patchedDependencies`) raises the hard-coded 30 s per-route
   `AbortSignal.timeout` in `render-worker.js` / `routes-extractor-worker.js`
   to 300 s as headroom — upstream has no config option for it (verified up to
   22.1.0-next). After an Angular upgrade, refresh it instead of deleting it:
   `pnpm patch @angular/build` prints an edit directory — re-apply the same
   one-line change in both worker files there, then run
   `pnpm patch-commit <edit-dir>`. Delete patch, guard test, and this section
   together only once upstream makes the timeout configurable.

## Cloud Functions deploy: pruned lockfile carries an irrelevant patch entry

`@nx/esbuild`'s `generatePackageJson` (used by `cloud-functions:build`) prunes
a subset `package.json` + `pnpm-lock.yaml` into `data-store/functions-dist`,
but copies the workspace's `patchedDependencies` block from the root
`pnpm-lock.yaml` verbatim — even though `@angular/build` (patched for the
prerender timeout above) isn't a dependency of the functions codebase at all.
Firebase's Cloud Build then runs its own `pnpm install --frozen-lockfile`
against the generated `package.json` (which has no matching
`pnpm.patchedDependencies` field), and pnpm rejects the mismatch with
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.

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
