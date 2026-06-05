import type { MeasurementType } from './exercise.models';
import { ReminderConfig } from './reminder-config.models';
import type { ReminderLocale } from './reminder-i18n.models';

/** Particle-count quality preset for the goal-reached snap animation. */
export type SnapQuality = 'low' | 'middle' | 'high';

/** Maps a SnapQuality preset to its @wolsok/thanos `maxParticleCount`. */
export const SNAP_QUALITY_PARTICLES: Readonly<Record<SnapQuality, number>> = {
  low: 40_000,
  middle: 120_000,
  high: 200_000,
};

export const DEFAULT_SNAP_QUALITY: SnapQuality = 'low';

/**
 * How a quick-add button behaves when clicked.
 *  - `'reps'` — persist a fixed-reps entry immediately (legacy default).
 *  - `'auto-count'` — open the camera-based auto-count dialog with the
 *    configured exercise preselected; the user confirms before the entry
 *    is saved.
 */
export type QuickAddMode = 'reps' | 'auto-count';

/**
 * Exercise id for pushups. Pushup quick-adds write to `exerciseEntries`
 * (`exerciseId:'pushup'`) like every other exercise; kept as a named
 * constant so the dashboard, config dialog, and orchestrator reference the
 * same id.
 */
export const PUSHUP_QUICK_ADD_EXERCISE_ID = 'pushup';

/**
 * Catalog (or sentinel) exercise ids the camera-based auto-counter supports.
 * Must mirror the dialog's `AutoCountExerciseId` mapping — extending the
 * camera support requires updating both. Other exercises stay rep-only.
 */
export const AUTO_COUNT_QUICK_ADD_EXERCISE_IDS = [
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  'legs.squats',
  'pull.pullups',
  'abs.situps',
] as const;

export type AutoCountQuickAddExerciseId =
  (typeof AUTO_COUNT_QUICK_ADD_EXERCISE_IDS)[number];

export function isAutoCountQuickAddExerciseId(
  id: string | null | undefined
): id is AutoCountQuickAddExerciseId {
  if (!id) return false;
  return (AUTO_COUNT_QUICK_ADD_EXERCISE_IDS as readonly string[]).includes(id);
}

/**
 * User-configurable quick-add button. Legacy configs only persisted `reps`
 * and `inSpeedDial`; readers must default `exerciseId` to
 * {@link PUSHUP_QUICK_ADD_EXERCISE_ID} and `mode` to `'reps'` so older
 * Firestore docs keep their original pushup-quick-add semantics.
 */
export interface QuickAddConfig {
  reps: number;
  inSpeedDial: boolean;
  /**
   * Either {@link PUSHUP_QUICK_ADD_EXERCISE_ID} for legacy pushup-collection
   * entries, or a rep-based catalog id (e.g. `'abs.situps'`). Missing on
   * legacy docs — treat as `'pushup'`.
   */
  exerciseId?: string;
  /** Defaults to `'reps'` when missing. */
  mode?: QuickAddMode;
}

export const MAX_QUICK_ADDS = 6;

/**
 * Single entry in a complex daily/weekly/monthly goal — one exercise with
 * a target value in the exercise's native measurement (reps, seconds for
 * `time`, meters for `distance`, etc.). The store derives legacy
 * `dailyGoal`/`weeklyGoal`/`monthlyGoal` numbers from the rep-based
 * entries here, so older consumers keep working without code changes.
 */
export interface ComplexGoalEntry {
  /** Stable identifier within the user's goal list (uuid or `legacy-*`). */
  id: string;
  /**
   * Catalog id (e.g. `'legs.squats'`, `'plank.standard'`) or the
   * `'pushup'` sentinel for legacy pushup-collection targets.
   */
  exerciseId: string;
  variantId?: string;
  /** Target value in `measurement`/`unit`. Integer. */
  target: number;
  measurement: MeasurementType;
  unit: string;
  /**
   * Optional weekday filter (0 = Sunday, 1 = Monday, …, 6 = Saturday).
   * Only meaningful for daily goals — `undefined` or `[]` means the goal
   * applies every weekday. Out-of-range numbers are ignored at read time.
   */
  weekdays?: number[];
}

export type GoalScope = 'daily' | 'weekly' | 'monthly';

/**
 * Per-scope complex goal lists. Replaces the single
 * `dailyGoal`/`weeklyGoal`/`monthlyGoal` numeric fields. Legacy fields
 * stay in {@link UserConfig} for backwards compatibility with consumers
 * that haven't migrated yet — the store keeps them in sync.
 */
export interface ComplexGoals {
  daily?: ComplexGoalEntry[];
  weekly?: ComplexGoalEntry[];
  monthly?: ComplexGoalEntry[];
}

export const COMPLEX_GOALS_MAX_PER_SCOPE = 12;

/**
 * Returns true when `weekday` is in the entry's filter, or the entry has
 * no filter set (applies every day). Defensive against legacy numbers
 * outside the 0–6 range.
 */
