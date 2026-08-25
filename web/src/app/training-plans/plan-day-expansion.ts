import { signal } from '@angular/core';

import { DayRow } from './training-plan-detail.models';

/**
 * Which day rows of the plan list show their details.
 *
 * A finished day is a record, not a to-do: it collapses to its title so
 * the weeks stay scannable, while everything still open stays expanded.
 * Only the days the user actually clicked are tracked — the default
 * follows `isCompleted`, so a day closing mid-visit folds itself away
 * without the list having to be re-seeded.
 */
export function planDayExpansion() {
  const toggled = signal<ReadonlySet<number>>(new Set<number>());

  return {
    isExpanded(row: DayRow): boolean {
      const openByDefault = !row.isCompleted;
      return toggled().has(row.day.dayIndex) ? !openByDefault : openByDefault;
    },
    toggle(dayIndex: number): void {
      const next = new Set(toggled());
      if (!next.delete(dayIndex)) next.add(dayIndex);
      toggled.set(next);
    },
  };
}
