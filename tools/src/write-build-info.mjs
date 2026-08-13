#!/usr/bin/env node
/**
 * Write `build-info.json` into the built browser bundle so the running
 * deployment can report which release it is (admin area) and so the SSR
 * process can tag Sentry events with the same release name.
 *
 * Runs *after* the Angular build, never inside it: baking the commit SHA into
 * the bundle would give every commit its own Nx build hash and defeat the
 * cache restore the `publish-release` CI job depends on (docs/ci-cd.md).
 *
 * The release name resolves as `SENTRY_RELEASE` (set by CI) →
 * `git rev-parse --short=7 HEAD`, so the admin readout, the Sentry release
 * and the `deploy-0.0.0-<sha>` tag all name the same commit.
 *
 * Usage: node tools/src/write-build-info.mjs [browserDir]
 *        (default browserDir: dist/web/browser)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function resolveRelease(env, gitShortSha) {
  return (env['SENTRY_RELEASE'] ?? '').trim() || gitShortSha;
}

export function buildInfoFor(release, builtAt) {
  return { release, version: `0.0.0-${release}`, builtAt };
}

function gitShortSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function main() {
  const browserDir = process.argv[2] ?? join('dist', 'web', 'browser');
  const release = resolveRelease(process.env, gitShortSha());
  if (!release) {
    // Never fail a deploy over a version badge: without the file the readout
    // degrades to "unbekannt", which is the designed fallback anyway. This is
    // the whole reason the staging buildCommand can chain the script safely.
    console.warn(
      '[build-info] no release name resolved (git unavailable?) — skipping'
    );
    return;
  }
  const info = buildInfoFor(release, new Date().toISOString());

  mkdirSync(browserDir, { recursive: true });
  writeFileSync(
    join(browserDir, 'build-info.json'),
    `${JSON.stringify(info, null, 2)}\n`,
    'utf-8'
  );

  console.log(`[build-info] ${info.version} → ${browserDir}/build-info.json`);
}

const isMain =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
