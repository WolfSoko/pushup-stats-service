import { signal } from '@angular/core';

import { DayRow } from './training-plan-detail.models';

/**
 * Which day rows of the plan list show their details.
 *
 * A finished day is a record, not a to-do: it collapses to its title so
 * the weeks stay scannable, while everything still open stays expanded.
 *
 * A click stores the row's *absolute* state, not a flip of the default.
 * Storing the flip would tie the row to `isCompleted`: unchecking an
 * exercise inside a finished day the user just opened would snap it shut
 * under their hands, and ticking off the last exercise of a row they
 * collapsed would spring it back open.
 */
export function planDayExpansion() {
  const chosen = signal<ReadonlyMap<number, boolean>>(
    new Map<number, boolean>()
  );

  function isExpanded(row: DayRow): boolean {
    return chosen().get(row.day.dayIndex) ?? !row.isCompleted;
  }

  return {
    isExpanded,
    toggle(row: DayRow): void {
      const next = new Map(chosen());
      next.set(row.day.dayIndex, !isExpanded(row));
      chosen.set(next);
    },
  };
}
