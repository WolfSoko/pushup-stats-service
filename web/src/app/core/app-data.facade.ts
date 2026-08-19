import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { UserContextService } from '@pu-auth/auth';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  type ComplexGoalEntry,
  complexGoalAppliesOnWeekday,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  type QuickAddConfig,
} from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';
import {
  AdaptiveQuickAddService,
  type QuickAddSuggestion,
} from '@pu-stats/quick-add';
import { PlanGoalsService } from './plan-goals.service';
import { UserConfigStore } from './user-config.store';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import {
  aggregateGoalPercent,
  allGoalsReached,
  type DailyGoalItemView,
  dailyGoalItemViews,
  goalProgressValues,
} from './daily-goal.helpers';

function configuredSuggestion(
  cfg: QuickAddConfig,
  slot: number
): QuickAddSuggestion {
  const exerciseId = cfg.exerciseId ?? PUSHUP_QUICK_ADD_EXERCISE_ID;
  const exerciseLabel = exerciseDisplayName(exerciseId);
  return {
    key: `slot:${slot}`,
    reps: cfg.reps,
    label: `+${cfg.reps} ${exerciseLabel}`,
    ariaLabel: $localize`:@@quickAdd.fab.exerciseRepAria:${cfg.reps}:REPS: ${exerciseLabel}:EXERCISE: hinzufügen`,
    exerciseId,
  };
}

/**
 * Facade that consolidates app-level data resources.
 *
 * In the browser the facade derives all entry-based signals from
 * `LiveDataStore.entries()` so Firestore real-time updates propagate to
 * consumers without an explicit reload. The REST `resource()`s are kept as
 * SSR / cold-start fallbacks and reloaded on mutation only to keep the SSR
 * cache warm.
 */
@Injectable({ providedIn: 'root' })
export class AppDataFacade {
  private readonly user = inject(UserContextService);
  private readonly adaptiveQuickAdd = inject(AdaptiveQuickAddService);
  private readonly userConfig = inject(UserConfigStore);
  private readonly planGoals = inject(PlanGoalsService);
  private readonly live = inject(LiveDataStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Last 7 days of pushup entries — derived live from Firestore in the browser. */
  private readonly recentEntries = computed<
    { timestamp: string; reps: number }[]
  >(() => {
    if (this.isBrowser && this.live.connected()) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoff = sevenDaysAgo.toISOString().slice(0, 10);
      return this.live
        .exerciseEntries()
        .filter(
          (e) => e.exerciseId === 'pushup' && e.timestamp.slice(0, 10) >= cutoff
        )
        .map((e) => ({ timestamp: e.timestamp, reps: e.reps ?? 0 }));
    }
    return [];
  });

  readonly quickAddSuggestions = computed<QuickAddSuggestion[]>(() => {
    const configured = this.userConfig.quickAdds();
    if (configured.length > 0) {
      // SpeedDial FAB only knows fixed-reps `quickAdd(n)` so we must
      // exclude auto-count rows (they persist `reps: 0` as a sentinel —
      // see `QuickAddConfigDialogComponent.save`). Defends in depth
      // against legacy configs that still carry `inSpeedDial: true`
      // alongside `mode: 'auto-count'`.
      return configured
        .filter((q) => q.inSpeedDial && q.mode !== 'auto-count' && q.reps > 0)
        .slice(0, 3)
        .map((cfg, i) => configuredSuggestion(cfg, i));
    }
    return this.adaptiveQuickAdd.compute(this.recentEntries()).map((reps, i) =>
      configuredSuggestion(
        {
          reps,
          inSpeedDial: true,
          exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
          mode: 'reps',
        },
        i
      )
    );
  });

  /**
   * Today's prescribed plan reps. Mirrors the dashboard's
   * `planTodayTarget` so the toolbar pill and Quick-Add fill button
   * reflect the plan target the moment a plan is activated, without
   * waiting for a manual config edit.
   */
  private readonly planTodayTarget = this.planGoals.targetReps;

  /** Today's plan day as goal entries — empty when no plan applies. */
  private readonly planTodayGoalEntries = this.planGoals.entries;

  /**
   * Plan target if available, otherwise the user-configured goal. Kept
   * without the `|| 100` fallback so `remainingToGoal` and `goalReached`
   * can distinguish "no goal configured" from "goal of 100".
   */
  private readonly effectiveDailyGoal = computed(
    () => this.planTodayTarget() || this.userConfig.dailyGoal()
  );

  readonly dailyGoal = computed(() => this.effectiveDailyGoal() || 100);

  readonly todayProgress = computed(() => {
    if (this.isBrowser && this.live.connected()) {
      const berlinToday = toBerlinIsoDate(new Date());
      return this.live
        .exerciseEntries()
        .filter(
          (e) =>
            e.exerciseId === 'pushup' &&
            e.timestamp.slice(0, 10) === berlinToday
        )
        .reduce((sum, e) => sum + (e.reps ?? 0), 0);
    }
    return 0;
  });

  readonly remainingToGoal = computed(() =>
    Math.max(0, this.effectiveDailyGoal() - this.todayProgress())
  );

  readonly goalReached = computed(() => {
    // Where goals are scored per exercise, "reached" means every
    // applicable one has hit its individual target — comparing the
    // rep-sum to the pushup-only `todayProgress` would let the snap fire
    // after just doing pushups even if Squats/Plank/Running were never
    // touched.
    if (this.perExerciseGoals()) {
      return this.dailyGoalsAllReached();
    }
    const goal = this.effectiveDailyGoal();
    return goal > 0 && this.todayProgress() >= goal;
  });

