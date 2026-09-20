const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');
const CI_WORKFLOW = resolve(ROOT, '.github/workflows/ci.yml');

/**
 * `nx affected` needs a resolvable base revision. `nrwl/nx-set-shas` normally
 * supplies one via NX_BASE/NX_HEAD, but when it comes back empty Nx falls back
 * to its default `--base=main` — and in a pull-request checkout `main` is not a
 * local ref. `actions/checkout` only fetches the PR ref; `fetch-depth: 0`
 * deepens history without creating a second branch ref. The fallback then dies
 * with "fatal: ambiguous argument 'main'" before a single target runs, which
 * reads like a test failure but is a checkout gap.
 *
 * Each job that runs `nx affected` therefore fetches the base branch itself.
 * These tests keep that step in place and ordered ahead of the affected run.
 */
function loadJobs() {
  return parse(readFileSync(CI_WORKFLOW, 'utf-8')).jobs;
}

function steps(job) {
  return job.steps ?? [];
}

function isAffectedRun(step) {
  return typeof step.run === 'string' && step.run.includes('nx affected');
}

function isBaseRefFetch(step) {
  return (
    typeof step.run === 'string' &&
    step.run.includes('git fetch') &&
    step.run.includes('github.base_ref')
  );
}

function jobsRunningAffected() {
  return Object.entries(loadJobs()).filter(([, job]) =>
    steps(job).some(isAffectedRun)
  );
}

describe('CI: base ref for nx affected', () => {
  it('should find at least one job running nx affected', () => {
    // given the CI workflow
    // when collecting the jobs that run `nx affected`
    const jobs = jobsRunningAffected();

    // then the guard below has something to protect
    expect(jobs.length).toBeGreaterThan(0);
  });

  it.each(jobsRunningAffected().map(([name]) => name))(
    'should fetch the base branch in job %s',
    (name) => {
      // given a job that runs `nx affected`
      const job = loadJobs()[name];

      // when looking for the base-ref fetch
      const fetched = steps(job).filter(isBaseRefFetch);

      // then exactly one such step exists
      expect(fetched).toHaveLength(1);
    }
  );

  it.each(jobsRunningAffected().map(([name]) => name))(
    'should fetch the base branch before nx affected runs in job %s',
    (name) => {
      // given a job that runs `nx affected`
      const jobSteps = steps(loadJobs()[name]);

      // when comparing the positions of the fetch and the first affected run
      const fetchAt = jobSteps.findIndex(isBaseRefFetch);
      const affectedAt = jobSteps.findIndex(isAffectedRun);

      // then the ref exists by the time Nx needs it
      expect(fetchAt).toBeGreaterThanOrEqual(0);
      expect(fetchAt).toBeLessThan(affectedAt);
    }
  );

  it.each(jobsRunningAffected().map(([name]) => name))(
    'should limit the base-ref fetch to pull requests in job %s',
    (name) => {
      // given a job that runs `nx affected`
      const [fetch] = steps(loadJobs()[name]).filter(isBaseRefFetch);

      // when reading its condition
      // then it is scoped to pull requests — on a push to main the checked-out
      // branch IS the base, and fetching into it would fail
      expect(fetch.if).toContain('pull_request');
    }
  );
});
