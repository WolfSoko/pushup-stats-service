const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');
const PREVIEW_WORKFLOW = resolve(
  ROOT,
  '.github/workflows/firebase-hosting-pull-request.yml'
);

/**
 * The staging preview deploys into the one shared staging project and runs
 * the critical-path suite against it, serialised under a concurrency group.
 * A run blocks that project for up to 50 minutes, so previews are deployed
 * on request only: a bot comment with a checkbox is posted when the PR
 * opens, ticking the box fires `issue_comment: edited`, and only that event
 * (from the bot's own comment, with the box ticked) starts the deploy job.
 *
 * These tests pin the pieces that make the handshake work — the triggers,
 * both job conditions, the marker/checkbox strings used on both ends, and
 * the safety steps that run before the PR head is checked out.
 */
function loadWorkflow() {
  return parse(readFileSync(PREVIEW_WORKFLOW, 'utf-8'));
}

function stepIndex(job, predicate) {
  return (job.steps ?? []).findIndex(predicate);
}

const isCheckout = (step) =>
  typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@');

describe('PR preview: on-demand handshake', () => {
  const workflow = loadWorkflow();
  const { request_preview: requestJob, build_and_preview: deployJob } =
    workflow.jobs;
  const marker = workflow.env.PREVIEW_MARKER;
  const checkbox = workflow.env.PREVIEW_CHECKBOX;

  it('should only react to PR open events and comment edits', () => {
    // given the workflow triggers
    const on = workflow.on;

    // then no pull_request type other than open/reopen starts a run
    expect(on.pull_request.types).toEqual(['opened', 'reopened']);
    // and the checkbox toggle arrives as a comment edit
    expect(on.issue_comment.types).toEqual(['edited']);
  });

  it('should post the request comment only for same-repo, non-Dependabot PRs', () => {
    // given the request job condition
    const condition = String(requestJob.if);

    // then it is bound to the pull_request event
    expect(condition).toContain("github.event_name == 'pull_request'");
    // and excludes fork PRs
    expect(condition).toContain(
      'github.event.pull_request.head.repo.full_name == github.repository'
    );
    // and excludes Dependabot PRs
    expect(condition).toContain(
      "github.event.pull_request.user.login != 'dependabot[bot]'"
    );
  });

  it('should post a comment carrying the marker and an unticked checkbox', () => {
    // given the comment step
    const run = requestJob.steps.map((s) => s.run ?? '').join('\n');

    // then the body contains the marker and the checkbox the deploy job looks for
    expect(run).toContain('$PREVIEW_MARKER');
    expect(run).toContain('- [ ] $PREVIEW_CHECKBOX');
    // and the step checks for an existing comment before posting
    expect(run).toContain('issues/$PR_NUMBER/comments');
    expect(run).toContain('contains(\\"$PREVIEW_MARKER\\")');
  });

  it("should deploy only when the bot's own comment is edited with the box ticked", () => {
    // given the deploy job condition
    const condition = String(deployJob.if);

    // then it is bound to comment edits on pull requests
    expect(condition).toContain("github.event_name == 'issue_comment'");
    expect(condition).toContain('github.event.issue.pull_request');
    // and only the bot's own comment counts
    expect(condition).toContain(
      "github.event.comment.user.login == 'github-actions[bot]'"
    );
    // and the literal strings in the condition match the env the comment is built from
    expect(condition).toContain(
      `contains(github.event.comment.body, '${marker}')`
    );
    expect(condition).toContain(
      `contains(github.event.comment.body, '- [x] ${checkbox}')`
    );
  });

  it('should untick the box and verify the requester before checking out the PR head', () => {
    // given the deploy job steps
    const checkoutAt = stepIndex(deployJob, isCheckout);
    const untickAt = stepIndex(
      deployJob,
      (s) =>
        typeof s.run === 'string' && s.run.includes('- [ ] $PREVIEW_CHECKBOX')
    );
    const resolveAt = stepIndex(
      deployJob,
      (s) =>
        typeof s.run === 'string' &&
        s.run.includes('isCrossRepository') &&
        s.run.includes('/permission')
    );

    // then all three steps exist
    expect(checkoutAt).toBeGreaterThan(-1);
    expect(untickAt).toBeGreaterThan(-1);
    expect(resolveAt).toBeGreaterThan(-1);
    // and the untick + fork/permission checks run before foreign code is checked out
    expect(untickAt).toBeLessThan(checkoutAt);
    expect(resolveAt).toBeLessThan(checkoutAt);
    // and the checkout targets the resolved head SHA, not the default branch
    expect(deployJob.steps[checkoutAt].with.ref).toBe(
      '${{ steps.pr.outputs.sha }}'
    );
  });

  it('should always write the outcome back into the request comment', () => {
    // given the deploy job's last step
    const last = deployJob.steps.at(-1);

    // then it runs regardless of the job outcome and patches the comment
    expect(last.if).toBe('always()');
    expect(last.run).toContain('issues/comments/$COMMENT_ID');
    expect(last.run).toContain('_Status: ');
  });

  it('should keep the shared staging project serialised', () => {
    // given the workflow concurrency block
    // then it is one group without cancellation
    expect(workflow.concurrency).toEqual({
      group: 'firebase-staging-preview',
      'cancel-in-progress': false,
    });
  });
});
