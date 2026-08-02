import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import type { DailyGoalItemView } from '../daily-goal.helpers';

/**
 * Detailed daily-goal list: one row per goal with its exercise, progress
 * in the goal's native unit, completion share and bar. Purely
 * presentational — the parent owns the write.
 *
 * `interactive` turns the rows into check-offs. A goal has no completion
 * flag of its own (it is scored from entries), so ticking one means
 * logging the missing amount and a reached goal stays locked: un-ticking
 * would be a lie the next entry update would immediately undo.
 */
@Component({
  selector: 'app-daily-goal-checklist',
  imports: [
    MatCheckboxModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-goal-checklist.component.html',
  styleUrl: './daily-goal-checklist.component.scss',
})
export class DailyGoalChecklistComponent {
  readonly items = input.required<readonly DailyGoalItemView[]>();
  /** False renders a read-only list (toolbar dropdown, preview surfaces). */
  readonly interactive = input(false);
  /** Goal ids with an in-flight check-off write. */
  readonly pending = input<ReadonlySet<string>>(new Set<string>());
  /** Lets each host keep its own row test id. */
  readonly testId = input('daily-goal-item');

  readonly complete = output<DailyGoalItemView>();

  protected checkDisabled(item: DailyGoalItemView): boolean {
    return item.reached || !item.fillable || this.pending().has(item.id);
  }

  protected tooltipFor(item: DailyGoalItemView): string {
    if (item.reached) {
      return $localize`:@@dailyGoal.check.reached:Ziel erreicht`;
    }
    if (!item.fillable) {
      return $localize`:@@dailyGoal.check.manual:Dieses Ziel braucht einen manuellen Eintrag`;
    }
    return $localize`:@@dailyGoal.check.fill:Rest eintragen und abhaken: +${item.remainingDisplay}:REMAINING:`;
  }

  protected ariaFor(item: DailyGoalItemView): string {
    return $localize`:@@dailyGoal.check.aria:${item.exerciseName}:EXERCISE: abhaken`;
  }

  protected onToggle(item: DailyGoalItemView, checked: boolean): void {
    if (!checked) return;
    this.complete.emit(item);
  }
}
