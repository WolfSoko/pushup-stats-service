import { EXERCISE_CATALOG, findExerciseDefinition } from './exercise.catalog';
import type { ExerciseDefinition } from './exercise.models';

/**
 * How an exercise can be captured, from most to least automatic:
 *  - `pose`       — camera in front of the user, joint-angle rep counter.
 *  - `proximity`  — phone lying face-up under the user, brightness-swing
 *                   rep counter.
 *  - `hold-timer` — camera hold detector for isometric holds.
 *  - `stopwatch`  — plain stopwatch for any timed exercise.
 *  - `manual`     — the entry dialog; always available.
 */
export type CaptureMethod =
  'pose' | 'proximity' | 'hold-timer' | 'stopwatch' | 'manual';

export type CaptureCapableDefinition = Pick<
  ExerciseDefinition,
  | 'measurement'
  | 'autoCountProfileId'
  | 'holdTimerProfileId'
  | 'proximityCountable'
>;

/**
 * The capture methods a catalog entry supports, in preference order.
 * Derived from the entry's flags so the catalog stays the single source
 * of truth: the session tool routing, the quick-add config dialog and
 * the camera dialog's exercise list all read this instead of keeping
 * their own allowlists.
 */
export function captureMethodsFor(
  def: CaptureCapableDefinition
): ReadonlyArray<CaptureMethod> {
  const methods: CaptureMethod[] = [];
  if (def.measurement === 'reps') {
    if (def.autoCountProfileId) methods.push('pose');
    if (def.proximityCountable) methods.push('proximity');
  } else if (def.measurement === 'time') {
    if (def.holdTimerProfileId) methods.push('hold-timer');
    methods.push('stopwatch');
  }
  methods.push('manual');
  return methods;
}

export function supportsCaptureMethod(
  exerciseId: string | null | undefined,
  method: CaptureMethod
): boolean {
  const def = findExerciseDefinition(exerciseId);
  return def ? captureMethodsFor(def).includes(method) : method === 'manual';
}

/** True when the camera rep counter (either detector) applies. */
export function supportsCameraCount(
  exerciseId: string | null | undefined
): boolean {
  return (
    supportsCaptureMethod(exerciseId, 'pose') ||
    supportsCaptureMethod(exerciseId, 'proximity')
  );
}

/** Every catalog exercise the camera rep counter can be opened for. */
export function cameraCountableExercises(): ReadonlyArray<ExerciseDefinition> {
  return EXERCISE_CATALOG.filter((def) => {
    const methods = captureMethodsFor(def);
    return methods.includes('pose') || methods.includes('proximity');
  });
}

/**
 * Catalog ids a quick-add button may run in `auto-count` mode — exactly
 * the camera-countable exercises, derived rather than listed.
 */
export const AUTO_COUNT_QUICK_ADD_EXERCISE_IDS: ReadonlyArray<string> =
  cameraCountableExercises().map((def) => def.id);

export function isAutoCountQuickAddExerciseId(
  id: string | null | undefined
): boolean {
  if (!id) return false;
  return AUTO_COUNT_QUICK_ADD_EXERCISE_IDS.includes(id);
}
