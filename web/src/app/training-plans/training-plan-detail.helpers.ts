import {
  detectPushupTypes,
  isCheckoffDay,
  localizePushupType,
  localizePushupTypeSlug,
  PlanExerciseProgress,
  PushupTypeInfo,
  TrainingPlan,
  TrainingPlanDay,
} from '@pu-stats/models';
import type {
  LogPlanDayResult,
  ResetExerciseResult,
} from './training-plan.store';
import {
  asCompletedRows,
  buildExerciseRows,
} from './training-plan-detail.exercises';
import { DayRow, DayWeek, PushupTypeChip } from './training-plan-detail.models';

/** What the plan page knows about the user's progress on a plan. */
export interface WeekBuildContext {
  /** False while this isn't the plan the user actually started. */
  active: boolean;
  currentDayIndex: number | null;
  completedDays: ReadonlyArray<number>;
  skippedDays: ReadonlyArray<number>;
  /** Live per-exercise progress for a day of the *active* plan. */
  dayProgress: (dayIndex: number) => ReadonlyArray<PlanExerciseProgress>;
  /** Zero-progress preview, for a plan the user hasn't started. */
  previewProgress: (
    plan: TrainingPlan,
    dayIndex: number
  ) => ReadonlyArray<PlanExerciseProgress>;
}

/**
 * The plan's weeks as the detail page renders them.
 *
 * An inactive plan still lists its exercises, just read-only and at zero
 * progress — the prescription is the main thing a visitor came to see.
 */
export function weeksFor(
  plan: TrainingPlan | null,
  ctx: WeekBuildContext,
  locale: string
): DayWeek[] {
  if (!plan) return [];
  return buildWeeks(
    plan,
    {
      currentDay: ctx.active ? ctx.currentDayIndex : null,
      completed: new Set(ctx.active ? ctx.completedDays : []),
      skipped: new Set(ctx.active ? ctx.skippedDays : []),
      exercisesFor: (dayIndex) =>
        ctx.active
          ? ctx.dayProgress(dayIndex)
          : ctx.previewProgress(plan, dayIndex),
    },
    locale
  );
}

/** Today's row, for the card the plan page repeats above the week list. */
export function todayRowOf(weeks: ReadonlyArray<DayWeek>): DayRow | null {
  return weeks.flatMap((w) => w.rows).find((r) => r.isToday) ?? null;
}

/**
 * Router link to the guided session for a plan. Falls back to the plan
 * index when the route carries no slug, so the link is never dead.
 */
export function sessionLinkFor(slug: string | null): string[] {
  return slug ? ['/training-plans', slug, 'session'] : ['/training-plans'];
}

/**
 * Whether a day's card offers the guided session.
 *
 * Today's card alone: the session walks today's prescription, and only
 * while something is still open — a session over a finished, skipped or
 * rest day would have nothing to walk.
 */
export function offersSession(row: DayRow, planActive: boolean): boolean {
  return (
    planActive &&
    row.isToday &&
    !row.isCompleted &&
    !row.isSkipped &&
    row.day.kind !== 'rest' &&
    row.exercises.length > 0
  );
}

/**
 * Query params for the signup CTA: come back to this plan's page and
 * start it automatically once the account exists.
 */
export function signupParamsFor(
  plan: Pick<TrainingPlan, 'id' | 'slug'> | null
): Record<string, string> {
  return plan
    ? { planId: plan.id, returnUrl: `/training-plans/${plan.slug}?autoStart=1` }
    : { returnUrl: '/training-plans' };
}

/**
 * Query params for the login CTA. Intentionally **no** `autoStart=1`: a
 * returning user might already have a different active plan, and
 * silently replacing it would bypass the in-UI replacement warning shown
 * for manual starts. Send them to the detail page to confirm instead.
 */
export function loginParamsFor(
  plan: Pick<TrainingPlan, 'slug'> | null
): Record<string, string> {
  return plan
    ? { returnUrl: `/training-plans/${plan.slug}` }
    : { returnUrl: '/training-plans' };
}

