const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');

function read(file) {
  return readFileSync(resolve(ROOT, file), 'utf-8');
}

/**
 * Locks in the wiring that gives the admin area its "released version"
 * readout (`web/src/app/core/observability/release-badge.component.ts`).
 *
 * `build-info.json` is written into the browser bundle *after* the Angular
 * build by `tools/src/write-build-info.mjs` — deliberately not baked into the
 * bundle, because a per-commit build input would give every commit its own Nx
 * hash and defeat the cache restore the publish-release job depends on (see
 * docs/ci-cd.md).
 *
 * Every path that produces a deployed bundle therefore has to invoke the
 * script itself. Miss one and nothing breaks loudly — the admin area just
 * quietly reports "unbekannt" forever, which is exactly the kind of silent
 * drift a guard test is for.
 */
describe('build-info wiring', () => {
  it('should write build info into the release artifact before packaging it', () => {
    // given App Hosting serves whatever CI packaged into dist-web.tar.gz
    const ci = read('.github/workflows/ci.yml');

    // when the publish-release job builds and packages the bundle
    const writeStep = ci.indexOf('node tools/src/write-build-info.mjs');
    const packageStep = ci.indexOf('tar -C dist/web -czf dist-web.tar.gz');

    // then the build info exists before the tarball is created
    expect(writeStep).toBeGreaterThan(-1);
    expect(packageStep).toBeGreaterThan(-1);
    expect(writeStep).toBeLessThan(packageStep);
  });

  it('should write build info before the Firebase Hosting artifact is assembled', () => {
    // given the Hosting deploy builds its own bundle and copies dist/web/browser
    const deploy = read('.github/workflows/firebase-hosting-merge.yml');

    // when the deploy job prepares hosting-public
    const writeStep = deploy.indexOf('node tools/src/write-build-info.mjs');
    const copyStep = deploy.indexOf('cp -R dist/web/browser/.');

    // then the build info is written in time to be copied along
    expect(writeStep).toBeGreaterThan(-1);
    expect(copyStep).toBeGreaterThan(-1);
    expect(writeStep).toBeLessThan(copyStep);
  });

  it('should write build info in the staging build command', () => {
    // given staging builds from source instead of downloading the artifact
    const staging = parse(read('apphosting.staging.yaml'));

    // when App Hosting runs scripts.buildCommand for a PR preview
    // then the preview reports the commit it serves, like production does
    expect(staging.scripts?.buildCommand).toMatch(
      /node tools\/src\/write-build-info\.mjs/
    );
  });

  it('should pin the release name to the same short SHA as the deploy tag', () => {
    // given the Sentry release, build-info.json and the deploy tag must all
    //   name the same commit for a version readout to be traceable
    const ci = read('.github/workflows/ci.yml');
    const deploy = read('.github/workflows/firebase-hosting-merge.yml');

    // when either workflow resolves its release name
    // then both derive it from the same 7-char abbreviation and hand it to
    //   the sourcemap upload and the build-info script alike
    for (const workflow of [ci, deploy]) {
      expect(workflow).toMatch(/sha=\$\(git rev-parse --short=7 HEAD\)/);
      expect(workflow).toMatch(
        /SENTRY_RELEASE: \$\{\{ steps\.release\.outputs\.sha \}\}/
      );
    }
  });
});
