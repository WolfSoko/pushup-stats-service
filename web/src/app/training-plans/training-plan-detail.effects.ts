import { afterRenderEffect, effect, ElementRef, Signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Route-driven side effects of the plan detail page. Both must be
 * registered from an injection context (the component constructor).
 */

/**
 * Honour an incoming `?day=<index>` query param so deep-links from the
 * dashboard's plan banner scroll to the active day after route
 * hydration. Uses `Element.scrollIntoView` (not `ViewportScroller`)
 * because the app shell wraps content in `<mat-sidenav-content>`, which
 * owns its own scroll container — `ViewportScroller` only scrolls
 * `window` and would silently no-op.
 *
 * The `?day=` param is intentionally NOT stripped after scrolling:
 * keeping it in the URL makes the deep-link bookmarkable and re-fires
 * the scroll on Back/Forward navigation, matching the `?type=` pattern
 * in the wiki pushup-types page.
 */
export function registerDayDeepLinkScroll(deps: {
  isBrowser: boolean;
  host: ElementRef<HTMLElement>;
  queryParams: Signal<{ get(key: string): string | null }>;
}): void {
  afterRenderEffect(() => {
    if (!deps.isBrowser) return;
    const raw = deps.queryParams().get('day');
    if (!raw) return;
    const target = document.getElementById(`day-${raw}`);
    if (target && deps.host.nativeElement.contains(target)) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

/**
 * Start the plan automatically when the signup flow sends the user back
 * with `?autoStart=1`.
 *
 * Defense-in-depth: even with that param (only ever set by the signup
 * flow), refuse to silently replace a *different* active plan — force
 * the user through the manual flow that surfaces the replacement
 * warning. It also waits until the active-plan resource has emitted at
 * least once: during the initial-fetch window `!isThisPlanActive()` is
 * true even for a plan that's already active, and we'd race the
 * listener and overwrite it.
 */
export function registerAutoStart(deps: {
  snackbar: MatSnackBar;
  queryParams: Signal<{ get(key: string): string | null }>;
  hasPlan: Signal<boolean>;
  isThisPlanActive: Signal<boolean>;
  authResolved: Signal<boolean>;
  isAuthenticated: Signal<boolean>;
  hasActivePlan: Signal<boolean>;
  activePlanLoaded: Signal<boolean>;
  start: () => Promise<void>;
}): void {
  let triggered = false;
  effect(() => {
    const wantsAutoStart = deps.queryParams().get('autoStart') === '1';
    const wouldReplaceDifferentPlan =
      deps.hasActivePlan() && !deps.isThisPlanActive();
    if (
      !deps.hasPlan() ||
      !wantsAutoStart ||
      !deps.authResolved() ||
      !deps.isAuthenticated() ||
      !deps.activePlanLoaded() ||
      deps.isThisPlanActive() ||
      wouldReplaceDifferentPlan ||
      triggered
    ) {
      return;
    }
    // The flag stays set to prevent a tight retry loop inside this
    // component instance — a manual reload re-attempts because
    // `?autoStart=1` stays in the URL until a successful start clears it.
    triggered = true;
    deps.start().catch((error) => {
      console.error('Auto-start failed', error);
      deps.snackbar.open(
        $localize`:@@trainingPlans.autoStartFailed:Plan-Start fehlgeschlagen — bitte erneut versuchen.`,
        undefined,
        { duration: 4000 }
      );
    });
  });
}
