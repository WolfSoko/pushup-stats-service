import {
  type FormCheckFrame,
  PROXIMITY_ANGLE_SPAN_DEG,
  type RepPhase,
} from '@pu-stats/auto-count';
import {
  cameraCountableExercises,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
} from '@pu-stats/models';

import {
  type AutoCountProfileId,
  autoCountProfileForCatalogId,
} from '../core/quick-add-orchestration.helpers';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import type { AutoCountMode } from './auto-count-dialog.models';

export interface ExerciseOption {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  /** Pose-detector profile, absent when only proximity counting applies. */
  readonly poseProfile: AutoCountProfileId | null;
  readonly proximity: boolean;
}

export function buildExerciseOptions(): ReadonlyArray<ExerciseOption> {
  return cameraCountableExercises().map((def) => ({
    id: def.id,
    icon: def.icon ?? 'fitness_center',
    label: exerciseDisplayName(def.id),
    poseProfile: autoCountProfileForCatalogId(def.id),
    proximity: def.proximityCountable === true,
  }));
}

/** The requested mode where the exercise offers it, else whatever it does offer. */
export function resolveMode(
  requested: AutoCountMode,
  option: ExerciseOption
): AutoCountMode {
  if (requested === 'proximity' && option.proximity) return 'proximity';
  if (requested === 'pose' && option.poseProfile) return 'pose';
  return option.poseProfile ? 'pose' : 'proximity';
}

export function phaseLabelFor(phase: RepPhase): string {
  switch (phase) {
    case 'up':
      return $localize`:@@autoCount.formCheck.phase.up:Oben`;
    case 'down':
      return $localize`:@@autoCount.formCheck.phase.down:Unten`;
    default:
      return $localize`:@@autoCount.formCheck.phase.waiting:Bereit`;
  }
}

/** The caller's exercise where it is countable, else the pushup default. */
export function initialExerciseId(
  requested: string | undefined,
  exercises: ReadonlyArray<ExerciseOption>
): string {
  if (requested && exercises.some((o) => o.id === requested)) return requested;
  return (
    exercises.find((o) => o.id === PUSHUP_QUICK_ADD_EXERCISE_ID)?.id ??
    exercises[0].id
  );
}

/** Pose profile id for the pose detector, catalog id for the proximity one. */
export function detectorExerciseId(
  option: ExerciseOption,
  isProximity: boolean
): string {
  return isProximity ? option.id : (option.poseProfile ?? option.id);
}

/** Near/far position as a percentage, from the proximity counter's angle. */
export function proximityPercent(frame: FormCheckFrame | null): number | null {
  if (!frame) return null;
  return (1 - frame.angleDeg / PROXIMITY_ANGLE_SPAN_DEG) * 100;
}
