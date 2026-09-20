const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');
const CI_WORKFLOW = resolve(ROOT, '.github/workflows/ci.yml');

/**
 * `nx affected` needs a resolvable base revision. `nrwl/nx-set-shas` normally
 * supplies one via NX_BASE/NX_HEAD, but when it comes back empty Nx falls back
 * to `defaultBase` — absent from nx.json, so its built-in `main`. In a
 * pull-request checkout `main` is not a local ref: `actions/checkout` only
 * fetches the PR ref, and `fetch-depth: 0` deepens history without creating a
 * second branch ref. The fallback then dies with "fatal: ambiguous argument
 * 'main'" before a single target runs, which reads like a test failure but is
 * a checkout gap.
 *
 * Each job that runs `nx affected` therefore fetches its own base ref and, if
 * the action stayed silent, points NX_BASE at it. Fetching alone would not do:
 * Nx's fallback names `main`, which is both unresolvable and — for a PR
 * against any other branch — the wrong base to diff against.
 *
 * These tests keep both steps in place, ordered ahead of the affected run, and
 * keep the branch name out of the shell command itself.
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
    step.run.includes('BASE_REF')
  );
}

function isNxBaseFallback(step) {
  return typeof step.run === 'string' && step.run.includes('NX_BASE=');
}

function jobsRunningAffected() {
  return Object.entries(loadJobs()).filter(([, job]) =>
    steps(job).some(isAffectedRun)
  );
}

const AFFECTED_JOBS = jobsRunningAffected().map(([name]) => name);

describe('CI: base ref for nx affected', () => {
  it('should find at least one job running nx affected', () => {
    // given the CI workflow
    // when collecting the jobs that run `nx affected`
    const jobs = jobsRunningAffected();

    // then the guards below have something to protect
    expect(jobs.length).toBeGreaterThan(0);
  });

  it.each(AFFECTED_JOBS)('should fetch the base branch in job %s', (name) => {
    // given a job that runs `nx affected`
    const job = loadJobs()[name];

    // when looking for the base-ref fetch
    const fetched = steps(job).filter(isBaseRefFetch);

    // then exactly one such step exists
    expect(fetched).toHaveLength(1);
  });

  it.each(AFFECTED_JOBS)(
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

  it.each(AFFECTED_JOBS)(
    'should limit the base-ref handling to pull requests in job %s',
    (name) => {
      // given the steps that handle the base ref
      const handling = steps(loadJobs()[name]).filter(
        (step) => isBaseRefFetch(step) || isNxBaseFallback(step)
      );

      // when reading their conditions
      // then both are scoped to pull requests — on a push to main the
      // checked-out branch IS the base, and fetching into it would fail
      expect(handling.length).toBeGreaterThan(0);
      for (const step of handling) {
        expect(step.if).toContain('pull_request');
      }
    }
  );

  it.each(AFFECTED_JOBS)(
    'should point NX_BASE at the PR base when nx-set-shas is silent in job %s',
    (name) => {
      // given a job that runs `nx affected`
      const jobSteps = steps(loadJobs()[name]);

      // when looking for the NX_BASE fallback
      const [fallback] = jobSteps.filter(isNxBaseFallback);
      const fallbackAt = jobSteps.findIndex(isNxBaseFallback);
      const affectedAt = jobSteps.findIndex(isAffectedRun);

      // then it runs before the affected command and only when the action
      // left NX_BASE empty — its SHA from the last green run is the better
      // base, so it must win when it has one
      expect(fallback).toBeDefined();
      expect(fallback.if).toContain("env.NX_BASE == ''");
      expect(fallbackAt).toBeLessThan(affectedAt);
    }
  );

  it.each(AFFECTED_JOBS)(
    'should pass the branch name through the environment in job %s',
    (name) => {
      // given the steps that handle the base ref
      const handling = steps(loadJobs()[name]).filter(
        (step) => isBaseRefFetch(step) || isNxBaseFallback(step)
      );

      // when checking how the branch name reaches the shell
      // then via env, never interpolated — git allows `$`, backticks and `;`
      // in ref names, so `${{ }}` inside a run block is an injection surface
      for (const step of handling) {
        expect(step.run).not.toContain('${{');
        expect(step.env?.BASE_REF).toBe('${{ github.base_ref }}');
      }
    }
  );
});
