const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const MODULE_PATH = resolve(
  __dirname,
  'write-functions-workspace-allowbuilds.mjs'
);

// ESM module; run `selectAllowBuilds` in a throwaway node subprocess (mirrors
// the pattern in strip-unused-lockfile-patches.spec.js) since `tools/jest.config.cjs`
// only transforms `.ts`/`.js`.
function runSelectAllowBuilds(prunedLockfileYaml, rootWorkspaceYaml) {
  const script = `
    import { selectAllowBuilds } from ${JSON.stringify(MODULE_PATH)};
    process.stdout.write(JSON.stringify(selectAllowBuilds(${JSON.stringify(prunedLockfileYaml)}, ${JSON.stringify(rootWorkspaceYaml)})));
  `;
  const out = execFileSync('node', ['--input-type=module', '-e', script], {
    encoding: 'utf-8',
  });
  return JSON.parse(out);
}

describe('selectAllowBuilds', () => {
  it('selects only root allowBuilds entries that resolve in the pruned lockfile', () => {
    const rootWorkspaceYaml = [
      'allowBuilds:',
      "  '@firebase/util': true",
      '  protobufjs: true',
      '  esbuild: true', // not a dependency of the pruned project — must be dropped
      '',
    ].join('\n');

    const prunedLockfileYaml = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      "  '@firebase/util@1.15.1':",
      '    resolution: {}',
      "  'protobufjs@7.6.1':",
      '    resolution: {}',
      "  'firebase-admin@13.10.0':",
      '    resolution: {}',
      '',
    ].join('\n');

    const result = runSelectAllowBuilds(prunedLockfileYaml, rootWorkspaceYaml);

    expect(result).toEqual({
      '@firebase/util': true,
      protobufjs: true,
    });
  });

  it('returns an empty object when the root has no allowBuilds block', () => {
    const rootWorkspaceYaml = [
      'packages:',
      "  - 'data-store/functions'",
      '',
    ].join('\n');
    const prunedLockfileYaml = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      "  'protobufjs@7.6.1':",
      '    resolution: {}',
      '',
    ].join('\n');

    const result = runSelectAllowBuilds(prunedLockfileYaml, rootWorkspaceYaml);

    expect(result).toEqual({});
  });

  it('returns an empty object when none of the allowBuilds packages resolve', () => {
    const rootWorkspaceYaml = [
      'allowBuilds:',
      '  esbuild: true',
      '  nx: true',
      '',
    ].join('\n');
    const prunedLockfileYaml = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      "  'firebase-admin@13.10.0':",
      '    resolution: {}',
      '',
    ].join('\n');

    const result = runSelectAllowBuilds(prunedLockfileYaml, rootWorkspaceYaml);

    expect(result).toEqual({});
  });
});
