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
 * Locks in the deliberate prod/staging asymmetry around Sentry source-map
 * upload in the Firebase App Hosting configs. See docs/observability/sentry.md.
 *
 * Production binds the SENTRY_AUTH_TOKEN secret and runs `pnpm sentry:sourcemaps`
 * so the bundles served at pushup-stats.com carry matching debug IDs — without
 * it every production stack trace stays minified (the weeks-long bug that
 * originally motivated the upload). Staging must NOT: the staging GCP project
 * (pushup-stats-staging-867b7) has no such secret, and an App Hosting `secret:`
 * reference to a missing secret fails the rollout at bind time — before the
 * build runs — which the upload script's no-op-when-unset guard cannot catch.
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

    it('should not run the Sentry source-map upload in its build command', () => {
      // given staging is an ephemeral preview surface with no Sentry token
      // when App Hosting runs scripts.buildCommand
      // then it must build the web bundle without invoking sentry:sourcemaps
      expect(buildCommand(staging)).not.toMatch(/sentry:sourcemaps/);
    });
  });

  describe('production (apphosting.yaml)', () => {
    const prod = load(PROD_CONFIG);

    it('should bind the SENTRY_AUTH_TOKEN secret at BUILD time', () => {
      // given prod stack traces must de-minify against uploaded source maps
      // when App Hosting builds the bundle served at pushup-stats.com
      // then the SENTRY_AUTH_TOKEN secret must be available at BUILD time
      const tokenEntry = (prod.env ?? []).find(
        (entry) => entry && entry.variable === 'SENTRY_AUTH_TOKEN'
      );
      expect(tokenEntry).toMatchObject({
        secret: 'SENTRY_AUTH_TOKEN',
        availability: ['BUILD'],
      });
    });

    it('should run the Sentry source-map upload in its build command', () => {
      // given uploaded source maps are what make prod stack traces readable
      // when App Hosting runs scripts.buildCommand
      // then it must invoke sentry:sourcemaps after the web build
      expect(buildCommand(prod)).toMatch(/sentry:sourcemaps/);
    });
  });
});
