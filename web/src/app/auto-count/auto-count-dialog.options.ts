import { cameraCountableExercises } from '@pu-stats/models';

import {
  type AutoCountProfileId,
  autoCountProfileForCatalogId,
} from '../core/quick-add-orchestration.helpers';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import type { AutoCountMode } from './auto-count-dialog.component';

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
