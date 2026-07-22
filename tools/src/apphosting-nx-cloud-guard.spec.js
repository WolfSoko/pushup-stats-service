const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');

function load(file) {
  return parse(readFileSync(resolve(ROOT, file), 'utf-8'));
}

function envEntry(config, variable) {
  return (config.env ?? []).find(
    (entry) => entry && entry.variable === variable
  );
}

/**
 * Locks in the Nx Cloud remote-cache wiring for App Hosting builds.
 *
 * CI seeds `web:build:production` into the remote cache on every main push
 * (write token), and App Hosting only builds commits that already passed CI —
 * so with a read token bound at BUILD time, every rollout restores the build
 * from cache instead of re-running it on the ~8 GB builder that cannot handle
 * the full 9-locale prerender (see docs/gotchas/build-and-tooling.md).
 *
 * Staging must NOT inherit the secret binding: App Hosting merges
 * apphosting.staging.yaml onto apphosting.yaml by variable name, base-only
 * entries persist, and a secret reference that doesn't exist in the staging
 * project fails the rollout at bind time — the same pitfall locked in by
 * apphosting-sentry-guard.spec.js.
 */
describe('App Hosting Nx Cloud cache configuration', () => {
  it('should bind the NX_CLOUD_ACCESS_TOKEN secret at BUILD time in production', () => {
    // given the remote cache seeded by CI's main-push run
    const prod = load('apphosting.yaml');
    // when App Hosting resolves the build-time environment
    const tokenEntry = envEntry(prod, 'NX_CLOUD_ACCESS_TOKEN');
    // then the read token is available to nx during buildCommand
    expect(tokenEntry).toMatchObject({
      secret: 'NX_CLOUD_ACCESS_TOKEN',
      availability: ['BUILD'],
    });
  });

  it('should override the inherited secret with a non-empty literal value in staging', () => {
    // given the staging GCP project has no NX_CLOUD_ACCESS_TOKEN secret
    const staging = load('apphosting.staging.yaml');
    // when staging redefines the variable that would otherwise merge in
    const tokenEntry = envEntry(staging, 'NX_CLOUD_ACCESS_TOKEN');
    // then the secret resolution is replaced by a plain value ("" is
    //   reserved by App Hosting and rejected, so it must be non-empty)
    expect(tokenEntry).toBeDefined();
    expect(tokenEntry).not.toHaveProperty('secret');
    expect(typeof tokenEntry.value).toBe('string');
    expect(tokenEntry.value.length).toBeGreaterThan(0);
  });
});
