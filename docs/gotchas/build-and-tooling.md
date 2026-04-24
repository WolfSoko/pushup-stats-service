# Gotchas: Build & Tooling

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
