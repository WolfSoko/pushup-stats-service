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
 * Sentinel exerciseId for the legacy pushups collection. Pushup quick-adds
 * still flow through `StatsApi.createPushup()` rather than the generic
 * `exerciseEntries` collection — keep this single source so the dashboard,
 * config dialog, and orchestrator stay in lockstep.
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
  dailyGoal?: number;
  weeklyGoal?: number;
  monthlyGoal?: number;
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
