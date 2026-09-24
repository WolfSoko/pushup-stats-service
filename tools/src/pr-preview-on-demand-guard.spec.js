const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');
const REQUEST_WORKFLOW = resolve(
  ROOT,
  '.github/workflows/firebase-hosting-pull-request.yml'
);
const DEPLOY_WORKFLOW = resolve(
  ROOT,
  '.github/workflows/firebase-hosting-staging-preview.yml'
);

/**
 * The staging preview deploys into the one shared staging project and runs
 * the critical-path suite against it, serialised under a concurrency group.
 * A run blocks that project for up to 50 minutes, so previews are deployed
 * on request only, in two workflows:
 *
 * - firebase-hosting-pull-request.yml posts a bot comment with a checkbox
 *   when the PR opens and, when the box is ticked (`issue_comment: edited`
 *   on the bot's own comment), verifies the request and dispatches the
 *   deploy workflow on the PR branch. It never checks out code: an
 *   `issue_comment` job runs with secrets, and a PR-head checkout there is
 *   what CodeQL's untrusted-checkout rule flags.
 * - firebase-hosting-staging-preview.yml is that `workflow_dispatch` target;
 *   it builds, deploys, runs `e2e-staging` and writes the result back into
 *   the request comment.
 *
 * These tests pin the pieces that make the handshake work — the triggers,
 * the job conditions, the marker/checkbox strings shared by both files, the
 * no-checkout rule for the privileged job and the safety steps before the
 * dispatch.
 */
const load = (file) => parse(readFileSync(file, 'utf-8'));

const isCheckout = (step) =>
  typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@');

const runOf = (step) => (typeof step.run === 'string' ? step.run : '');

const stepIndex = (job, predicate) => (job.steps ?? []).findIndex(predicate);

