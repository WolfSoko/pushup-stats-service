const { execFileSync } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '../..');
const SCRIPT = resolve(__dirname, 'write-build-info.mjs');

function runScript(browserDir, env = {}, cwd = ROOT) {
  execFileSync('node', [SCRIPT, browserDir], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runAndRead(browserDir, env = {}) {
  runScript(browserDir, env);
  return JSON.parse(readFileSync(join(browserDir, 'build-info.json'), 'utf-8'));
}

describe('write-build-info', () => {
  let browserDir;

  beforeEach(() => {
    browserDir = mkdtempSync(join(tmpdir(), 'build-info-'));
  });

  afterEach(() => {
    rmSync(browserDir, { recursive: true, force: true });
  });

  it('should derive the version from the CI release name', () => {
    // given CI pins the release to the short SHA it also tags the deploy with
    // when the script writes the build info into the browser bundle
    const info = runAndRead(browserDir, { SENTRY_RELEASE: 'abc1234' });

    // then version matches the `deploy-0.0.0-<sha>` tag the release is published under
    expect(info.release).toBe('abc1234');
    expect(info.version).toBe('0.0.0-abc1234');
    expect(Number.isNaN(Date.parse(info.builtAt))).toBe(false);
  });

  it('should fall back to the current commit when no release name is set', () => {
    // given a build without SENTRY_RELEASE (e.g. the staging build command)
    const expected = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim();

    // when the script writes the build info
    const info = runAndRead(browserDir, { SENTRY_RELEASE: '' });

    // then it reports the commit being built, abbreviated the same way as the deploy tag
    expect(info.release).toBe(expected);
    expect(info.version).toBe(`0.0.0-${expected}`);
  });

  it('should skip the file instead of failing the build when no commit is available', () => {
    // given a build environment without git history and without SENTRY_RELEASE
    //   (the staging buildCommand chains this script — a throw would break the
    //   whole PR preview over a version badge)
    // when the script runs outside any git repository
    runScript(browserDir, { SENTRY_RELEASE: '' }, tmpdir());

    // then it exits cleanly and simply writes nothing, so the readout falls
    //   back to "unbekannt"
    expect(existsSync(join(browserDir, 'build-info.json'))).toBe(false);
  });

  it('should write a payload the SSR server and the client can parse', () => {
    // given the shape agreed with web/src/build-info.ts
    // when the script writes the build info
    const info = runAndRead(browserDir, { SENTRY_RELEASE: 'abc1234' });

    // then exactly the three documented fields are present, all non-empty strings
    expect(Object.keys(info).sort()).toEqual(['builtAt', 'release', 'version']);
    for (const value of Object.values(info)) {
      expect(typeof value).toBe('string');
      expect(value).not.toBe('');
    }
  });
});
