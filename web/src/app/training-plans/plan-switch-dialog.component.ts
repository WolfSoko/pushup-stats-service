import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/** What the user is switching away from, as the dialog presents it. */
export interface PlanSwitchDialogData {
  /** Localized title of the plan being left. */
  currentPlanTitle: string;
  /** Localized title of the plan being started. */
  nextPlanTitle: string;
  /** 1-based day the user reached in the plan being left. */
  currentDayIndex: number;
  /** Days of the outgoing plan already completed. */
  completedDays: number;
}

/** The user's answer. `null` (dialog dismissed) means "don't switch". */
export type PlanSwitchChoice = 'keep' | 'discard';

/**
 * Asks what should happen to the progress of the plan being replaced.
 *
 * Activating a plan overwrites the user's single active-plan document, so
 * without an answer here the previous plan's completed days, skips, ticks
 * and measured max tests would be gone with no warning beyond a line of
 * body text.
 */
@Component({
  selector: 'app-plan-switch-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@trainingPlans.switch.title">Plan wechseln?</h2>
    <mat-dialog-content>
      <p>
        <span i18n="@@trainingPlans.switch.current">Du bist gerade bei</span>
        <strong>{{ data.currentPlanTitle }}</strong>
        <span i18n="@@trainingPlans.switch.atDay">an Tag</span>
        <strong>{{ data.currentDayIndex }}</strong>
        <span i18n="@@trainingPlans.switch.completed">, erledigt:</span>
        <strong>{{ data.completedDays }}</strong>
        <span i18n="@@trainingPlans.switch.days">Tage</span>.
      </p>
      <p i18n="@@trainingPlans.switch.keepExplain">
        Behältst du den Fortschritt, kannst du diesen Plan später genau hier
        wieder aufnehmen.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close data-testid="plan-switch-cancel">
        <span i18n="@@trainingPlans.switch.cancel">Abbrechen</span>
      </button>
      <button
        mat-stroked-button
        data-testid="plan-switch-discard"
        (click)="close('discard')"
      >
        <mat-icon>delete_outline</mat-icon>
        <span i18n="@@trainingPlans.switch.discard">Fortschritt verwerfen</span>
      </button>
      <button
        mat-flat-button
        color="primary"
        data-testid="plan-switch-keep"
        (click)="close('keep')"
      >
        <mat-icon>bookmark</mat-icon>
        <span i18n="@@trainingPlans.switch.keep">Fortschritt behalten</span>
      </button>
    </mat-dialog-actions>
  `,
})
export class PlanSwitchDialogComponent {
  private readonly ref =
    inject<MatDialogRef<PlanSwitchDialogComponent, PlanSwitchChoice>>(
      MatDialogRef
    );
  protected readonly data = inject<PlanSwitchDialogData>(MAT_DIALOG_DATA);

  protected close(choice: PlanSwitchChoice): void {
    this.ref.close(choice);
  }
}
