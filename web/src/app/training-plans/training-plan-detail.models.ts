import { TrainingPlanDay } from '@pu-stats/models';

/** A wiki-linkable pushup variant detected from a day's description. */
export interface PushupTypeChip {
  slug: string;
  name: string;
  summary: string;
}

/** View-model for one trackable exercise inside a day. */
export interface DayExerciseRow {
  /** 0-based position inside the day's exercise list. */
  itemIndex: number;
  /** Localized exercise name, including the variant when the plan names one. */
  name: string;
  /** Formatted target in the exercise's unit (`45`, `1:30`, `500 m`). */
  target: string;
  /** Formatted amount logged so far, in the same unit. */
  logged: string;
  /** Formatted set/interval breakdown, empty when there is only one. */
  sets: string;
  /** 0–100, for the per-exercise progress bar. */
  percent: number;
  /** False for exercises the plan names but doesn't quantify (HIIT rounds). */
  quantified: boolean;
  done: boolean;
  /** Done because logged entries cover the target, not by a manual tick. */
  auto: boolean;
}

/** View-model for a single plan day rendered in the week list. */
export interface DayRow {
  day: TrainingPlanDay;
  weekIndex: number;
  isToday: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
  isFuture: boolean;
  /** Day is ticked off by hand rather than fulfilled by logged metrics. */
  isCheckoff: boolean;
  exercises: ReadonlyArray<DayExerciseRow>;
  pushupTypes: ReadonlyArray<PushupTypeChip>;
}

/** A week bucket grouping its day rows for the template's `@for`. */
export interface DayWeek {
  weekIndex: number;
  rows: DayRow[];
}
