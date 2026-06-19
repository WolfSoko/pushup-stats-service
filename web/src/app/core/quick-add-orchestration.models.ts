import type {
  AutoCountExerciseId,
  AutoCountResult,
} from '../auto-count/auto-count-dialog.component';
import type {
  ExerciseTimerExerciseId,
  ExerciseTimerResult,
} from '../auto-count/exercise-timer-dialog.component';
import type {
  ExerciseEntryDialogData,
  ExerciseEntryDialogResult,
  PushupEntryDialogData,
  PushupEntryDialogResult,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../stats/components/training-entry-dialog/training-entry-dialog.models';

export const AUTO_COUNT_DIALOG_CONFIG = {
  width: '100vw',
  maxWidth: '100vw',
  height: '100vh',
  maxHeight: '100vh',
  panelClass: 'auto-count-dialog-panel',
} as const;

export const EXERCISE_TIMER_DIALOG_CONFIG = {
  width: 'min(96vw, 480px)',
  maxWidth: '96vw',
  panelClass: 'exercise-timer-dialog-panel',
} as const;

export const TRAINING_ENTRY_DIALOG_CONFIG = {
  width: 'min(92vw, 420px)',
  maxWidth: '92vw',
} as const;

export type {
  AutoCountExerciseId,
  AutoCountResult,
  ExerciseTimerExerciseId,
  ExerciseTimerResult,
  ExerciseEntryDialogData,
  ExerciseEntryDialogResult,
  PushupEntryDialogData,
  PushupEntryDialogResult,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
};
