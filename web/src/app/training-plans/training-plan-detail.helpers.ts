import {
  detectPushupTypes,
  localizePushupType,
  localizePushupTypeSlug,
  PushupTypeInfo,
  TrainingPlan,
  TrainingPlanDay,
} from '@pu-stats/models';
import { LogPlanDayResult } from './training-plan.store';
import { DayRow, DayWeek, PushupTypeChip } from './training-plan-detail.models';

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
    const row: DayRow = {
      day,
      weekIndex,
      isToday,
      isCompleted: completed.has(day.dayIndex),
      isSkipped: skipped.has(day.dayIndex),
      isFuture: currentDay !== null && day.dayIndex > currentDay,
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
