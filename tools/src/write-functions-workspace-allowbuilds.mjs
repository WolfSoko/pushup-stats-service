#!/usr/bin/env node
/**
 * Writes a `pnpm-workspace.yaml` into a generated per-project directory
 * (e.g. `data-store/functions-dist`) carrying just the `allowBuilds`
 * entries its pruned dependency tree actually needs.
 *
 * `@nx/esbuild`'s `generatePackageJson` prunes a subset `package.json` +
 * `pnpm-lock.yaml` for a single project, but that directory has no
 * `pnpm-workspace.yaml` of its own — so it never inherits the root
 * workspace's `allowBuilds` allowlist. pnpm only reads `allowBuilds` from
 * `pnpm-workspace.yaml`, never from a package.json `pnpm` field, even for
 * a single-package directory (verified against pnpm 11.17.0: adding
 * `pnpm.allowBuilds` / `pnpm.onlyBuiltDependencies` to `package.json` is
 * silently ignored). Firebase's Cloud Build then runs its own
 * `pnpm install --frozen-lockfile` in the uploaded directory, and pnpm 11
 * hard-fails with `ERR_PNPM_IGNORED_BUILDS` for any resolved dependency
 * with an install/postinstall script that isn't allowlisted (observed:
 * `@firebase/util`, `protobufjs`).
 *
 * Derives the allowlist from the root `pnpm-workspace.yaml`'s own
 * `allowBuilds` map, filtered to packages that actually resolve in the
 * pruned lockfile — so it can't drift from the root config, and doesn't
 * grant build-script permission to packages this project doesn't even
 * depend on.
 *
 * Usage: node tools/src/write-functions-workspace-allowbuilds.mjs <pruned-lockfile> <root-workspace-yaml>
 */
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';

/**
 * Pure transform: given the pruned lockfile's YAML text and the root
 * workspace's YAML text, returns the subset of the root's `allowBuilds`
 * map whose package names actually resolve in the pruned lockfile.
 */
export function selectAllowBuilds(prunedLockfileYaml, rootWorkspaceYaml) {
  const allowBuilds = parse(rootWorkspaceYaml).allowBuilds ?? {};

  const resolvedNames = new Set();
  for (const key of Object.keys(parse(prunedLockfileYaml).packages ?? {})) {
    // Resolved keys look like `'@scope/name@1.2.3':` or `'name@1.2.3':` —
    // strip the trailing `@<version>` to get the bare package name.
    const match = key.match(/^(.+)@[^@]+$/);
    if (match) resolvedNames.add(match[1]);
  }

  const selected = {};
  for (const [name, value] of Object.entries(allowBuilds)) {
    if (resolvedNames.has(name)) selected[name] = value;
  }
  return selected;
}

async function main() {
  const [lockfilePath, workspacePath] = process.argv.slice(2);
  if (!lockfilePath || !workspacePath) {
    console.error(
      'Usage: write-functions-workspace-allowbuilds.mjs <pruned-lockfile> <root-workspace-yaml>'
    );
    process.exitCode = 1;
    return;
  }

  const [prunedLockfileYaml, rootWorkspaceYaml] = await Promise.all([
    fs.readFile(lockfilePath, 'utf8'),
    fs.readFile(workspacePath, 'utf8'),
  ]);

  const allowBuilds = selectAllowBuilds(prunedLockfileYaml, rootWorkspaceYaml);
  if (Object.keys(allowBuilds).length === 0) {
    return;
  }

  const outPath = join(dirname(lockfilePath), 'pnpm-workspace.yaml');
  await fs.writeFile(
    outPath,
    stringify({ packages: ['.'], allowBuilds }),
    'utf8'
  );
  console.log(
    `write-functions-workspace-allowbuilds: wrote allowBuilds for ${Object.keys(
      allowBuilds
    ).join(', ')} to ${outPath}`
  );
}

const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await main();
}
