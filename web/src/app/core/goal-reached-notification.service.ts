import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  Signal,
  untracked,
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { SNAP_QUALITY_PARTICLES } from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';
import type { GoalKind } from '../stats/components/goal-reached-dialog/goal-reached-dialog.component';
import { TrainingPlanStore } from '../training-plans/training-plan.store';
import { UserConfigStore } from './user-config.store';

interface GoalSpec {
  readonly kind: GoalKind;
  readonly goal: Signal<number>;
  readonly total: Signal<number>;
  readonly periodKey: Signal<string>;
}

const STORAGE_PREFIX = 'pus_goal_reached_';
// Monotonic counter so concurrent dialogs (daily + weekly + monthly all
// crossing on the same entry) get unique titleId DOM ids.
let nextDialogTitleId = 0;

/**
 * App-wide trigger for the goal-reached celebration dialog.
 *
 * Scoped at root so the dialog fires regardless of which page the user is on
 * when the goal is reached. State is persisted in `localStorage` keyed by
 * goal kind + period key (Berlin TZ), so each daily/weekly/monthly goal only
 * triggers the celebration once per period — not every time the user
 * navigates back to a page that watches the same signal.
 */
@Injectable({ providedIn: 'root' })
export class GoalReachedNotificationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(MatDialog);
  private readonly userConfig = inject(UserConfigStore);
  private readonly live = inject(LiveDataStore);
  private readonly trainingPlan = inject(TrainingPlanStore);

  // Post-cutover pushups live in `exerciseEntries` (`exerciseId:'pushup'`).
  // Only the legacy daily/weekly/monthly goals tracked here are pushup-reps.
  private readonly entries = computed<{ timestamp: string; reps: number }[]>(
    () =>
      this.live
        .exerciseEntries()
        .filter((e) => e.exerciseId === 'pushup')
        .map((e) => ({ timestamp: e.timestamp, reps: e.reps ?? 0 }))
  );

  /**
   * Berlin-localised "today" key. Reading `entries()` here ties the key to
   * the live data signal, so that — in a long-running PWA session that
   * crosses midnight — the key recomputes the next time a Firestore entry
   * update arrives. Without this dependency `todayBerlin` would cache day 1
   * forever and the dialog would never re-fire on day 2.
   */
  private readonly todayBerlin = computed(() => {
    this.entries();
    return toBerlinIsoDate(new Date());
  });

  private readonly todayTotal = computed(() => {
    const today = this.todayBerlin();
    return this.entries()
      .filter((entry) => entryBerlinDate(entry.timestamp) === today)
      .reduce((sum, entry) => sum + entry.reps, 0);
  });

  private readonly currentWeekKey = computed(() =>
    isoWeekKey(this.todayBerlin())
  );

  private readonly weekRange = computed(() => weekRange(this.todayBerlin()));

  private readonly weekTotal = computed(() => {
    const { from, to } = this.weekRange();
    return this.entries()
      .filter((entry) => {
        const day = entryBerlinDate(entry.timestamp);
        return day >= from && day <= to;
      })
      .reduce((sum, entry) => sum + entry.reps, 0);
  });

  private readonly currentMonthKey = computed(() =>
    this.todayBerlin().slice(0, 7)
  );

  private readonly monthTotal = computed(() => {
    const prefix = this.currentMonthKey();
    return this.entries()
      .filter((entry) => entryBerlinDate(entry.timestamp).startsWith(prefix))
      .reduce((sum, entry) => sum + entry.reps, 0);
  });

  /**
   * Today's training-plan target — only when a plan is active and today
   * is a non-rest day. Decoupled from the dashboard's `planTodayTarget`
   * computed so this service stays usable on pages that don't load the
   * dashboard store.
   */
  private readonly planTodayTarget = computed(() => {
    if (!this.trainingPlan.hasActivePlan()) return 0;
    const day = this.trainingPlan.todayDay();
    if (!day || day.kind === 'rest') return 0;
    return day.targetReps;
  });

  /**
   * Plan-goal threshold. Fires whenever the plan's daily target is
   * reached, with one exception: when a configured daily goal already
   * covers the plan target (daily ≥ plan), the daily celebration is
   * enough and we suppress the plan dialog to avoid a near-duplicate.
   *
   * Users with only a plan (no configured daily goal) get the plan
   * dialog as their primary celebration — the toolbar pill labels the
   * plan target as the "Tagesziel", so reaching it deserves a snap.
   *
   * Gated on `userConfig.loaded()` so the resource's initial loading
   * state (where `dailyGoal()` is `0` before the first emission) can't
   * be mistaken for a user who genuinely has no configured daily goal.
   */
  private readonly planGoal = computed(() => {
    const planTarget = this.planTodayTarget();
    if (planTarget <= 0) return 0;
    if (!this.userConfig.loaded()) return 0;
    const daily = this.userConfig.dailyGoal();
    if (daily > 0 && daily >= planTarget) return 0;
    return planTarget;
  });

  private readonly specs: readonly GoalSpec[] = [
    {
      kind: 'daily',
      goal: computed(() => this.userConfig.dailyGoal()),
      total: this.todayTotal,
      periodKey: this.todayBerlin,
    },
    {
      kind: 'weekly',
      goal: computed(() => this.userConfig.weeklyGoal()),
      total: this.weekTotal,
      periodKey: this.currentWeekKey,
    },
    {
      kind: 'monthly',
      goal: computed(() => this.userConfig.monthlyGoal()),
      total: this.monthTotal,
      periodKey: this.currentMonthKey,
    },
    {
      kind: 'plan',
      goal: this.planGoal,
      total: this.todayTotal,
      periodKey: this.todayBerlin,
    },
  ];

  private readonly opened = new Set<string>();
  /**
   * Per-kind dedupe for live dialog instances. Without it, rapid clicks /
   * held Enter on the toolbar pill (or two near-simultaneous goal crossings
   * on the same kind) would stack overlays and trap focus inside the
   * top-most one. We cap at one open dialog per kind; the second trigger
   * silently no-ops while the first is still on screen.
   */
  private readonly activeDialogs = new Map<GoalKind, MatDialogRef<unknown>>();
  /**
   * Last-seen goal value per kind. Used to detect upward changes so that an
   * earlier "shown" flag for the current period is cleared — otherwise the
   * user would never see a celebration after raising the bar mid-period.
   * Initialised to 0 so the very first effect run (resource load) is treated
   * as a no-op rather than an upward change.
   */
  private readonly previousGoals: Record<GoalKind, number> = {
    daily: 0,
    weekly: 0,
    monthly: 0,
    plan: 0,
  };

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    // Drop stale period flags from previous days/weeks/months on every app
    // start. Without this, localStorage accumulates `pus_goal_reached_*` keys
    // forever, and a clock skew or formatting drift could falsely match an
    // old key on a new day — exactly the "dialog never re-fires on day 2"
    // class of bug.
    pruneStalePeriodFlags(toBerlinIsoDate(new Date()));
    for (const spec of this.specs) {
      // Order matters: the increase watcher is registered before the
      // goal-reached watcher so that, when both fire on a single goal raise,
      // the flag is cleared first and the goal-reached effect sees fresh state.
      this.watchGoalIncrease(spec);
      this.watch(spec);
    }
  }

  private watchGoalIncrease(spec: GoalSpec): void {
    effect(() => {
      const newGoal = spec.goal();
      const prev = this.previousGoals[spec.kind];
      this.previousGoals[spec.kind] = newGoal;
      // Skip the initial 0 → N transition (config first-load, not a raise).
      if (prev <= 0) return;
      if (newGoal <= prev) return;
      const key = `${STORAGE_PREFIX}${spec.kind}_${untracked(() =>
        spec.periodKey()
      )}`;
      this.opened.delete(key);
      clearFlag(key);
    });
  }

  private watch(spec: GoalSpec): void {
    effect(() => {
      const goal = spec.goal();
      if (goal <= 0) return;
      const total = spec.total();
      if (total < goal) return;
      const key = `${STORAGE_PREFIX}${spec.kind}_${spec.periodKey()}`;
      if (this.opened.has(key)) return;
      if (readFlag(key)) {
        this.opened.add(key);
        return;
      }
      this.opened.add(key);
      writeFlag(key);
      const maxParticleCount =
        SNAP_QUALITY_PARTICLES[this.userConfig.snapQuality()];
      untracked(() =>
        this.openDialog(spec.kind, { total, goal, maxParticleCount })
      );
    });
  }

  private async openDialog(
    kind: GoalKind,
    snapshot: { total: number; goal: number; maxParticleCount: number }
  ): Promise<void> {
    if (this.activeDialogs.has(kind)) return;
    const { GoalReachedDialogComponent } =
      await import('../stats/components/goal-reached-dialog/goal-reached-dialog.component');
    // Re-check after the dynamic import resolves: an auto-fire effect and
    // a manual reopen() can race across the await, and we still only want
    // one dialog per kind.
    if (this.activeDialogs.has(kind)) return;
    const titleId = `goal-reached-dialog-title-${nextDialogTitleId++}`;
    const ref = this.dialog.open(GoalReachedDialogComponent, {
      panelClass: 'goal-reached-dialog-panel',
      backdropClass: 'goal-reached-dialog-backdrop',
      autoFocus: 'dialog',
      restoreFocus: true,
      ariaLabelledBy: titleId,
      width: 'min(92vw, 460px)',
      maxWidth: '92vw',
      data: {
        kind,
        total: snapshot.total,
        goal: snapshot.goal,
        titleId,
        maxParticleCount: snapshot.maxParticleCount,
      },
    });
    this.activeDialogs.set(kind, ref);
    ref.afterClosed().subscribe(() => {
      this.activeDialogs.delete(kind);
    });
  }

  /**
   * Manually re-open the celebration dialog for a goal that has already
   * been reached this period. Used by the toolbar "Tagesziel" pill so the
   * user can replay the snap animation on demand.
   *
   * Bypasses the per-period `opened` / localStorage gating — that gate
   * suppresses the auto-fire during navigation, not intentional re-opens.
   * Silently no-ops when the goal isn't configured or hasn't been reached.
   */
  reopen(kind: GoalKind): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const spec = this.specs.find((s) => s.kind === kind);
    if (!spec) return;
    const goal = spec.goal();
    if (goal <= 0) return;
    const total = spec.total();
    if (total < goal) return;
    const maxParticleCount =
      SNAP_QUALITY_PARTICLES[this.userConfig.snapQuality()];
    void this.openDialog(kind, { total, goal, maxParticleCount });
  }

  /**
   * Replay the celebration matching the toolbar "Tagesziel" pill. The
   * pill displays the plan target when a plan is active (effective
   * daily-goal semantics in `AppDataFacade`), so prefer 'plan' when
   * it's the relevant dialog and fall back to 'daily' otherwise. No-op
   * when neither has been reached.
   */
  reopenPrimaryGoal(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    for (const kind of ['plan', 'daily'] as const) {
      const spec = this.specs.find((s) => s.kind === kind);
      if (!spec) continue;
      const goal = spec.goal();
      if (goal <= 0) continue;
      if (spec.total() < goal) continue;
      this.reopen(kind);
      return;
    }
  }
}

