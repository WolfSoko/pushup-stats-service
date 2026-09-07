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

/** View-model for one measured value of a `test` day. */
export interface DayTestField {
  /** Position within the day; identifies the value being recorded. */
  itemIndex: number;
  /** Localized exercise name, including the variant when the plan names one. */
  name: string;
  /** What the user measured, or null while it is unrecorded. */
  result: number | null;
  /** The day's own recommended figure, formatted; empty when it has none. */
  recommended: string;
  /** Unit suffix shown next to the field (`Wdh.`, `s`). */
  unit: string;
  /** True when the value is a duration rather than a rep count. */
  isTime: boolean;
  /** Largest value accepted, guarding against a stray keypress. */
  max: number;
  /**
   * Percent of the plan's baseline this value put in force, or null when
   * the plan defines no baseline for this exercise (nothing to scale).
   */
  percent: number | null;
}

/** View-model for the result fields of a `test` day. */
export interface DayTestRow {
  fields: ReadonlyArray<DayTestField>;
  /** True for the opening test — the one whose results rescale the plan. */
  scalesPlan: boolean;
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
  /** Present only on `test` days — the day's measured-result field. */
  test: DayTestRow | null;
  pushupTypes: ReadonlyArray<PushupTypeChip>;
}

/** A week bucket grouping its day rows for the template's `@for`. */
export interface DayWeek {
  weekIndex: number;
  rows: DayRow[];
}
