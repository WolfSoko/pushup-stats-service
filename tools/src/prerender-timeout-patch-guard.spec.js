const { existsSync, readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');
const WORKSPACE_CONFIG = resolve(ROOT, 'pnpm-workspace.yaml');

const PRERENDER_WORKER_FILES = [
  'src/utils/server-rendering/render-worker.js',
  'src/utils/server-rendering/routes-extractor-worker.js',
];
const RAISED_TIMEOUT = 'AbortSignal.timeout(300_000)';
const UPSTREAM_TIMEOUT = 'AbortSignal.timeout(30_000)';

/**
 * Locks in the two defenses against App Hosting prerender build failures:
 * the pnpm patch raising @angular/build's hard-coded 30 s per-route prerender
 * timeout to 300 s (patches/@angular__build.patch), and the
 * NG_BUILD_MAX_WORKERS=2 cap in both apphosting configs.
 *
 * The App Hosting builder has ~8 GB RAM; the main build process needs a 6 GB
 * heap and each prerender worker thread adds its own V8 isolate. With the
 * default 4 workers the ~2400-route prerender (9 locales, `sourceMap: true`)
 * thrashes into memory-pressure stalls late in the build — a single route
 * hanging past the timeout aborts the whole build (AbortError on one route,
 * then "Terminating worker thread" on every in-flight route). Upstream offers
 * no configuration for the timeout as of 22.x.
 *
 * If an Angular upgrade drops or breaks the patch, refresh it via
 * `pnpm patch @angular/build` instead of deleting it — see
 * docs/gotchas/build-and-tooling.md.
 */
describe('@angular/build prerender-timeout patch', () => {
  it('should register the patch in pnpm-workspace.yaml and ship the patch file', () => {
    // given pnpm only applies patches listed under patchedDependencies
    const workspace = parse(readFileSync(WORKSPACE_CONFIG, 'utf-8'));
    // when resolving the configured patch file for @angular/build
    const patchPath = workspace.patchedDependencies?.['@angular/build'];
    // then the entry exists and points at a committed patch file
    expect(patchPath).toBeDefined();
    expect(existsSync(resolve(ROOT, patchPath))).toBe(true);
  });

  it('should raise the timeout for both prerender workers in the patch file', () => {
    // given the patch file registered in pnpm-workspace.yaml
    const workspace = parse(readFileSync(WORKSPACE_CONFIG, 'utf-8'));
    const patch = readFileSync(
      resolve(ROOT, workspace.patchedDependencies['@angular/build']),
      'utf-8'
    );
    for (const workerFile of PRERENDER_WORKER_FILES) {
      // when isolating the diff section of the worker that renders/extracts routes
      const section = patch
        .split(/^diff --git /m)
        .find((part) => part.includes(`--- a/${workerFile}`));
      expect(section).toBeDefined();
      // then that worker's own hunk swaps the upstream 30 s budget for 120 s
      const lines = section.split('\n');
      expect(
        lines.some((l) => l.startsWith('-') && l.includes(UPSTREAM_TIMEOUT))
      ).toBe(true);
      expect(
        lines.some((l) => l.startsWith('+') && l.includes(RAISED_TIMEOUT))
      ).toBe(true);
      expect(
        lines.some((l) => l.startsWith('+') && l.includes(UPSTREAM_TIMEOUT))
      ).toBe(false);
    }
  });

  it('should apply the raised timeout to the installed @angular/build', () => {
    // given the workspace's resolved @angular/build installation
    const installedRoot = dirname(
      require.resolve('@angular/build/package.json', { paths: [ROOT] })
    );
    for (const workerFile of PRERENDER_WORKER_FILES) {
      // when reading the worker that owns the per-route abort signal
      const source = readFileSync(join(installedRoot, workerFile), 'utf-8');
      // then the patched 300 s budget is in effect and the 30 s one is gone
      expect(source).toContain(RAISED_TIMEOUT);
      expect(source).not.toContain(UPSTREAM_TIMEOUT);
    }
  });

  it.each(['apphosting.yaml', 'apphosting.staging.yaml'])(
    'should cap prerender workers at BUILD time in %s',
    (configFile) => {
      // given the ~8 GB App Hosting builder that thrashes with 4 workers
      const config = parse(readFileSync(resolve(ROOT, configFile), 'utf-8'));
      // when App Hosting resolves the build-time environment
      const workersEntry = (config.env ?? []).find(
        (entry) => entry && entry.variable === 'NG_BUILD_MAX_WORKERS'
      );
      // then the worker cap is bound at BUILD availability and stays small
      expect(workersEntry).toBeDefined();
      expect(workersEntry.availability).toEqual(['BUILD']);
      expect(Number(workersEntry.value)).toBeGreaterThanOrEqual(1);
      expect(Number(workersEntry.value)).toBeLessThanOrEqual(2);
    }
  );
});
