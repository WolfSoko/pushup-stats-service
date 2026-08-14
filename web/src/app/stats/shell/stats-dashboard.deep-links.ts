import { afterNextRender } from '@angular/core';
import type { ActivatedRoute, Router } from '@angular/router';

/**
 * Handles the dashboard's `?log=1` deep-link (notification "✅ Eintragen"
 * button) by opening the create-entry dialog. Must be called from an
 * injection context (the component constructor).
 *
 * `?quickLog=N` used to live here too. It is gone on purpose: the SW's
 * `openWindow('/app?quickLog=N')` hand-off replays. Android resumes an
 * existing PWA task instead of navigating, so the count stayed in the task's
 * committed URL and every later resume wrote another entry — including one at
 * 02:05 inside the user's quiet hours. Quick-log now travels through the
 * single-use intent store (`@pu-push/push`), which cannot replay. `?log=1` is
 * safe to keep because it only opens a dialog; nothing is persisted without a
 * further tap.
 */
export function registerDashboardDeepLinks(deps: {
  route: ActivatedRoute;
  router: Router;
  openCreateDialog: () => void;
}): void {
  afterNextRender(() => {
    const params = deps.route.snapshot.queryParamMap;
    if (params.get('log') !== '1') return;
    void deps.router.navigate([], {
      relativeTo: deps.route,
      queryParams: { log: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    deps.openCreateDialog();
  });
}
