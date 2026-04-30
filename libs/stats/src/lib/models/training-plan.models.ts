/**
 * Training plans add structured day-by-day pushup goals on top of the
 * free-form `dailyGoal` in `UserConfig`. A `TrainingPlan` is a static,
 * curated catalog entry. A `UserTrainingPlan` is the live state of a
 * user who has activated a plan: it tracks the start date and which
 * days have been completed.
 */

/** Difficulty bucket for filtering and badge color in the UI. */
export type TrainingPlanLevel = 'beginner' | 'intermediate' | 'advanced';

/** Kind of training day. Drives icon, color, and goal-resolution rules. */
export type TrainingDayKind = 'main' | 'light' | 'rest' | 'test';

/**
 * A single day in a plan. `dayIndex` is 1-based and contiguous from
 * `1..plan.totalDays`. `targetReps === 0` is valid for `rest` days.
 */
export interface TrainingPlanDay {
  /** 1-based day number in the plan. */
  dayIndex: number;
  kind: TrainingDayKind;
  /**
   * Total reps target for the day (sum of all sets). For `rest` days
   * this is 0. For `test` days this is the recommended baseline; the
   * user logs their actual max separately.
   */
  targetReps: number;
  /**
   * Optional set decomposition (e.g. `[15, 12, 10, 10]`). When omitted,
   * the UI shows just the total target.
   */
  sets?: number[];
  /** Short German description shown in the day card. */
  description: string;
  /** Short English description shown in the day card (en locale). */
  descriptionEn?: string;
}

/**
 * Static catalog entry. Versioned via `id` (slug + version suffix when
 * we ever change targets) so old `UserTrainingPlan` documents keep
 * resolving to the same numbers.
 */
export interface TrainingPlan {
  id: string;
  slug: string;
  /** German-language title. */
  title: string;
  /** English-language title (used when `LOCALE_ID === 'en'`). */
  titleEn: string;
  /** German-language summary. */
  summary: string;
  /** English-language summary. */
  summaryEn: string;
  level: TrainingPlanLevel;
  totalDays: number;
  /** Optional blog slug pair (de/en) for "Read the article". */
  blogSlugDe?: string;
  blogSlugEn?: string;
  days: ReadonlyArray<TrainingPlanDay>;
}

export type TrainingPlanStatus = 'active' | 'completed' | 'abandoned';

/**
 * Per-user state for an activated plan. Stored at
 * `userTrainingPlans/{userId}` (single active doc per user — when a
 * user starts another plan we overwrite it; previously completed
 * plans live in a `history` subcollection later if we want to expose
 * them).
 */
export interface UserTrainingPlan {
  userId: string;
  planId: string;
  /** ISO date (YYYY-MM-DD, Berlin) when the user pressed "Start". */
  startDate: string;
  status: TrainingPlanStatus;
  /**
   * Day indexes the user has marked as done. Storing day indexes
   * (rather than dates) makes the data robust against clock skew and
   * skipped days.
   */
  completedDays: number[];
  createdAt?: string;
  updatedAt?: string;
}

export type UserTrainingPlanUpdate = Partial<
  Pick<UserTrainingPlan, 'planId' | 'startDate' | 'status' | 'completedDays'>
>;

/**
 * Compute the current 1-based day number of an active plan based on
 * the calendar diff between `startDate` and `today`. Caps at
 * `plan.totalDays`. Returns `null` when the plan hasn't started yet
 * (today < startDate).
 */
export function currentPlanDayIndex(
  plan: Pick<TrainingPlan, 'totalDays'>,
  startDate: string,
  today: string
): number | null {
  const start = parseIsoDate(startDate);
  const now = parseIsoDate(today);
  if (!start || !now) return null;
  const diff = Math.round((now.getTime() - start.getTime()) / 86_400_000);
  if (diff < 0) return null;
  return Math.min(diff + 1, plan.totalDays);
}

/**
 * Look up the day for a given 1-based index. Returns `null` if the
 * plan doesn't define that day (out of range).
 */
export function planDayByIndex(
  plan: Pick<TrainingPlan, 'days'>,
  dayIndex: number
): TrainingPlanDay | null {
  return plan.days.find((d) => d.dayIndex === dayIndex) ?? null;
}

/** Returns true once every non-rest day is in `completedDays`. */
export function isPlanCompleted(
  plan: Pick<TrainingPlan, 'days'>,
  completedDays: ReadonlyArray<number>
): boolean {
  const required = plan.days
    .filter((d) => d.kind !== 'rest')
    .map((d) => d.dayIndex);
  if (required.length === 0) return false;
  return required.every((idx) => completedDays.includes(idx));
}

function parseIsoDate(value: string): Date | null {
  // Accept `YYYY-MM-DD` (Berlin date string). Normalize to local
  // midnight so the day diff is calendar-based, not millisecond-based.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  date.setHours(0, 0, 0, 0);
  return date;
}
