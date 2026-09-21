const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');
const PREVIEW_WORKFLOW = resolve(
  ROOT,
  '.github/workflows/firebase-hosting-pull-request.yml'
);

/**
 * The PR preview workflow deploys to the one shared staging project and runs
 * the critical-path suite against it, serialised under a concurrency group.
 * Dependabot opens a PR per dependency bump; letting each of them take that
 * slot queues every real PR behind deploys nobody looks at. The job's `if`
 * therefore skips Dependabot-authored PRs, next to the existing same-repo
 * guard for fork PRs.
 */
function loadPreviewJob() {
  return parse(readFileSync(PREVIEW_WORKFLOW, 'utf-8')).jobs.build_and_preview;
}

describe('PR preview: Dependabot gate', () => {
  it('should skip the preview deployment for Dependabot PRs', () => {
    // given the build_and_preview job
    const job = loadPreviewJob();

    // when reading its condition
    const condition = String(job.if);

    // then it excludes PRs authored by dependabot[bot]
    expect(condition).toContain(
      "github.event.pull_request.user.login != 'dependabot[bot]'"
    );
  });

  it('should keep the same-repo guard for fork PRs', () => {
    // given the build_and_preview job
    const job = loadPreviewJob();

    // when reading its condition
    const condition = String(job.if);

    // then fork PRs are still excluded
    expect(condition).toContain(
      'github.event.pull_request.head.repo.full_name == github.repository'
    );
  });
});
