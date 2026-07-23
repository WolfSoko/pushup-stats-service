#!/usr/bin/env node
/**
 * Strip the top-level `patchedDependencies:` block from a generated
 * per-project pnpm lockfile when none of its patched packages are actually
 * part of that project's resolved dependency graph.
 *
 * `@nx/esbuild`'s `generatePackageJson` prunes a subset `package.json` +
 * `pnpm-lock.yaml` for a single project (e.g. `data-store/functions-dist`),
 * but copies the workspace's `patchedDependencies` config verbatim even when
 * none of the patched packages are dependencies of that project (the
 * `@angular/build` patch is a web-only devDependency, irrelevant to
 * cloud-functions). Firebase's Cloud Build then runs its own
 * `pnpm install --frozen-lockfile` against the generated package.json (which
 * carries no matching `pnpm.patchedDependencies` field), and pnpm rejects the
 * mismatch with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
 *
 * Edits the file as plain text (a targeted line splice of the
 * `patchedDependencies:` block) rather than a full YAML parse/stringify
 * round-trip, so the rest of a 2000+ line generated lockfile is left
 * byte-identical.
 *
 * Usage: node tools/src/strip-unused-lockfile-patches.mjs <path-to-lockfile>
 */
import { promises as fs } from 'node:fs';

/**
 * Pure transform: removes the `patchedDependencies:` block from lockfile text
 * when none of its patched package names appear in the rest of the file
 * (i.e. they're not actually resolved dependencies). Returns the
 * (possibly unchanged) content plus which names were removed vs. left in
 * place because they still looked used.
 */
// Finds a top-level (column-0) `key:` line and the half-open line range
// [startIdx, endIdx) of its block — up to the next top-level, non-blank line
// (or EOF). Returns null if the key isn't present.
function findTopLevelBlock(lines, key) {
  const startIdx = lines.findIndex((l) => l === `${key}:`);
  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].length > 0 && !lines[i].startsWith(' ')) {
      endIdx = i;
      break;
    }
  }
  return { startIdx, endIdx };
}

export function stripUnusedPatches(raw) {
  const lines = raw.split('\n');

  const patchedBlock = findTopLevelBlock(lines, 'patchedDependencies');
  if (!patchedBlock) {
    return { content: raw, removedNames: [], skippedNames: [] };
  }
  const { startIdx, endIdx } = patchedBlock;

  // Patched package names are the block's 2-space-indented `'name':` keys.
  const nameRe = /^ {2}'?([^':]+)'?:\s*$/;
  const patchedNames = lines
    .slice(startIdx + 1, endIdx)
    .map((l) => l.match(nameRe)?.[1])
    .filter((name) => name !== undefined);

  // A package is "used" only if it's an exact resolved key in `packages:`
  // (e.g. `'@babel/core@7.0.0':` -> name `@babel/core`) — not a raw
  // substring match, which would false-positive on e.g. a patch named
  // `core` against an unrelated `@babel/core@...` entry.
  const packagesBlock = findTopLevelBlock(lines, 'packages');
  const resolvedNames = new Set();
  if (packagesBlock) {
    const pkgKeyRe = /^ {2}'?(.+)@[^@'\s]+'?:\s*$/;
    for (const line of lines.slice(
      packagesBlock.startIdx + 1,
      packagesBlock.endIdx
    )) {
      const match = line.match(pkgKeyRe);
      if (match) resolvedNames.add(match[1]);
    }
  }

  const stillUsed = patchedNames.filter((name) => resolvedNames.has(name));

  if (stillUsed.length > 0) {
    // A mixed case (some patches used, some not) needs real YAML-aware
    // per-entry removal; bail out rather than risk a malformed splice. The
    // predeploy step will then surface the original pnpm error clearly.
    return { content: raw, removedNames: [], skippedNames: stillUsed };
  }

  // [startIdx, endIdx) already spans exactly the block (including any blank
  // line that separates it from the next section, since that blank line
  // sits before endIdx) — splicing anything more would eat the next
  // section's header when there's no blank separator.
  const nextLines = lines.slice();
  nextLines.splice(startIdx, endIdx - startIdx);

  return {
    content: nextLines.join('\n'),
    removedNames: patchedNames,
    skippedNames: [],
  };
}

async function main() {
  const lockfilePath = process.argv[2];
  if (!lockfilePath) {
    console.error(
      'Usage: strip-unused-lockfile-patches.mjs <path-to-lockfile>'
    );
    process.exitCode = 1;
    return;
  }

  const raw = await fs.readFile(lockfilePath, 'utf8');
  const { content, removedNames, skippedNames } = stripUnusedPatches(raw);

  if (skippedNames.length > 0) {
    console.warn(
      `strip-unused-lockfile-patches: ${skippedNames.join(
        ', '
      )} appear used in ${lockfilePath} — leaving patchedDependencies untouched`
    );
    return;
  }

  if (removedNames.length === 0) {
    return;
  }

  await fs.writeFile(lockfilePath, content, 'utf8');
  console.log(
    `strip-unused-lockfile-patches: removed unused patchedDependencies (${removedNames.join(
      ', '
    )}) from ${lockfilePath}`
  );
}

const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await main();
}
