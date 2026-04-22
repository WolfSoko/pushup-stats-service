#!/usr/bin/env node
/**
 * Build the push service worker bundle with a git-SHA version stamp.
 *
 * Output: `dist/libs/sw-push/sw-push.js` (+ `.map`). Consumed by
 * `web/project.json`'s asset glob and shipped to `/push/sw-push.js`.
 *
 * Version resolution order (first hit wins):
 *   1. `GITHUB_SHA` env var (CI) — truncated to 7 chars.
 *   2. `git rev-parse --short HEAD` (local).
 *   3. `dev-<epoch-ms>` fallback (detached builds, no git).
 *
 * The resolved SHA is injected via esbuild's `define` into the sole
 * `__SW_PUSH_VERSION__` reference in `handlers.ts`. The stamp guarantees a
 * byte-diff on every build so browsers pick up the new SW during the
 * update check, even when push logic is unchanged.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
// Output into `web/public/push/` so the default `web/public` asset glob in
// `web/project.json` picks the file up at `/push/sw-push.js`. The file is
// regenerated on every `sw-push:build` and is not source-controlled.
const OUTDIR = resolve(ROOT, 'web', 'public', 'push');
const ENTRY = resolve(HERE, 'src', 'sw-push.ts');
const TSCONFIG = resolve(HERE, 'tsconfig.lib.json');

function resolveVersion() {
  const fromEnv = process.env.GITHUB_SHA;
  if (fromEnv && fromEnv.length >= 7) return fromEnv.slice(0, 7);
  try {
    // execFileSync (no shell) — args are fixed literals, no injection surface.
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return `dev-${Date.now()}`;
  }
}

const version = resolveVersion();
mkdirSync(OUTDIR, { recursive: true });

await esbuild.build({
  entryPoints: [ENTRY],
  outfile: resolve(OUTDIR, 'sw-push.js'),
  tsconfig: TSCONFIG,
  bundle: true,
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  minify: false,
  legalComments: 'none',
  banner: { js: `/* sw-push ${version} */` },
  define: {
    __SW_PUSH_VERSION__: JSON.stringify(version),
  },
  logLevel: 'info',
});

console.log(`[sw-push] built ${version} → ${OUTDIR}/sw-push.js`);