/** Renders a multi-set decomposition like `(15 · 12 · 10)`. */
export function formatSets(sets: number[]): string {
  return `(${sets.join(' · ')})`;
}

/**
 * Resolves the wiki-linkable pushup variants mentioned in a day's
 * description. Rest days never carry type chips.
 */
export function pushupTypeChipsForDay(
  day: TrainingPlanDay,
  locale: string
): ReadonlyArray<PushupTypeChip> {
  if (day.kind === 'rest') return [];
  const matched: ReadonlyArray<PushupTypeInfo> = detectPushupTypes(
    day.description
  );
  return matched.map((type) => {
    const localized = localizePushupType(type, locale);
    return {
      slug: localizePushupTypeSlug(type, locale),
      name: localized.name,
      summary: localized.summary,
    };
  });
}

/** Per-day completion state derived from the active plan, used to build rows. */
export interface PlanProgress {
  /** 1-based index of the current plan day, or null when inactive. */
  currentDay: number | null;
  completed: ReadonlySet<number>;
  skipped: ReadonlySet<number>;
  /** Per-exercise fulfillment of a day. Empty for an inactive plan. */
  exercisesFor: (dayIndex: number) => ReadonlyArray<PlanExerciseProgress>;
}

/**
 * Groups a plan's days into week buckets (7 days each, 1-based) with a
 * per-day view-model that folds in the active-plan progress state.
 */
export function buildWeeks(
  plan: TrainingPlan,
  progress: PlanProgress,
  locale: string
): DayWeek[] {
  const { currentDay, completed, skipped } = progress;
  const grouped = new Map<number, DayRow[]>();
  for (const day of plan.days) {
    const weekIndex = Math.floor((day.dayIndex - 1) / 7) + 1;
    const isToday = currentDay !== null && day.dayIndex === currentDay;
    const isCompleted = completed.has(day.dayIndex);
    const exercises = buildExerciseRows(progress.exercisesFor(day.dayIndex));
    const row: DayRow = {
      day,
      weekIndex,
      isToday,
      isCompleted,
      isSkipped: skipped.has(day.dayIndex),
      isFuture: currentDay !== null && day.dayIndex > currentDay,
      isCheckoff: isCheckoffDay(day),
      exercises: isCompleted ? asCompletedRows(exercises) : exercises,
      pushupTypes: pushupTypeChipsForDay(day, locale),
    };
    const list = grouped.get(weekIndex) ?? [];
    list.push(row);
    grouped.set(weekIndex, list);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, rows]) => ({ weekIndex, rows }));
}

/** Maps a log-plan-day outcome to a user-facing snackbar message (or none). */
export function messageForLogResult(result: LogPlanDayResult): string | null {
  switch (result) {
    case 'logged':
      return $localize`:@@trainingPlans.logged:Plan-Sätze wurden eingetragen.`;
    case 'already-logged':
      return $localize`:@@trainingPlans.alreadyLogged:Tag war schon eingetragen — als erledigt markiert.`;
    case 'not-ready':
      return $localize`:@@trainingPlans.notReady:Daten werden noch geladen, bitte gleich noch einmal versuchen.`;
    case 'in-flight':
    case 'noop':
      return null;
  }
}

/** Maps a reset outcome to a user-facing snackbar message (or none). */
export function messageForResetResult(
  result: ResetExerciseResult
): string | null {
  switch (result) {
    case 'reset':
      return $localize`:@@trainingPlans.exercise.resetDone:Übung zurückgesetzt.`;
    case 'kept-entries':
      return $localize`:@@trainingPlans.exercise.resetKept:Haken entfernt — deine eigenen Einträge bleiben bestehen.`;
    case 'not-ready':
      return $localize`:@@trainingPlans.notReady:Daten werden noch geladen, bitte gleich noch einmal versuchen.`;
    case 'in-flight':
    case 'noop':
      return null;
  }
}
