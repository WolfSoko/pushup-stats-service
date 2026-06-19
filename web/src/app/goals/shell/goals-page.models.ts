import type { GoalScope, MeasurementType } from '@pu-stats/models';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export const AUTO_SAVE_DEBOUNCE_MS = 600;
export const SAVED_INDICATOR_MS = 1800;

export interface ExercisePickerEntry {
  id: string;
  label: string;
  measurement: MeasurementType;
  unit: string;
  min: number;
  max: number;
}

export interface GoalScopeDescriptor {
  id: GoalScope;
  icon: string;
  title: string;
  subtitle: string;
}

export interface WeekdayOption {
  value: number;
  label: string;
}