describe('PR preview: on-demand handshake', () => {
  const request = load(REQUEST_WORKFLOW);
  const deploy = load(DEPLOY_WORKFLOW);
  const { request_preview: requestJob, trigger_preview: triggerJob } =
    request.jobs;
  const deployJob = deploy.jobs.build_and_preview;
  const marker = request.env.PREVIEW_MARKER;
  const checkbox = request.env.PREVIEW_CHECKBOX;

  it('should share marker and checkbox strings between both workflows', () => {
    // given both workflow env blocks
    // then the deploy workflow edits the same comment the request one created
    expect(deploy.env.PREVIEW_MARKER).toBe(marker);
    expect(deploy.env.PREVIEW_CHECKBOX).toBe(checkbox);
    // and the dispatcher names the deploy workflow file that actually exists
    expect(request.env.PREVIEW_WORKFLOW).toBe(
      'firebase-hosting-staging-preview.yml'
    );
  });

  it('should only react to PR open events and comment edits', () => {
    // given the request workflow triggers
    const on = request.on;

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
    const run = requestJob.steps.map(runOf).join('\n');

    // then the body contains the marker and the checkbox the trigger job looks for
    expect(run).toContain('$PREVIEW_MARKER');
    expect(run).toContain('- [ ] $PREVIEW_CHECKBOX');
    // and the step checks for an existing comment before posting, in a
    // form that survives --paginate (ids, not a per-page count)
    expect(run).toContain('issues/$PR_NUMBER/comments');
    expect(run).toContain('contains(\\"$PREVIEW_MARKER\\")');
    expect(run).toContain('| .id');
    expect(run).toContain('if [ -n "$existing" ]');
  });

  it("should trigger only when the bot's own comment is edited with the box ticked", () => {
    // given the trigger job condition
    const condition = String(triggerJob.if);

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

  it('should never check out code in the comment-triggered job', () => {
    // given the trigger job steps
    // then no actions/checkout step exists (privileged context + PR head = untrusted checkout)
    expect(triggerJob.steps.some(isCheckout)).toBe(false);
    // and the job is allowed to dispatch workflows
    expect(triggerJob.permissions.actions).toBe('write');
  });

  it('should untick the box and verify the requester before dispatching', () => {
    // given the trigger job steps
    const untickAt = stepIndex(triggerJob, (s) =>
      runOf(s).includes('- [ ] $PREVIEW_CHECKBOX')
    );
    const dispatchAt = stepIndex(triggerJob, (s) =>
      runOf(s).includes('/actions/workflows/$PREVIEW_WORKFLOW/dispatches')
    );
    const dispatch = runOf(triggerJob.steps[dispatchAt]);

    // then both steps exist, untick first
    expect(untickAt).toBeGreaterThan(-1);
    expect(dispatchAt).toBeGreaterThan(untickAt);
    // and the dispatch step refuses fork heads and requesters without write access
    expect(dispatch).toContain('isCrossRepository');
    expect(dispatch).toContain('/permission');
    expect(dispatch.indexOf('isCrossRepository')).toBeLessThan(
      dispatch.indexOf('/dispatches')
    );
    // and the dispatched run targets the PR branch with the comment to update
    expect(dispatch).toContain('-f ref="$head_ref"');
    expect(dispatch).toContain('inputs[pr_number]=$PR_NUMBER');
    expect(dispatch).toContain('inputs[comment_id]=$COMMENT_ID');
    // and a second tick while a run is active does not dispatch again
    expect(dispatch).toContain('already_running=');
    expect(dispatch.indexOf('already_running=')).toBeLessThan(
      dispatch.indexOf('/dispatches')
    );
    // and a failed start is reported back into the comment with the actual reason
    const failureStep = triggerJob.steps.at(-1);
    expect(failureStep.if).toBe('failure()');
    expect(failureStep.env.REASON).toContain('steps.dispatch.outputs.reason');
    expect(runOf(failureStep)).toContain('issues/comments/$COMMENT_ID');
    expect(runOf(failureStep)).toContain('"$REASON"');
  });

  it('should run the deploy only via workflow_dispatch with the comment to update', () => {
    // given the deploy workflow trigger
    const { inputs } = deploy.on.workflow_dispatch;

    // then it is not started by any PR event
    expect(Object.keys(deploy.on)).toEqual(['workflow_dispatch']);
    // and the PR number is mandatory while the comment is optional (manual runs)
    expect(inputs.pr_number.required).toBe(true);
    expect(inputs.comment_id.required).toBe(false);
  });

  it('should never let a comment update fail the deploy', () => {
    // given the steps that patch the request comment
    const commentSteps = deployJob.steps.filter((s) =>
      runOf(s).includes('issues/comments/$COMMENT_ID')
    );

    // then there are the start and the result step
    expect(commentSteps).toHaveLength(2);
    // and each is skipped without a comment id and tolerates API errors
    for (const step of commentSteps) {
      expect(step.if).toContain("env.COMMENT_ID != ''");
      expect(step['continue-on-error']).toBe(true);
    }
  });

  it('should check out the dispatched branch itself, not a PR-derived ref', () => {
    // given the deploy job's checkout step
    const checkout = deployJob.steps.find(isCheckout);

    // then it exists without a ref override
    expect(checkout).toBeDefined();
    expect(checkout.with?.ref).toBeUndefined();
  });

  it('should always write the outcome back into the request comment', () => {
    // given the deploy job's last step
    const last = deployJob.steps.at(-1);

    // then it runs regardless of the job outcome and patches the comment
    expect(last.if).toContain('always()');
    expect(runOf(last)).toContain('issues/comments/$COMMENT_ID');
    expect(runOf(last)).toContain('_Status: ');
  });

  it('should keep the shared staging project serialised', () => {
    // given the deploy workflow concurrency block
    // then it is one group without cancellation
    expect(deploy.concurrency).toEqual({
      group: 'firebase-staging-preview',
      'cancel-in-progress': false,
    });
  });
});
