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
 * How a day's exercises are honored.
 *
 * - `'metrics'` (default): each exercise carries a measurable target,
 *   so logging entries fulfills it and the auto-mark effect can close
 *   the day without the user touching the plan page.
 * - `'checkoff'`: the prescription is an interval/circuit structure
 *   (HIIT, EMOM, Tabata) whose real volume depends on how many rounds
 *   the user actually survives. Metric auto-fulfillment would either
 *   over- or under-count, so these days are ticked off by hand — per
 *   exercise or in one go. Logging entries is still offered where the
 *   exercise is measurable; it just isn't what decides completion.
 */
export type TrainingDayCompletion = 'metrics' | 'checkoff';

/**
 * One trackable exercise inside a training day. `target` is expressed
 * in the exercise's own measurement unit — reps for `reps`/`weight`,
 * seconds for `time`, meters for `distance`/`distance-time` — so the
 * same shape covers "45 Kniebeugen" and "3×40 s Plank".
 */
export interface TrainingPlanExercise {
  /**
   * Catalog exercise id. MUST be a real `ExerciseDefinition.id` (the
   * `'pushup'` sentinel included, which resolves to `PUSHUP_DEFINITION`);
   * a plan-spec guard test pins this to the catalog.
   */
  exerciseId: string;
  /** Optional catalog variant id (e.g. a specific plank/pushup variant). */
  variantId?: string;
  /** Total target for the day in the exercise's measurement unit. */
  target: number;
  /**
   * Optional per-set (reps) / per-interval (time, distance) breakdown.
   * Sums to `target` — a catalog guard test enforces it.
   */
  sets?: number[];
}

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
  /**
   * Catalog exercise this day prescribes. Absent ⇒ the `'pushup'`
   * sentinel: every existing plan is a pushup plan, and Liegestütze live
   * in the legacy `pushups` collection with no catalog entry. A present
   * value MUST be a real `ExerciseDefinition.id` — the catalog is the
   * single source of valid exercises and the plan spec guards this — so
   * plans reference the same exercise catalog as goals, entries, and
   * analysis. Resolve via {@link trainingPlanDayExerciseId}.
   */
  exerciseId?: string;
  /** Optional catalog variant id (e.g. a specific plank/pushup variant). */
  variantId?: string;
  /**
   * Every exercise the day prescribes, each individually trackable.
   * Absent ⇒ the day is a single-exercise day and its item is derived
   * from `exerciseId`/`targetReps`/`sets` (see `planDayExercises`), so
   * pure-pushup plans need no data change. When present, the pushup
   * portion is listed like any other exercise and its target mirrors
   * `targetReps` — the dashboard goal pill still reads `targetReps`.
   */
  exercises?: ReadonlyArray<TrainingPlanExercise>;
  /** Completion mode. Absent ⇒ `'metrics'`. */
  completion?: TrainingDayCompletion;
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
   * Photographer attribution for the hero photo, rendered as a credit
   * line under the hero on the detail page. Locale-independent — the
   * "Foto:" label is the only localized part and lives in the template.
   */
  heroImagePhotographer?: { name: string; profileUrl: string };
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
  /**
   * Per-exercise completion inside a day, as flat `"<dayIndex>:<itemIndex>"`
   * ids (see `planDayItemId`). Flat strings rather than a nested
   * `{day: indexes}` map so writes go through `arrayUnion`/`arrayRemove`
   * like `completedDays` — a nested map would be clobbered wholesale by
   * concurrent `setDoc({merge:true})` writes (docs/gotchas/firestore.md).
   *
   * Only *manual* check-offs live here. Items whose target is covered by
   * logged entries are fulfilled by derivation, so a user who tracks
   * through Quick-Add never writes to this field.
   */
  completedItems?: string[];
  /**
   * ISO timestamp of the moment the *current* day slot became active —
   * bumped on `start()` and `jumpToDay()`, the two writes that can make a
   * day's resolved calendar date (`startDate` + offset) land on a date
   * other days already claimed entries from. Lets `planDayProgress`
   * exclude entries logged before this instant when a day's date matches
   * it, so reps already spent completing day N can't also auto-fulfill
   * day N+1 (or a different plan) just because both resolve to "today".
   * Absent on legacy docs — fulfillment falls back to unfiltered
   * date-matching for those.
   */
  dayActivatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UserTrainingPlanUpdate = Partial<
  Pick<
    UserTrainingPlan,
    | 'planId'
    | 'startDate'
    | 'status'
    | 'completedDays'
    | 'skippedDays'
    | 'completedItems'
  >
>;

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
 * Catalog exercise id a plan day prescribes. Defaults to the `'pushup'`
 * sentinel (matching `PUSHUP_QUICK_ADD_EXERCISE_ID`) when the day names no
 * exercise, so every existing pushup plan keeps working unchanged while
 * new plans can target any catalog exercise. The returned id is guaranteed
 * by the plan spec to be either `'pushup'` or a real `ExerciseDefinition.id`.
 */
export function trainingPlanDayExerciseId(
  day: Pick<TrainingPlanDay, 'exerciseId'>
): string {
  return day.exerciseId ?? 'pushup';
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
