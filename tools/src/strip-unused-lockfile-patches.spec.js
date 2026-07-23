const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(__dirname, 'strip-unused-lockfile-patches.mjs');

// `strip-unused-lockfile-patches.mjs` is ESM; run `stripUnusedPatches` in a
// throwaway node subprocess (mirrors the execFileSync pattern in
// generate-content.spec.js) rather than importing it into this CommonJS Jest
// test, since `tools/jest.config.cjs` only transforms `.ts`/`.js`.
function runStripUnusedPatches(raw) {
  const script = `
    import { stripUnusedPatches } from ${JSON.stringify(MODULE_PATH)};
    process.stdout.write(JSON.stringify(stripUnusedPatches(${JSON.stringify(raw)})));
  `;
  const out = execFileSync('node', ['--input-type=module', '-e', script], {
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

describe('stripUnusedPatches', () => {
  it('leaves the content untouched when there is no patchedDependencies block', () => {
    const raw = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '  .: {}',
      '',
    ].join('\n');

    const result = runStripUnusedPatches(raw);

    expect(result).toEqual({
      content: raw,
      removedNames: [],
      skippedNames: [],
    });
  });

  it('removes the block when the patched package is not resolved anywhere else', () => {
    // Mirrors the real `data-store/functions-dist/pnpm-lock.yaml` shape:
    // @angular/build is patched workspace-wide but isn't a dependency of
    // this project, so it never appears as a `packages:` key.
    const raw = [
      "lockfileVersion: '9.0'",
      '',
      'settings:',
      '  autoInstallPeers: true',
      '',
      'patchedDependencies:',
      "  '@angular/build':",
      '    hash: abc123',
      '    path: patches/@angular__build.patch',
      '',
      'importers:',
      '  .:',
      '    dependencies:',
      "      '@jest/globals':",
      '        specifier: 30.4.1',
      '        version: 30.4.1',
      '',
      'packages:',
      "  '@jest/globals@30.4.1':",
      '    resolution: {integrity: sha512-abc}',
      '',
    ].join('\n');

    const result = runStripUnusedPatches(raw);

    expect(result.removedNames).toEqual(['@angular/build']);
    expect(result.skippedNames).toEqual([]);
    expect(result.content).not.toContain('patchedDependencies');
    expect(result.content).not.toContain('@angular/build');
    // the rest of the file (importers/packages) survives byte-for-byte
    expect(result.content).toContain("'@jest/globals@30.4.1':");
    expect(result.content).toContain('settings:');
  });

  it('leaves the block untouched when the patched package is actually resolved', () => {
    const raw = [
      "lockfileVersion: '9.0'",
      '',
      'patchedDependencies:',
      "  'some-lib':",
      '    hash: abc123',
      '    path: patches/some-lib.patch',
      '',
      'packages:',
      "  'some-lib@1.0.0':",
      '    resolution: {integrity: sha512-abc}',
      '',
    ].join('\n');

    const result = runStripUnusedPatches(raw);

    // bail out rather than risk a malformed partial splice
    expect(result).toEqual({
      content: raw,
      removedNames: [],
      skippedNames: ['some-lib'],
    });
  });

  it('does not mistake an unrelated package with a matching suffix for a real match', () => {
    // Regression: a naive `outsideBlock.includes('${name}@')` substring
    // check would treat `@babel/core@7.0.0` as "core" being used, since
    // the substring `core@7.0.0` appears inside it. The exact-key check
    // must tell these apart.
    const raw = [
      "lockfileVersion: '9.0'",
      '',
      'patchedDependencies:',
      "  'core':",
      '    hash: abc123',
      '    path: patches/core.patch',
      '',
      'packages:',
      "  '@babel/core@7.0.0':",
      '    resolution: {integrity: sha512-abc}',
      '',
    ].join('\n');

    const result = runStripUnusedPatches(raw);

    expect(result.removedNames).toEqual(['core']);
    expect(result.skippedNames).toEqual([]);
    expect(result.content).not.toContain('patchedDependencies');
    expect(result.content).toContain("'@babel/core@7.0.0':");
  });

  it('removes the trailing blank line along with the block', () => {
    const raw = [
      "lockfileVersion: '9.0'",
      '',
      'patchedDependencies:',
      "  '@angular/build':",
      '    hash: abc123',
      '    path: patches/@angular__build.patch',
      '',
      'importers:',
      '  .: {}',
      '',
    ].join('\n');

    const result = runStripUnusedPatches(raw);

    // no leftover double-blank-line where the block used to be
    expect(result.content).toBe(
      ["lockfileVersion: '9.0'", '', 'importers:', '  .: {}', ''].join('\n')
    );
  });

  it('does not delete the next section header when there is no blank separator', () => {
    // Regression: an earlier version computed the splice length as
    // `endIdx - startIdx + 1` whenever there was no trailing blank line,
    // which ate the very next line — the next section's own `key:` header.
    const raw = [
      "lockfileVersion: '9.0'",
      '',
      'patchedDependencies:',
      "  '@angular/build':",
      '    hash: abc123',
      '    path: patches/@angular__build.patch',
      'importers:',
      '  .: {}',
      '',
    ].join('\n');

    const result = runStripUnusedPatches(raw);

    expect(result.content).toBe(
      ["lockfileVersion: '9.0'", '', 'importers:', '  .: {}', ''].join('\n')
    );
  });
});
