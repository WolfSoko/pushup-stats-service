/**
 * Training plans add structured day-by-day pushup goals on top of the
 * free-form `dailyGoal` in `UserConfig`. A `TrainingPlan` is a static,
 * curated catalog entry. A `UserTrainingPlan` is the live state of a
 * user who has activated a plan: it tracks the start date and which
 * days have been completed.
 *
 * All human-readable fields (`title`, `summary`, `description`,
 * `blogSlug`) are populated via Angular `$localize` in
 * `training-plan.catalog.ts`, so each locale-specific build receives
 * the translated strings up front. There are no parallel `*En` fields
 * — translation lives in the standard XLIFF flow.
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
  /** Localized short description shown in the day card. */
  description: string;
}

/**
 * Static catalog entry. Versioned via `id` (slug + version suffix when
 * we ever change targets) so old `UserTrainingPlan` documents keep
 * resolving to the same numbers.
 */
export interface TrainingPlan {
  id: string;
  slug: string;
  /** Localized plan title. */
  title: string;
  /** Localized one-paragraph summary. */
  summary: string;
  level: TrainingPlanLevel;
  totalDays: number;
  /**
   * Absolute URL of the topical hero photo (Unsplash CDN) shown in the
   * plan preview card and on the detail page. Locale-independent — the
   * localized `title` doubles as its `alt` text in the UI.
   */
  heroImage?: string;
  /**
   * Small credit line rendered under the hero on the detail page —
   * HTML allowed. Localized (the "Foto:" label varies per locale).
   */
  heroImageCredit?: string;
  /**
   * Optional locale-aware blog slug for the "Read the article" CTA.
   * The German source value is the DE blog slug; translators replace
   * it with the EN slug per locale.
   */
  blogSlug?: string;
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
  /**
   * Day indexes the user has chosen to skip (e.g. via `jumpToDay` or
   * an explicit per-day skip action). Skipped days are excluded from
   * both the completion percent denominator and the `isPlanCompleted`
   * required-set, so the user can still finish a plan after missing
   * days. Mutually exclusive with `completedDays` — a day index is in
   * at most one of the two arrays.
   */
  skippedDays?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export type UserTrainingPlanUpdate = Partial<
  Pick<
    UserTrainingPlan,
    'planId' | 'startDate' | 'status' | 'completedDays' | 'skippedDays'
  >
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

/**
 * Returns true once every non-rest, non-skipped day is in
 * `completedDays`. A plan with every working day skipped is NOT
 * considered completed — that would mark "did nothing" as a finished
 * plan, which is not the contract `isPlanCompleted` is meant to
 * satisfy (used for the dashboard "Plan abgeschlossen" badge).
 */
export function isPlanCompleted(
  plan: Pick<TrainingPlan, 'days'>,
  completedDays: ReadonlyArray<number>,
  skippedDays: ReadonlyArray<number> = []
): boolean {
  const skipped = new Set(skippedDays);
  const required = plan.days
    .filter((d) => d.kind !== 'rest' && !skipped.has(d.dayIndex))
    .map((d) => d.dayIndex);
  if (required.length === 0) return false;
  return required.every((idx) => completedDays.includes(idx));
}

/**
 * 1-based day index that `jumpToDay` should re-anchor `startDate` to
 * for a given target day and "today". Returns the ISO date the
 * `UserTrainingPlan.startDate` field should be set to so that
 * `currentPlanDayIndex(plan, result, today) === targetDayIndex`.
 *
 * Returns `null` for an out-of-range target. Does not mutate.
 */
export function startDateForTargetDay(
  totalDays: number,
  targetDayIndex: number,
  today: string
): string | null {
  if (targetDayIndex < 1 || targetDayIndex > totalDays) return null;
  const now = parseIsoDate(today);
  if (!now) return null;
  const start = new Date(now);
  start.setDate(now.getDate() - (targetDayIndex - 1));
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const d = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value: string): Date | null {
  // Accept `YYYY-MM-DD` (Berlin date string). Normalize to local
  // midnight so the day diff is calendar-based, not millisecond-based.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  // Reject impossible dates like 2026-02-30 — `Date()` would silently
  // overflow into the next month. Round-trip the components.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}
