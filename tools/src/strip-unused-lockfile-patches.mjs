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
export function stripUnusedPatches(raw) {
  const lines = raw.split('\n');

  const startIdx = lines.findIndex((l) => l === 'patchedDependencies:');
  if (startIdx === -1) {
    return { content: raw, removedNames: [], skippedNames: [] };
  }

  // The block runs until the next top-level (unindented, non-blank) line.
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].length > 0 && !lines[i].startsWith(' ')) {
      endIdx = i;
      break;
    }
  }

  // Patched package names are the block's 2-space-indented `'name':` keys.
  const nameRe = /^ {2}'?([^':]+)'?:\s*$/;
  const patchedNames = lines
    .slice(startIdx + 1, endIdx)
    .map((l) => l.match(nameRe)?.[1])
    .filter((name) => name !== undefined);

  const outsideBlock =
    lines.slice(0, startIdx).join('\n') + lines.slice(endIdx).join('\n');
  const stillUsed = patchedNames.filter((name) =>
    outsideBlock.includes(`${name}@`)
  );

  if (stillUsed.length > 0) {
    // A mixed case (some patches used, some not) needs real YAML-aware
    // per-entry removal; bail out rather than risk a malformed splice. The
    // predeploy step will then surface the original pnpm error clearly.
    return { content: raw, removedNames: [], skippedNames: stillUsed };
  }

  // A trailing blank line separates this block from the next section; drop
  // it along with the block itself so section spacing stays consistent.
  let spliceEnd = endIdx;
  if (lines[spliceEnd - 1] === '') spliceEnd -= 1;
  const nextLines = lines.slice();
  nextLines.splice(startIdx, spliceEnd - startIdx + 1);

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
