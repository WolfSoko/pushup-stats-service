import { TrainingPlanDay } from '@pu-stats/models';

/** A wiki-linkable pushup variant detected from a day's description. */
export interface PushupTypeChip {
  slug: string;
  name: string;
  summary: string;
}

/** View-model for a single plan day rendered in the week list. */
export interface DayRow {
  day: TrainingPlanDay;
  weekIndex: number;
  isToday: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
  isFuture: boolean;
  pushupTypes: ReadonlyArray<PushupTypeChip>;
}

/** A week bucket grouping its day rows for the template's `@for`. */
export interface DayWeek {
  weekIndex: number;
  rows: DayRow[];
}
