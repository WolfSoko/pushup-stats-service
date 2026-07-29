const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');
const PATHS_MODULE = resolve(__dirname, 'generated-content-paths.mjs');

// `generated-content-paths.mjs` is ESM; read it in a throwaway node
// subprocess (same pattern as generate-content.spec.js) rather than
// importing it into this CommonJS Jest test.
function loadPaths() {
  const script = `
    import * as paths from ${JSON.stringify(PATHS_MODULE)};
    process.stdout.write(JSON.stringify(paths));
  `;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
    })
  );
}

function generateContentTarget() {
  const project = JSON.parse(
    readFileSync(resolve(ROOT, 'tools/project.json'), 'utf-8')
  );
  return project.targets['generate-content'];
}

function prettierIgnoreEntries() {
  return readFileSync(resolve(ROOT, '.prettierignore'), 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/\/$/, ''));
}

/**
 * Pins `generate-content`'s Nx wiring to the paths the generator actually
 * touches.
 *
 * Its outputs are git-tracked sources that `web:build` hashes as inputs, so an
 * undeclared write path is not restored on a cache hit: the file's bytes then
 * depend on whether the generator ran, `web:build`'s hash differs per machine,
 * and the App Hosting rollout misses the remote cache it needs to avoid
 * rebuilding on the ~8 GB builder (docs/gotchas/build-and-tooling.md). A
 * generated file that Prettier reformats on commit drifts the same way, and an
 * undeclared source glob leaves stale content cached after a content edit.
 */
describe('generate-content path declarations', () => {
  const { CONTENT_SOURCE_GLOBS, GENERATED_CONTENT_PATHS } = loadPaths();
  const generatedPaths = Object.values(GENERATED_CONTENT_PATHS);

  it('should declare every generated path as an Nx output', () => {
    // given the paths the generator writes
    // when the Nx target's outputs are resolved
    const outputs = generateContentTarget().outputs;
    // then each one is restored on a cache hit instead of left to chance
    for (const path of generatedPaths) {
      expect(outputs).toContain(`{workspaceRoot}/${path}`);
    }
  });

  it('should declare every content source glob as an Nx input', () => {
    // given the markdown trees the generator reads
    // when the Nx target's inputs are resolved
    const inputs = generateContentTarget().inputs;
    // then editing any of them invalidates the cached generation
    for (const glob of CONTENT_SOURCE_GLOBS) {
      expect(inputs).toContain(`{workspaceRoot}/${glob}`);
    }
  });

  it('should keep every generated path out of Prettier', () => {
    // given the committed generated files
    // when Prettier's ignore list is resolved
    const ignored = prettierIgnoreEntries();
    // then no commit hook can reformat them away from the generator's output
    for (const path of generatedPaths) {
      expect(ignored).toContain(path);
    }
  });
});
