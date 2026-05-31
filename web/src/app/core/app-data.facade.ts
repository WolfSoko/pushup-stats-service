import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  resource,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserContextService } from '@pu-auth/auth';
import { StatsApiService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  type ComplexGoalEntry,
  complexGoalAppliesOnWeekday,
  findExerciseDefinition,
  formatExerciseValue,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  type QuickAddConfig,
  toBerlinIsoDate,
} from '@pu-stats/models';
import {
  AdaptiveQuickAddService,
  type QuickAddSuggestion,
} from '@pu-stats/quick-add';
import { TrainingPlanStore } from '../training-plans/training-plan.store';
import { UserConfigStore } from './user-config.store';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';

const FALLBACK_QUICK_ICONS = ['bolt', 'flash_on', 'whatshot'] as const;

/**
 * Per-exercise view of a single daily goal — exercise name, formatted
 * target and progress in the goal's native unit, and the completion share.
 * Shared by the dashboard goal card and the toolbar pill dropdown so both
 * surfaces render "Anzahl/Zeitziel + Übung + Anteil geschafft" identically.
 */
export interface DailyGoalItemView {
  readonly id: string;
  readonly exerciseName: string;
  readonly targetDisplay: string;
  readonly progressDisplay: string;
  readonly percent: number;
  readonly reached: boolean;
}

function pushupSuggestion(reps: number, slot: number): QuickAddSuggestion {
  return {
    key: `slot:${slot}`,
    reps,
    icon: FALLBACK_QUICK_ICONS[slot] ?? 'bolt',
    label: $localize`:@@quickAdd.fab.pushupRepsLabel:+${reps}:REPS: Reps`,
    ariaLabel: $localize`:@@quickAdd.fab.repAria:${reps}:REPS: Liegestütze hinzufügen`,
    exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
  };
}

