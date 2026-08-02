import { afterNextRender } from '@angular/core';
import type { ActivatedRoute, Router } from '@angular/router';
import { QUICK_LOG_REPS_MAX, QUICK_LOG_REPS_MIN } from '@pu-stats/models';

/**
 * Handles the dashboard's two notification deep-links. Must be called
 * from an injection context (the component constructor).
 *
 *   - `?log=1`      → open the create-entry dialog
 *   - `?quickLog=N` → silently log N pushups (notification button click
 *                     when no app tab was open — see sw-push handlers)
 *
 * `quickLog` arrives via URL and is therefore untrusted: clamp into the
 * configured `[QUICK_LOG_REPS_MIN, QUICK_LOG_REPS_MAX]` range so a tampered
 * link can't persist absurd entries (CodeRabbit/Copilot/Codex P1, PR #249).
 *
 * Snooze always wins: if `?snooze=N` is also present, the user explicitly
 * snoozed and did NOT want to log push-ups in this navigation. Skip both
 * deep-links so a combined or stale URL can never silently create an entry
 * alongside the snooze — App.ts consumes the snooze param separately.
 */
export function registerDashboardDeepLinks(deps: {
  route: ActivatedRoute;
  router: Router;
  openCreateDialog: () => void;
  quickLog: (reps: number) => void;
}): void {
  afterNextRender(() => {
    const params = deps.route.snapshot.queryParamMap;
    if (params.has('snooze')) return;
    const raw = params.get('quickLog');
    const quickReps = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(quickReps) && quickReps >= QUICK_LOG_REPS_MIN) {
      clearParam(deps, 'quickLog');
      deps.quickLog(Math.min(Math.floor(quickReps), QUICK_LOG_REPS_MAX));
      return;
    }
    if (params.get('log') === '1') {
      clearParam(deps, 'log');
      deps.openCreateDialog();
    }
  });
}

function clearParam(
  deps: { route: ActivatedRoute; router: Router },
  key: string
): void {
  void deps.router.navigate([], {
    relativeTo: deps.route,
    queryParams: { [key]: null },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
