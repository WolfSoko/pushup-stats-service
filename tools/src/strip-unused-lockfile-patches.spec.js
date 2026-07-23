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
  it('should leave the content untouched when there is no patchedDependencies block', () => {
    // given
    const raw = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '  .: {}',
      '',
    ].join('\n');

    // when
    const result = runStripUnusedPatches(raw);

    // then
    expect(result).toEqual({
      content: raw,
      removedNames: [],
      skippedNames: [],
    });
  });

  it('should remove the block when the patched package is not resolved anywhere else', () => {
    // given — mirrors the real `data-store/functions-dist/pnpm-lock.yaml`
    // shape: @angular/build is patched workspace-wide but isn't a dependency
    // of this project, so it never appears as a `packages:` key.
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

    // when
    const result = runStripUnusedPatches(raw);

    // then
    expect(result.removedNames).toEqual(['@angular/build']);
    expect(result.skippedNames).toEqual([]);
    expect(result.content).not.toContain('patchedDependencies');
    expect(result.content).not.toContain('@angular/build');
    // the rest of the file (importers/packages) survives byte-for-byte
    expect(result.content).toContain("'@jest/globals@30.4.1':");
    expect(result.content).toContain('settings:');
  });

  it('should leave the block untouched when the patched package is actually resolved', () => {
    // given — a patch for a package that IS a real dependency here
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

    // when
    const result = runStripUnusedPatches(raw);

    // then — bail out rather than risk a malformed partial splice
    expect(result).toEqual({
      content: raw,
      removedNames: [],
      skippedNames: ['some-lib'],
    });
  });

  it('should remove the trailing blank line along with the block', () => {
    // given
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

    // when
    const result = runStripUnusedPatches(raw);

    // then — no leftover double-blank-line where the block used to be
    expect(result.content).toBe(
      ["lockfileVersion: '9.0'", '', 'importers:', '  .: {}', ''].join('\n')
    );
  });
});
