import type { QuickAddGoalItem } from '@pu-stats/quick-add';

import {
  type DailyGoalItemView,
  goalCheckDisabled,
} from '../daily-goal.helpers';

/**
 * Maps today's goals onto the speed dial's goal submenu. A goal that is
 * already reached, needs a manual entry (weight / distance-time), or has
 * a write in flight renders disabled rather than being hidden — the dial
 * doubles as today's goal overview.
 */
export function toGoalDialItems(
  items: readonly DailyGoalItemView[],
  isPending: (goalId: string) => boolean
): QuickAddGoalItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.reached
      ? item.exerciseName
      : `${item.exerciseName} +${item.remainingDisplay}`,
    ariaLabel: item.reached
      ? $localize`:@@quickAdd.fab.goalItemReachedAria:${item.exerciseName}:EXERCISE: bereits erreicht`
      : $localize`:@@quickAdd.fab.goalItemAria:${item.remainingDisplay}:REMAINING: ${item.exerciseName}:EXERCISE: bis zum Tagesziel hinzufügen`,
    reached: item.reached,
    disabled: goalCheckDisabled(item, isPending),
  }));
}