/**
 * Convert a Firestore-stored ISO timestamp to its Berlin-localised date key.
 *
 * Two timestamp shapes appear in production:
 *   - Naive (`YYYY-MM-DDTHH:mm[:ss]`) — written by older quick-add entries
 *     that the backend treats as Berlin local time. We must NOT round-trip
 *     these through `new Date()`, because that parses them in the device's
 *     local timezone and shifts the day on devices not in `Europe/Berlin`.
 *     The Cloud Function's bucketing logic also uses the literal date prefix.
 *   - TZ-aware (`...Z` or `...±HH:mm`) — written by `createPushup` via
 *     `new Date().toISOString()`. We convert these via the Berlin formatter
 *     so that an entry made at 00:30 Berlin (== 22:30 UTC the prior day)
 *     counts toward today and not yesterday.
 */
function entryBerlinDate(timestamp: string): string {
  if (HAS_TIMEZONE.test(timestamp)) {
    return toBerlinIsoDate(new Date(timestamp));
  }
  return timestamp.slice(0, 10);
}

const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;

function pruneStalePeriodFlags(todayBerlin: string): void {
  // Touching `globalThis.localStorage` itself can throw `SecurityError` in
  // sandboxed/opaque origins or with storage disabled (Safari private mode,
  // some embedded webviews). Wrap the whole access — not just the read loop —
  // so cleanup stays best-effort and never breaks app startup.
  try {
    const ls = globalThis.localStorage;
    if (!ls) return;
    const validKeys = new Set([
      `${STORAGE_PREFIX}daily_${todayBerlin}`,
      `${STORAGE_PREFIX}weekly_${isoWeekKey(todayBerlin)}`,
      `${STORAGE_PREFIX}monthly_${todayBerlin.slice(0, 7)}`,
      `${STORAGE_PREFIX}plan_${todayBerlin}`,
    ]);
    const stale: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && !validKeys.has(key)) {
        stale.push(key);
      }
    }
    for (const key of stale) ls.removeItem(key);
  } catch {
    // localStorage unavailable / SecurityError — best-effort cleanup only.
  }
}

function readFlag(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    globalThis.localStorage?.setItem(key, '1');
  } catch {
    // localStorage unavailable — best-effort; in-memory `opened` set still
    // suppresses repeat triggers for the lifetime of the session.
  }
}

function clearFlag(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // localStorage unavailable — nothing to clear.
  }
}

function isoWeekKey(berlinDate: string): string {
  const [y, m, day] = berlinDate.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setHours(0, 0, 0, 0);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + 3 - weekday);
  const isoYear = d.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  firstThursday.setHours(0, 0, 0, 0);
  const ftDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() + 3 - ftDay);
  const week =
    1 +
    Math.round(
      (d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function weekRange(berlinDate: string): { from: string; to: string } {
  const [y, m, day] = berlinDate.split('-').map(Number);
  const todayDate = new Date(y, m - 1, day);
  const dayOfWeek = (todayDate.getDay() + 6) % 7;
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - dayOfWeek);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: ymd(monday), to: ymd(sunday) };
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
