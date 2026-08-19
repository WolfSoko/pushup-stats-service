const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');
const PROD_CONFIG = resolve(ROOT, 'apphosting.yaml');
const STAGING_CONFIG = resolve(ROOT, 'apphosting.staging.yaml');

function load(path) {
  return parse(readFileSync(path, 'utf-8'));
}

function isMapping(value) {
  return typeof value === 'object' && value !== null;
}

function secretVariables(config) {
  return (config.env ?? [])
    .filter((entry) => isMapping(entry) && 'secret' in entry)
    .map((entry) => entry.variable);
}

function buildCommand(config) {
  return config.scripts?.buildCommand ?? '';
}

/**
 * Locks in Sentry source-map upload configuration for the Firebase App
 * Hosting configs. See docs/observability/sentry.md.
 *
 * Production no longer runs `pnpm sentry:sourcemaps` here at all — the
 * upload now happens once in CI (`.github/workflows/ci.yml` `publish-release`
 * job) as part of building the pre-built artifact App Hosting downloads (see
 * apphosting-release-artifact-guard.spec.js). Staging still builds from
 * source and, unchanged, never uploads source maps either: the staging GCP
 * project (pushup-stats-staging-867b7) has no SENTRY_AUTH_TOKEN secret, and
 * an App Hosting `secret:` reference to a missing secret fails the rollout at
 * bind time — before the build runs — which the upload script's
 * no-op-when-unset guard cannot catch.
 *
 * App Hosting MERGES apphosting.staging.yaml onto apphosting.yaml by env
 * variable name, so base-only entries persist. Production no longer defines
 * a SENTRY_AUTH_TOKEN secret binding to inherit, but staging keeps its own
 * literal-value override in place defensively (see apphosting.staging.yaml)
 * in case a future prod change reintroduces one.
 */
describe('App Hosting Sentry configuration', () => {
  describe('staging (apphosting.staging.yaml)', () => {
    const staging = load(STAGING_CONFIG);

    it('should not reference the SENTRY_AUTH_TOKEN secret', () => {
      // given the staging GCP project has no SENTRY_AUTH_TOKEN secret bound
      // when App Hosting resolves env secrets at rollout time
      // then no secret binding may exist that would fail before the build runs
      expect(secretVariables(staging)).not.toContain('SENTRY_AUTH_TOKEN');
    });

    it('should override a would-be-inherited SENTRY_AUTH_TOKEN with a non-empty literal value', () => {
      // given App Hosting merges apphosting.yaml onto this file by variable
      //   name, so a future prod `secret: SENTRY_AUTH_TOKEN` binding would
      //   otherwise leak into staging
      // when staging redefines the same variable with a plain value
      // then the inherited secret binding is replaced and bind-time resolution
      //   of a nonexistent staging secret can't break the rollout — and the value
      //   must be non-empty, since App Hosting reserves "" and rejects it
      const tokenEntry = (staging.env ?? []).find(
        (entry) => isMapping(entry) && entry.variable === 'SENTRY_AUTH_TOKEN'
      );
      expect(tokenEntry).toBeDefined();
      expect(tokenEntry).not.toHaveProperty('secret');
      expect(typeof tokenEntry.value).toBe('string');
      expect(tokenEntry.value.length).toBeGreaterThan(0);
    });

    it('should not run the Sentry source-map upload in its build command', () => {
      // given staging is an ephemeral preview surface with no Sentry token
      // when App Hosting runs scripts.buildCommand
      // then it must build the web bundle without invoking sentry:sourcemaps
      expect(buildCommand(staging)).not.toMatch(/sentry:sourcemaps/);
    });
  });

  describe('production (apphosting.yaml)', () => {
    const prod = load(PROD_CONFIG);

    it('should not bind the SENTRY_AUTH_TOKEN secret', () => {
      // given the upload now happens once in CI, not in the App Hosting build
      // when App Hosting resolves the build-time environment
      // then no SENTRY_AUTH_TOKEN binding should exist here to go stale
      const tokenEntry = (prod.env ?? []).find(
        (entry) => entry && entry.variable === 'SENTRY_AUTH_TOKEN'
      );
      expect(tokenEntry).toBeUndefined();
    });

    it('should not run the Sentry source-map upload in its build command', () => {
      // given the upload now happens in CI's publish-release job
      // when App Hosting runs scripts.buildCommand
      // then it must only fetch the pre-built artifact, never invoke nx/sentry
      expect(buildCommand(prod)).not.toMatch(/sentry:sourcemaps/);
    });
  });
});