  /**
   * Today's complex goal entries, filtered by the current weekday. An
   * active plan day keeps superseding the user's complex goals — every
   * exercise it prescribes becomes a goal so the toolbar stays focused
   * on the prescribed plan workout.
   */
  readonly todayGoalEntries = computed<ComplexGoalEntry[]>(() => {
    const planEntries = this.planTodayGoalEntries();
    if (planEntries.length > 0) return planEntries;
    // Use the Berlin date for the weekday, matching `todayProgress` and the
    // rest of the facade. `new Date().getDay()` would read the user's local
    // timezone — for clients west of Berlin, a Saturday-night entry would
    // be aggregated against Sunday's goal list (or vice versa) and the
    // wrong weekday filter would apply on the day boundary.
    const berlinToday = toBerlinIsoDate(new Date());
    const weekday = new Date(`${berlinToday}T00:00:00Z`).getUTCDay();
    return this.userConfig
      .dailyGoalEntries()
      .filter((entry) => complexGoalAppliesOnWeekday(entry, weekday));
  });

  /**
   * Per-entry progress in the entry's native unit. Reps come from the live
   * pushup feed for the pushup sentinel, and from `exerciseEntries` for
   * everything else. Time and distance goals aggregate the matching
   * companion field. Falls back to 0 outside the browser (SSR has no live
   * exerciseEntries feed and the pre-fetched stats only cover pushups).
   *
   * Plan goals are scored by the plan itself instead: their progress has
   * to honour manual tick-offs and the `checkoff` days that are decided
   * by nothing else, which entries alone can't express.
   */
  readonly todayGoalProgress = computed<readonly number[]>(() => {
    const entries = this.todayGoalEntries();
    if (entries.length === 0) return [];
    if (this.planTodayGoalEntries().length > 0) {
      return this.planGoals.progress();
    }
    const berlinToday = toBerlinIsoDate(new Date());
    const pushupRepsToday = this.todayProgress();
    if (!this.isBrowser || !this.live.connected()) {
      // SSR / no-live fallback: only the pushup-sentinel goal can be
      // resolved (`todayProgress` is the pushup total). Other measurement
      // types stay at 0 until the live feed mounts in the browser.
      return entries.map((e) =>
        e.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID ? pushupRepsToday : 0
      );
    }
    // Post-cutover pushups live in `exerciseEntries` (`exerciseId:'pushup'`)
    // like every other exercise, so the generic scoring handles them —
    // no pushup short-circuit needed.
    return goalProgressValues(
      entries,
      this.live
        .exerciseEntries()
        .filter((e) => e.timestamp.slice(0, 10) === berlinToday)
    );
  });

  /**
   * True when the user explicitly opted into the new goals page (the
   * Firestore doc carries the `goals` field). Drives the toolbar's
   * choice between the legacy `X / Y` rep display and the aggregated
   * `X%` view — legacy users keep their familiar pill until they
   * configure complex goals themselves.
   */
  readonly complexGoalsEnabled = this.userConfig.goalsConfigured;

  /**
   * Whether today's goals are scored per exercise rather than as a
   * single pushup-rep ratio. True once the user opted into the goals
   * page, or the active plan day prescribes anything beyond a lone
   * pushup target: the `X / Y` reps display would hide the other
   * exercises of a circuit day, and would count pushup reps against a
   * target in seconds or metres on a day that prescribes neither.
   */
  readonly perExerciseGoals = computed(() => {
    if (this.complexGoalsEnabled()) return true;
    const plan = this.planTodayGoalEntries();
    return (
      plan.length > 1 ||
      plan.some((entry) => entry.exerciseId !== PUSHUP_QUICK_ADD_EXERCISE_ID)
    );
  });

  /**
   * Aggregated 0–100 daily-goal completion percentage across all
   * configured exercises (averaged, capped per-entry at 100% so a
   * blown-out single goal can't mask the others). Returns 0 when no
   * goals apply today.
   */
  readonly dailyGoalAggregatedPercent = computed(() =>
    aggregateGoalPercent(this.todayGoalEntries(), this.todayGoalProgress())
  );

  /**
   * True iff every configured exercise reached its target today. Used by
   * the toolbar pill to flag "click to replay snap animation".
   */
  readonly dailyGoalsAllReached = computed(() =>
    allGoalsReached(this.todayGoalEntries(), this.todayGoalProgress())
  );

  /**
   * Per-exercise breakdown of today's daily goals for the dashboard card
   * and the toolbar pill dropdown: exercise name, formatted progress and
   * target in the goal's native unit, and the per-entry completion share
   * (capped at 100%). When a plan is active this lists the exercises
   * today's plan day prescribes, so plan targets render the same way as
   * manually configured goals. Empty when no goal applies today (callers
   * fall back to their legacy single-line display).
   */
  readonly dailyGoalBreakdown = computed<readonly DailyGoalItemView[]>(() =>
    dailyGoalItemViews(this.todayGoalEntries(), this.todayGoalProgress())
  );

  /**
   * Refreshes the SSR / cold-start fallback resources. In the browser, live
   * updates flow automatically through `LiveDataStore` so this is mostly a
   * no-op — kept for callers that need the SSR cache invalidated and for
   * defence-in-depth if the Firestore listener ever drops.
   */
  reloadAfterMutation(): void {
    // no-op: live updates flow automatically through LiveDataStore
  }
}