export function complexGoalAppliesOnWeekday(
  entry: Pick<ComplexGoalEntry, 'weekdays'>,
  weekday: number
): boolean {
  const wds = entry.weekdays;
  if (!Array.isArray(wds) || wds.length === 0) return true;
  return wds.some(
    (w) => Number.isInteger(w) && w >= 0 && w <= 6 && w === weekday
  );
}

/**
 * Sums the `target` of all rep-based entries in a scope. Used to derive
 * the legacy `dailyGoal`/`weeklyGoal`/`monthlyGoal` numbers from the new
 * structure so existing consumers (Cloud Functions, dashboard cards,
 * goal-reached notifier) keep working without per-call migration.
 *
 * Time/distance/weight goals are intentionally excluded — they don't add
 * to a "rep total" any meaningfully and would inflate the legacy goal
 * numbers if mixed in.
 */
export function sumRepsTarget(entries: readonly ComplexGoalEntry[]): number {
  let sum = 0;
  for (const e of entries) {
    if (e.measurement === 'reps' && Number.isFinite(e.target) && e.target > 0) {
      sum += Math.trunc(e.target);
    }
  }
  return sum;
}

/**
 * Migrates a legacy single-number goal into a one-entry complex goal list.
 * Returns an empty list when the legacy number is missing or non-positive.
 * Used by the store to present a unified `goals` shape regardless of
 * which schema the underlying Firestore doc still uses.
 */
export function legacyNumericGoalToEntries(
  legacy: number | undefined,
  legacyId: string
): ComplexGoalEntry[] {
  if (typeof legacy !== 'number' || !Number.isFinite(legacy) || legacy <= 0) {
    return [];
  }
  return [
    {
      id: legacyId,
      exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
      target: Math.max(1, Math.trunc(legacy)),
      measurement: 'reps',
      unit: 'reps',
    },
  ];
}

export interface UserConfig {
  userId: string;
  email?: string | null;
  displayName?: string;
  /**
   * Primary subtag of the user's preferred app locale (e.g. `de`, `en`,
   * `fr`). Persisted from the client whenever the reminder is saved so the
   * server-side push dispatcher (`dispatchPushReminders`) can localise the
   * notification — it has no `LOCALE_ID` of its own.
   *
   * Typed as `ReminderLocale` (not `string`) so a future caller cannot
   * persist an unsupported subtag client-side; the server still applies
   * `normalizeReminderLocale` defensively when reading legacy docs.
   */
  locale?: ReminderLocale;
  /**
   * Legacy single-number goals. Kept for backwards compatibility with
   * consumers that haven't migrated to {@link ComplexGoals}. New writes
   * via the goals page populate {@link goals} and keep these in sync
   * with `sumRepsTarget(goals.daily/weekly/monthly)`.
   */
  dailyGoal?: number;
  weeklyGoal?: number;
  monthlyGoal?: number;
  /**
   * Per-scope complex goals (different exercises per day, weekday
   * filters for daily). Supersedes the legacy numeric fields above.
   */
  goals?: ComplexGoals;
  consent?: {
    dataProcessing?: boolean;
    statistics?: boolean;
    targetedAds?: boolean;
    acceptedAt?: string;
  };
  ui?: {
    showSourceColumn?: boolean;
    hideFromLeaderboard?: boolean;
    /**
     * Public-profile opt-in. When `true`, the `getPublicProfile(uid)` Cloud
     * Function returns a sanitized projection of this user's stats; otherwise
     * it returns `not-found`. Defaults to `false` (private).
     */
    publicProfile?: boolean;
    dayChartMode?: '24h' | '14h';
    quickAdds?: QuickAddConfig[];
    snapQuality?: SnapQuality;
  };
  createdAt?: string;
  updatedAt?: string;
  reminder?: ReminderConfig;
}

export type UserConfigUpdate = Partial<
  Pick<
    UserConfig,
    | 'email'
    | 'displayName'
    | 'locale'
    | 'dailyGoal'
    | 'weeklyGoal'
    | 'monthlyGoal'
    | 'goals'
    | 'consent'
    | 'ui'
    | 'reminder'
  >
>;

/**
 * Display-name constraints for the public leaderboard. Mirrored in
 * `data-store/firestore.rules` — keep both in sync. Pattern allows
 * Unicode letters, digits, plus space, underscore, dot, hyphen.
 */
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N} _.-]+$/u;

export type DisplayNameViolation =
  | 'too-short'
  | 'too-long'
  | 'invalid-characters';

/**
 * Returns null if the candidate passes display-name validation, otherwise
 * the kind of violation. Matches the Firestore rule constraints — clients
 * should call this before persisting to surface a clear error rather than
 * a generic permission rejection.
 */
export function validateDisplayName(raw: unknown): DisplayNameViolation | null {
  if (typeof raw !== 'string') return 'invalid-characters';
  const trimmed = raw.trim();
  if (trimmed.length < DISPLAY_NAME_MIN_LENGTH) return 'too-short';
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) return 'too-long';
  if (!DISPLAY_NAME_PATTERN.test(trimmed)) return 'invalid-characters';
  return null;
}
