/**
 * How reps are detected: `pose` reads joint angles with the camera
 * facing the user, `proximity` reads the brightness swing with the
 * phone lying face-up beneath the user. Which of the two an exercise
 * offers comes from the catalog (`captureMethodsFor`).
 */
export type AutoCountMode = 'pose' | 'proximity';

export interface AutoCountResult {
  /** Catalog id (or the `'pushup'` sentinel) the reps were counted for. */
  readonly exerciseId: string;
  readonly reps: number;
}

/**
 * Optional dialog data: `initialExerciseId` (a catalog id) selects which
 * exercise is active when the dialog opens, `initialMode` the detector —
 * both fall back to what the exercise supports.
 */
export interface AutoCountDialogData {
  readonly initialExerciseId?: string;
  readonly initialMode?: AutoCountMode;
}
