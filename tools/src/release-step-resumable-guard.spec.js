const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');

function releaseStep() {
  const ci = parse(
    readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf-8')
  );
  const job = ci.jobs['publish-release'];
  const step = (job?.steps ?? []).find((s) =>
    /Version \+ publish GitHub Release/.test(s?.name ?? '')
  );
  if (!step) {
    throw new Error(
      'publish-release has no "Version + publish GitHub Release" step — this guard needs updating'
    );
  }
  return step.run;
}

/**
 * Locks in that the release step can be re-run.
 *
 * The tag is pushed before the build artifact is uploaded. A run that dies in
 * between — cancelled, runner reclaimed, network blip — leaves the tag behind
 * with no artifact. Without the guards below, every retry then failed on
 * `fatal: tag '...' already exists`, and because `promote-to-deploy` needs
 * this job, production stayed behind main until someone deleted the tag by
 * hand. That happened twice in a row on 2026-09-17.
 *
 * These assertions are deliberately about the *shape* of the recovery, not
 * about exact wording: each one names a failure mode that has to stay covered.
 */
describe('publish-release is resumable', () => {
  it('should skip tagging when the tag for this commit already exists', () => {
    // given the release step
    const run = releaseStep();

    // then it asks the remote about its own tag before creating it …
    expect(run).toMatch(/git ls-remote --tags origin "refs\/tags\/\$\{TAG\}"/);

    // … and the tagging call sits behind that check rather than running
    // unconditionally
    const guardIndex = run.indexOf('refs/tags/${TAG}');
    const tagIndex = run.indexOf('nx release changelog');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(tagIndex).toBeGreaterThan(guardIndex);
  });

  it('should create the release when only the tag survived the interruption', () => {
    // given the release step
    const run = releaseStep();

    // then a missing release is recreated instead of failing the upload —
    // the window between pushing the tag and creating the release is real
    expect(run).toMatch(/gh release view "\$TAG"/);
    expect(run).toMatch(/gh release create "\$TAG"/);
  });

  it('should replace an artifact a partial attempt left behind', () => {
    // given the release step
    const run = releaseStep();

    // then the upload overwrites rather than colliding
    expect(run).toMatch(
      /gh release upload "\$TAG" dist-web\.tar\.gz --clobber/
    );
  });
});