function configuredSuggestion(
  cfg: QuickAddConfig,
  slot: number
): QuickAddSuggestion {
  const exerciseId = cfg.exerciseId ?? PUSHUP_QUICK_ADD_EXERCISE_ID;
  if (exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID) {
    return pushupSuggestion(cfg.reps, slot);
  }
  const def = findExerciseDefinition(exerciseId);
  const exerciseLabel = exerciseDisplayName(exerciseId);
  const icon = def?.icon ?? 'fitness_center';
  return {
    key: `slot:${slot}`,
    reps: cfg.reps,
    icon,
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
  private readonly statsApi = inject(StatsApiService);
  private readonly adaptiveQuickAdd = inject(AdaptiveQuickAddService);
  private readonly userConfig = inject(UserConfigStore);
  private readonly trainingPlan = inject(TrainingPlanStore);
  private readonly live = inject(LiveDataStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly recentEntriesResource = resource({
    params: () => ({ userId: this.user.userIdSafe() }),
    loader: async ({ params }) => {
      if (!params.userId) return [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const from = sevenDaysAgo.toISOString().slice(0, 10);
      return firstValueFrom(this.statsApi.listPushups({ from }));
    },
  });

  /** Last 7 days of entries — derived live from Firestore in the browser. */
  private readonly recentEntries = computed(() => {
    if (this.isBrowser && this.live.connected()) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoff = sevenDaysAgo.toISOString().slice(0, 10);
      return this.live
        .entries()
        .filter((e) => e.timestamp.slice(0, 10) >= cutoff);
    }
    return this.recentEntriesResource.value() ?? [];
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
    return this.adaptiveQuickAdd
      .compute(this.recentEntries())
      .map((reps, i) => pushupSuggestion(reps, i));
  });

  /**
   * Today's prescribed plan reps when a plan is active and today is a
   * non-rest day. Mirrors the dashboard's `planTodayTarget` so the
   * toolbar pill and Quick-Add fill button reflect the plan target the
   * moment a plan is activated, without waiting for a manual config edit.
   */
  private readonly planTodayTarget = computed(() => {
    if (!this.trainingPlan.hasActivePlan()) return 0;
    const day = this.trainingPlan.todayDay();
    if (!day || day.kind === 'rest') return 0;
    return day.targetReps;
  });

  /**
   * Plan target if available, otherwise the user-configured goal. Kept
   * without the `|| 100` fallback so `remainingToGoal` and `goalReached`
   * can distinguish "no goal configured" from "goal of 100".
   */
  private readonly effectiveDailyGoal = computed(
    () => this.planTodayTarget() || this.userConfig.dailyGoal()
  );

  readonly dailyGoal = computed(() => this.effectiveDailyGoal() || 100);

  readonly dailyProgressResource = resource({
    params: () => ({ userId: this.user.userIdSafe() }),
    loader: async ({ params }) => {
      if (!params.userId) return 0;
      const today = new Date().toISOString().slice(0, 10);
      const stats = await firstValueFrom(
        this.statsApi.load({ from: today, to: today })
      );
      return stats?.meta?.total ?? 0;
    },
  });

  readonly todayProgress = computed(() => {
    if (this.isBrowser && this.live.connected()) {
      const berlinToday = toBerlinIsoDate(new Date());
      return this.live
        .entries()
        .filter((e) => e.timestamp.slice(0, 10) === berlinToday)
        .reduce((sum, e) => sum + e.reps, 0);
    }
    return this.dailyProgressResource.value() ?? 0;
  });

  readonly remainingToGoal = computed(() =>
    Math.max(0, this.effectiveDailyGoal() - this.todayProgress())
  );

  readonly goalReached = computed(() => {
    // For users on the new goals page, "reached" means every applicable
    // exercise has hit its individual target — comparing the rep-sum to
    // the pushup-only `todayProgress` would let the snap fire after just
    // doing pushups even if Squats/Plank/Running were never touched.
    if (this.userConfig.goalsConfigured()) {
      return this.dailyGoalsAllReached();
    }
    const goal = this.effectiveDailyGoal();
    return goal > 0 && this.todayProgress() >= goal;
  });

  /**
   * Today's complex goal entries, filtered by the current weekday. A plan
   * day target keeps superseding the user's complex goals — we synthesise
   * a single pushup-reps entry so the toolbar stays focused on the
   * prescribed plan workout.
   */
  readonly todayGoalEntries = computed<ComplexGoalEntry[]>(() => {
    const planTarget = this.planTodayTarget();
    if (planTarget > 0) {
      return [
        {
          id: 'plan-today',
          exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
          target: planTarget,
          measurement: 'reps',
          unit: 'reps',
        },
      ];
    }
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
   */
  readonly todayGoalProgress = computed<readonly number[]>(() => {
    const entries = this.todayGoalEntries();
    if (entries.length === 0) return [];
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
    const exerciseEntries = this.live
      .exerciseEntries()
      .filter((e) => e.timestamp.slice(0, 10) === berlinToday);
    return entries.map((entry) => {
      if (entry.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID) {
        return pushupRepsToday;
      }
      // When the goal pins a specific variant, count only entries of that
      // variant. Otherwise match every entry for the exercise across all
      // its variants — the goals page deliberately does not expose a
      // variant picker yet (so most entries here will have no
      // `variantId`), and a user logging "decline sit-ups" against a
      // generic "Sit-ups" goal should still increment the progress.
      const matching = exerciseEntries.filter((e) => {
        if (e.exerciseId !== entry.exerciseId) return false;
        if (!entry.variantId) return true;
        return e.variantId === entry.variantId;
      });
      switch (entry.measurement) {
        case 'reps':
        case 'weight':
          return matching.reduce((sum, e) => sum + (e.reps ?? 0), 0);
        case 'time':
          return matching.reduce((sum, e) => sum + (e.durationSec ?? 0), 0);
        case 'distance':
        case 'distance-time':
          return matching.reduce((sum, e) => sum + (e.distanceM ?? 0), 0);
      }
    });
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
   * Aggregated 0–100 daily-goal completion percentage across all
   * configured exercises (averaged, capped per-entry at 100% so a
   * blown-out single goal can't mask the others). Returns 0 when no
   * goals apply today.
   */
  readonly dailyGoalAggregatedPercent = computed(() => {
    const entries = this.todayGoalEntries();
    if (entries.length === 0) return 0;
    const progress = this.todayGoalProgress();
    let pctSum = 0;
    let counted = 0;
    for (let i = 0; i < entries.length; i++) {
      const target = entries[i].target;
      if (!target || target <= 0) continue;
      const ratio = Math.min(1, progress[i] / target);
      pctSum += ratio * 100;
      counted += 1;
    }
    if (counted === 0) return 0;
    return Math.round(pctSum / counted);
  });

  /**
   * True iff every configured exercise reached its target today. Used by
   * the toolbar pill to flag "click to replay snap animation".
   */
  readonly dailyGoalsAllReached = computed(() => {
    const entries = this.todayGoalEntries();
    if (entries.length === 0) return false;
    const progress = this.todayGoalProgress();
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].target <= 0) continue;
      if (progress[i] < entries[i].target) return false;
    }
    return true;
  });

  /**
   * Per-exercise breakdown of today's daily goals for the dashboard card
   * and the toolbar pill dropdown: exercise name, formatted progress and
   * target in the goal's native unit, and the per-entry completion share
   * (capped at 100%). When a plan is active this lists the single
   * synthesised plan-reps goal, so the plan's daily target renders the
   * same way as a manually configured goal. Empty when no goal applies
   * today (callers fall back to their legacy single-line display).
   */
  readonly dailyGoalBreakdown = computed<readonly DailyGoalItemView[]>(() => {
    const entries = this.todayGoalEntries();
    if (entries.length === 0) return [];
    const progress = this.todayGoalProgress();
    return entries.map((entry, i) => {
      const value = progress[i] ?? 0;
      const target = entry.target;
      const hasTarget = target > 0;
      // The pushup sentinel isn't in the exercise-name catalog (legacy
      // pushups live in their own collection) — resolve it to the same
      // "Liegestütze" label the analysis page uses.
      const exerciseName =
        entry.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID
          ? $localize`:@@exercise.category.pushup:Liegestütze`
          : exerciseDisplayName(entry.exerciseId);
      return {
        id: entry.id,
        exerciseName,
        targetDisplay: formatExerciseValue(target, entry.unit),
        progressDisplay: formatExerciseValue(value, entry.unit),
        percent: hasTarget
          ? Math.min(100, Math.round((value / target) * 100))
          : 0,
        reached: hasTarget && value >= target,
      };
    });
  });

  /**
   * Refreshes the SSR / cold-start fallback resources. In the browser, live
   * updates flow automatically through `LiveDataStore` so this is mostly a
   * no-op — kept for callers that need the SSR cache invalidated and for
   * defence-in-depth if the Firestore listener ever drops.
   */
  reloadAfterMutation(): void {
    this.recentEntriesResource.reload();
    this.dailyProgressResource.reload();
  }
}
